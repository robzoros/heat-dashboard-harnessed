const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const { classifyPlayers } = require('./classify');

const BGG_LOGIN_URL = 'boardgamegeek.com';
const BGG_API_HOST = 'boardgamegeek.com';
const GAME_ID = '366013';

function parseXml(xml) {
    return new Promise((resolve, reject) => {
        xml2js.parseString(xml, { explicitArray: false, mergeAttrs: false }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

function makeRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

function extractCookies(setCookieHeader) {
    if (!setCookieHeader) return '';
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    return cookies.map(c => c.split(';')[0]).join('; ');
}

function extractBoardFromComments(comments) {
    if (!comments) return 'Unknown';
    const text = comments.trim();
    const match = text.match(/^([^#\[]+?)(?:\s*#|\s*\[)/);
    if (match) return match[1].trim();
    return 'Unknown';
}

async function bggLogin(username, password) {
    const postData = JSON.stringify({ credentials: { username, password } });
    const options = {
        hostname: BGG_LOGIN_URL,
        port: 443,
        path: '/login/api/v1',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    const response = await makeRequest(options, postData);
    if (response.statusCode !== 204) {
        throw new Error(`BGG login failed with status ${response.statusCode}`);
    }
    return extractCookies(response.headers['set-cookie']);
}

async function fetchPlaysPage(cookies, username, page) {
    const options = {
        hostname: BGG_API_HOST,
        port: 443,
        path: `/xmlapi2/plays?username=${encodeURIComponent(username)}&id=${GAME_ID}&page=${page}`,
        method: 'GET',
        headers: {
            'Cookie': cookies,
            'Accept': 'application/xml'
        }
    };
    const response = await makeRequest(options);
    if (response.statusCode === 401) {
        throw new Error('Unauthorized');
    }
    if (response.statusCode !== 200) {
        throw new Error(`BGG API returned ${response.statusCode}`);
    }
    return response.body;
}

async function fetchAllPlays(cookies, username) {
    const allPlays = [];
    let page = 1;
    while (true) {
        const xml = await fetchPlaysPage(cookies, username, page);
        const data = await parseXml(xml);
        const plays = data.plays;
        if (!plays || !plays.play) break;
        const playArray = Array.isArray(plays.play) ? plays.play : [plays.play];
        allPlays.push(...playArray);
        if (playArray.length < 100) break;
        page++;
    }
    return allPlays;
}

function normalizeData(rawPlays) {
    const playerMap = new Map();
    const locationMap = new Map();
    const boardMap = new Map();

    const players = [];
    const locations = [];
    const boards = [];
    const plays = [];

    function getPlayerId(name, username, userid) {
        const key = `${name}|${userid}`;
        if (playerMap.has(key)) return playerMap.get(key);
        const id = players.length + 1;
        playerMap.set(key, id);
        players.push({ id, name, username: username || '', userid: userid || '' });
        return id;
    }

    function getLocationId(name) {
        if (!name) return null;
        if (locationMap.has(name)) return locationMap.get(name);
        const id = locations.length + 1;
        locationMap.set(name, id);
        locations.push({ id, name });
        return id;
    }

    function getBoardId(name) {
        if (!name) return null;
        if (boardMap.has(name)) return boardMap.get(name);
        const id = boards.length + 1;
        boardMap.set(name, id);
        boards.push({ id, name });
        return id;
    }

    for (const play of rawPlays) {
        const playId = play.$.id;
        const playDate = play.$.date;
        const locationName = play.$.location || '';
        const comments = play.comments || '';
        const boardName = extractBoardFromComments(comments);

        const locationRefId = getLocationId(locationName);
        const boardRefId = getBoardId(boardName);

        const playerScores = [];
        if (play.players && play.players.player) {
            const playerArray = Array.isArray(play.players.player) ? play.players.player : [play.players.player];
            for (const p of playerArray) {
                const name = p.$.name;
                const username = p.$.username ?? '';
                const userid = p.$.userid ?? '';
                const score = p.$.score ?? '';
                const scoreNum = score !== '' ? parseFloat(score) : null;
                const winner = p.$.win === '1';

                const playerRefId = getPlayerId(name, username, userid);
                playerScores.push({ playerRefId, score, scoreNum, winner });
            }
        }

        plays.push({
            id: playId,
            playDate,
            board: boardName,
            locationRefId,
            playerScores
        });
    }

    const classifiedPlayers = classifyPlayers(players, plays);
    return { players: classifiedPlayers, locations, boards, plays };
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/login') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { username, password } = JSON.parse(body);
                const cookies = await bggLogin(username, password);
                const rawPlays = await fetchAllPlays(cookies, username);
                const data = normalizeData(rawPlays);
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, data }));
            } catch (error) {
                console.error('Login or fetch error:', error.message);
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    } else if (req.method === 'POST' && req.url === '/test-login') {
        // Entrada trasera para tests: lee XML local y simula respuesta de BGG
        const xmlPath = path.join(__dirname, 'test-data', 'bgg-plays.xml');
        fs.readFile(xmlPath, 'utf8', async (err, xml) => {
            if (err) {
                console.error('Test login error:', err.message);
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, error: 'Test data not found' }));
                return;
            }
            try {
                const data = await parseXml(xml);
                const rawPlays = Array.isArray(data.plays.play) ? data.plays.play : [data.plays.play];
                const normalized = normalizeData(rawPlays);
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, data: normalized }));
            } catch (error) {
                console.error('Test login parse error:', error.message);
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    } else {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(404);
        res.end(JSON.stringify({ status: 'not found' }));
    }
});

server.listen(3001, () => {
    console.log('BGG Proxy running on port 3001');
});
