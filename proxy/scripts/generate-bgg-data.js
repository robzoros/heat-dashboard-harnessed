const fs = require('fs');
const https = require('https');
const path = require('path');
const xml2js = require('xml2js');
const { classifyPlayers } = require('../classify');

const BGG_LOGIN_HOST = 'boardgamegeek.com';
const BGG_API_HOST = 'boardgamegeek.com';
const GAME_ID = '366013';
const OUTPUT_PATH = process.env.OUTPUT_PATH || path.join(__dirname, '..', '..', 'src', 'data', 'heat-data.json');
const MAX_ATTEMPTS = Math.max(1, parseInt(process.env.BGG_MAX_ATTEMPTS || '5', 10));
const RETRY_BASE_MS = Math.max(250, parseInt(process.env.BGG_RETRY_BASE_MS || '2000', 10));
const REQUEST_TIMEOUT_MS = Math.max(5000, parseInt(process.env.BGG_REQUEST_TIMEOUT_MS || '30000', 10));
const RETRYABLE_STATUS_CODES = new Set([403, 408, 425, 429, 500, 502, 503, 504]);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRetryDelay(headers, attempt) {
    const retryAfter = headers && headers['retry-after'];
    if (retryAfter) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds)) return Math.max(1000, seconds * 1000);
        const dateDelay = new Date(retryAfter).getTime() - Date.now();
        if (Number.isFinite(dateDelay)) return Math.max(1000, dateDelay);
    }
    return RETRY_BASE_MS * (2 ** (attempt - 1));
}

function makeRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const request = https.request(options, response => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => resolve({
                statusCode: response.statusCode,
                headers: response.headers,
                body
            }));
        });
        request.setTimeout(REQUEST_TIMEOUT_MS, () => {
            request.destroy(new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`));
        });
        request.on('error', reject);
        if (postData) request.write(postData);
        request.end();
    });
}

async function makeRequestWithRetry(options, postData, operation, request = makeRequest) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const response = await request(options, postData);
            if (!RETRYABLE_STATUS_CODES.has(response.statusCode)) return response;
            lastError = new Error(`${operation} returned HTTP ${response.statusCode}`);
            if (attempt === MAX_ATTEMPTS) break;
            const delay = getRetryDelay(response.headers, attempt);
            console.warn(`${operation}: HTTP ${response.statusCode}; retrying in ${delay}ms (${attempt}/${MAX_ATTEMPTS})`);
            await sleep(delay);
        } catch (error) {
            lastError = error;
            if (attempt === MAX_ATTEMPTS) break;
            const delay = RETRY_BASE_MS * (2 ** (attempt - 1));
            console.warn(`${operation}: ${error.message}; retrying in ${delay}ms (${attempt}/${MAX_ATTEMPTS})`);
            await sleep(delay);
        }
    }
    throw new Error(`${lastError.message} after ${MAX_ATTEMPTS} attempts`);
}

function extractCookies(setCookieHeader) {
    if (!setCookieHeader) return '';
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    return cookies.map(cookie => cookie.split(';')[0]).join('; ');
}

function parseXml(xml) {
    return new Promise((resolve, reject) => {
        xml2js.parseString(xml, { explicitArray: false, mergeAttrs: false }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
        });
    });
}

async function login(username, password) {
    const body = JSON.stringify({ credentials: { username, password } });
    const response = await makeRequestWithRetry({
        hostname: BGG_LOGIN_HOST,
        port: 443,
        path: '/login/api/v1',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'User-Agent': 'HeatDashboardHarnessed/1.0 (+https://github.com/robzoros/heat-dashboard-harnessed)'
        }
    }, body, 'BGG login');

    if (response.statusCode !== 204) {
        throw new Error(`BGG login failed with status ${response.statusCode} after ${MAX_ATTEMPTS} attempts`);
    }
    return extractCookies(response.headers['set-cookie']);
}

async function fetchPlaysPage(cookies, username, page) {
    const response = await makeRequestWithRetry({
        hostname: BGG_API_HOST,
        port: 443,
        path: `/xmlapi2/plays?username=${encodeURIComponent(username)}&id=${GAME_ID}&page=${page}`,
        method: 'GET',
        headers: {
            Cookie: cookies,
            Accept: 'application/xml',
            'User-Agent': 'HeatDashboardHarnessed/1.0 (+https://github.com/robzoros/heat-dashboard-harnessed)'
        }
    }, null, `BGG plays page ${page}`);

    if (response.statusCode !== 200) {
        throw new Error(`BGG API returned ${response.statusCode} on page ${page} after ${MAX_ATTEMPTS} attempts`);
    }
    return response.body;
}

async function fetchAllPlays(cookies, username) {
    const allPlays = [];
    let page = 1;
    while (true) {
        const parsed = await parseXml(await fetchPlaysPage(cookies, username, page));
        const plays = parsed.plays && parsed.plays.play;
        if (!plays) break;
        const pagePlays = Array.isArray(plays) ? plays : [plays];
        allPlays.push(...pagePlays);
        if (pagePlays.length < 100) break;
        page++;
    }
    return allPlays;
}

function extractBoardFromComments(comments) {
    if (!comments) return 'Unknown';
    const match = comments.trim().match(/^([^#\[]+?)(?:\s*#|\s*\[)/);
    return match ? match[1].trim() : 'Unknown';
}

function normalizeData(rawPlays) {
    const players = [];
    const locations = [];
    const boards = [];
    const plays = [];
    const playerIds = new Map();
    const locationIds = new Map();
    const boardIds = new Map();

    function getPlayerId(name, username, userid) {
        const key = `${name}|${userid}`;
        if (playerIds.has(key)) return playerIds.get(key);
        const id = players.length + 1;
        playerIds.set(key, id);
        players.push({ id, name, username: username || '', userid: userid || '' });
        return id;
    }

    function getLocationId(name) {
        if (!name) return null;
        if (locationIds.has(name)) return locationIds.get(name);
        const id = locations.length + 1;
        locationIds.set(name, id);
        locations.push({ id, name });
        return id;
    }

    function getBoardId(name) {
        if (!name) return null;
        if (boardIds.has(name)) return boardIds.get(name);
        const id = boards.length + 1;
        boardIds.set(name, id);
        boards.push({ id, name });
        return id;
    }

    for (const play of rawPlays) {
        const board = extractBoardFromComments(play.comments || '');
        const playerScores = [];
        const xmlPlayers = play.players && play.players.player;
        for (const player of (xmlPlayers ? (Array.isArray(xmlPlayers) ? xmlPlayers : [xmlPlayers]) : [])) {
            const score = player.$.score ?? '';
            playerScores.push({
                playerRefId: getPlayerId(player.$.name, player.$.username ?? '', player.$.userid ?? ''),
                score,
                scoreNum: score === '' ? null : parseFloat(score),
                winner: player.$.win === '1'
            });
        }
        plays.push({
            id: play.$.id,
            playDate: play.$.date,
            board,
            locationRefId: getLocationId(play.$.location || ''),
            playerScores
        });
        getBoardId(board);
    }

    return {
        players: classifyPlayers(players, plays),
        locations,
        boards,
        plays
    };
}

async function main() {
    const username = process.env.BGG_USER || process.env.BGG_USERNAME;
    const password = process.env.BGG_PASS || process.env.BGG_PASSWORD;
    if (!username || !password) {
        throw new Error('Faltan BGG_USER y BGG_PASS en el entorno del workflow');
    }

    const cookies = await login(username, password);
    const rawPlays = await fetchAllPlays(cookies, username);
    if (rawPlays.length === 0) {
        throw new Error('BGG no devolvió ninguna partida; no se replaces el JSON existente');
    }

    const data = normalizeData(rawPlays);
    const output = {
        generatedAt: new Date().toISOString(),
        source: 'GitHub Actions weekly export',
        ...data
    };
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    console.log(`Generated ${OUTPUT_PATH}: ${data.plays.length} plays, ${data.players.length} players`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(`Data generation failed: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = {
    RETRYABLE_STATUS_CODES,
    getRetryDelay,
    makeRequestWithRetry
};
