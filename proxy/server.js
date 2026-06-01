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

const CHAMPIONSHIPS_DIR = path.join(__dirname, 'championships');

function sendJson(res, statusCode, data) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(statusCode);
    res.end(JSON.stringify(data));
}

function parseUrl(url) {
    const parts = url.split('?')[0].split('/').filter(Boolean);
    return parts;
}

// Championship helpers
function getChampionshipFilePath(id) {
    return path.join(CHAMPIONSHIPS_DIR, `${id}.json`);
}

function readChampionship(id) {
    const filePath = getChampionshipFilePath(id);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listChampionships() {
    if (!fs.existsSync(CHAMPIONSHIPS_DIR)) return [];
    const files = fs.readdirSync(CHAMPIONSHIPS_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(CHAMPIONSHIPS_DIR, f), 'utf8'));
        return { id: data.id, name: data.name, description: data.description, createdAt: data.createdAt, participantCount: (data.participants || []).length, playCount: (data.playIds || []).length };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function writeChampionship(data) {
    if (!fs.existsSync(CHAMPIONSHIPS_DIR)) {
        fs.mkdirSync(CHAMPIONSHIPS_DIR, { recursive: true });
    }
    const filePath = getChampionshipFilePath(data.id);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return data;
}

function generateId() {
    return `champ_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const urlPath = req.url.split('?')[0];
    const parts = parseUrl(req.url);

    // POST /login — BGG login
    if (req.method === 'POST' && urlPath === '/login') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { username, password } = JSON.parse(body);
                const cookies = await bggLogin(username, password);
                const rawPlays = await fetchAllPlays(cookies, username);
                const data = normalizeData(rawPlays);
                sendJson(res, 200, { success: true, data });
            } catch (error) {
                console.error('Login or fetch error:', error.message);
                sendJson(res, 500, { success: false, error: error.message });
            }
        });
    // POST /test-login — test entry with local XML
    } else if (req.method === 'POST' && urlPath === '/test-login') {
        const xmlPath = path.join(__dirname, 'test-data', 'bgg-plays.xml');
        fs.readFile(xmlPath, 'utf8', async (err, xml) => {
            if (err) {
                console.error('Test login error:', err.message);
                sendJson(res, 500, { success: false, error: 'Test data not found' });
                return;
            }
            try {
                const data = await parseXml(xml);
                const rawPlays = Array.isArray(data.plays.play) ? data.plays.play : [data.plays.play];
                const normalized = normalizeData(rawPlays);
                sendJson(res, 200, { success: true, data: normalized });
            } catch (error) {
                console.error('Test login parse error:', error.message);
                sendJson(res, 500, { success: false, error: error.message });
            }
        });
    // GET /championships — list all championships
    } else if (req.method === 'GET' && urlPath === '/championships') {
        try {
            const championships = listChampionships();
            sendJson(res, 200, { success: true, data: championships });
        } catch (error) {
            console.error('List championships error:', error.message);
            sendJson(res, 500, { success: false, error: error.message });
        }
    // POST /championships — create new championship
    } else if (req.method === 'POST' && urlPath === '/championships') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { name, description, participants } = JSON.parse(body);
                if (!name || !name.trim()) {
                    sendJson(res, 400, { success: false, error: 'Name is required' });
                    return;
                }
                const championship = {
                    id: generateId(),
                    name: name.trim(),
                    description: (description || '').trim(),
                    createdAt: new Date().toISOString(),
                    participants: participants || [],
                    playIds: []
                };
                writeChampionship(championship);
                sendJson(res, 201, { success: true, data: championship });
            } catch (error) {
                console.error('Create championship error:', error.message);
                sendJson(res, 500, { success: false, error: error.message });
            }
        });
    // GET /championships/:id — get championship details
    } else if (req.method === 'GET' && parts.length === 2 && parts[0] === 'championships') {
        try {
            const id = parts[1];
            const championship = readChampionship(id);
            if (!championship) {
                sendJson(res, 404, { success: false, error: 'Championship not found' });
                return;
            }
            sendJson(res, 200, { success: true, data: championship });
        } catch (error) {
            console.error('Get championship error:', error.message);
            sendJson(res, 500, { success: false, error: error.message });
        }
    // POST /championships/:id/plays — add plays to championship
    } else if (req.method === 'POST' && parts.length === 3 && parts[0] === 'championships' && parts[2] === 'plays') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const id = parts[1];
                const championship = readChampionship(id);
                if (!championship) {
                    sendJson(res, 404, { success: false, error: 'Championship not found' });
                    return;
                }
                const { playIds } = JSON.parse(body);
                if (!Array.isArray(playIds)) {
                    sendJson(res, 400, { success: false, error: 'playIds must be an array' });
                    return;
                }
                const existing = new Set(championship.playIds);
                for (const playId of playIds) {
                    existing.add(String(playId));
                }
                championship.playIds = [...existing];
                writeChampionship(championship);
                sendJson(res, 200, { success: true, data: championship });
            } catch (error) {
                console.error('Add plays error:', error.message);
                sendJson(res, 500, { success: false, error: error.message });
            }
        });
    // DELETE /championships/:id — delete a championship
    } else if (req.method === 'DELETE' && parts.length === 2 && parts[0] === 'championships') {
        try {
            const id = parts[1];
            const filePath = getChampionshipFilePath(id);
            if (!fs.existsSync(filePath)) {
                sendJson(res, 404, { success: false, error: 'Championship not found' });
                return;
            }
            fs.unlinkSync(filePath);
            sendJson(res, 200, { success: true });
        } catch (error) {
            console.error('Delete championship error:', error.message);
            sendJson(res, 500, { success: false, error: error.message });
        }
    // DELETE /championships/:id/plays/:playId — remove play from championship
    } else if (req.method === 'DELETE' && parts.length === 4 && parts[0] === 'championships' && parts[2] === 'plays') {
        try {
            const id = parts[1];
            const playId = parts[3];
            const championship = readChampionship(id);
            if (!championship) {
                sendJson(res, 404, { success: false, error: 'Championship not found' });
                return;
            }
            championship.playIds = championship.playIds.filter(pid => String(pid) !== String(playId));
            writeChampionship(championship);
            sendJson(res, 200, { success: true, data: championship });
        } catch (error) {
            console.error('Remove play error:', error.message);
            sendJson(res, 500, { success: false, error: error.message });
        }
    } else {
        sendJson(res, 404, { status: 'not found' });
    }
});

server.listen(3001, () => {
    console.log('BGG Proxy running on port 3001');
});
