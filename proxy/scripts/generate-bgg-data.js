const fs = require('fs');
const https = require('https');
const path = require('path');
const xml2js = require('xml2js');
const { classifyPlayers } = require('../classify');

const BGG_LOGIN_HOST = 'boardgamegeek.com';
const BGG_API_HOST = 'boardgamegeek.com';
const GAME_ID = '366013';
const OUTPUT_PATH = process.env.OUTPUT_PATH || path.join(__dirname, '..', '..', 'src', 'data', 'heat-data.json');

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
        request.on('error', reject);
        if (postData) request.write(postData);
        request.end();
    });
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
    const response = await makeRequest({
        hostname: BGG_LOGIN_HOST,
        port: 443,
        path: '/login/api/v1',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        }
    }, body);

    if (response.statusCode !== 204) {
        throw new Error(`BGG login failed with status ${response.statusCode}`);
    }
    return extractCookies(response.headers['set-cookie']);
}

async function fetchPlaysPage(cookies, username, page) {
    const response = await makeRequest({
        hostname: BGG_API_HOST,
        port: 443,
        path: `/xmlapi2/plays?username=${encodeURIComponent(username)}&id=${GAME_ID}&page=${page}`,
        method: 'GET',
        headers: {
            Cookie: cookies,
            Accept: 'application/xml'
        }
    });

    if (response.statusCode !== 200) {
        throw new Error(`BGG API returned ${response.statusCode} on page ${page}`);
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

main().catch(error => {
    console.error(`Data generation failed: ${error.message}`);
    process.exitCode = 1;
});
