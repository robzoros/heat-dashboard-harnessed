const http = require('http');

const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'POST' && req.url === '/login') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { username, password } = JSON.parse(body);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, data: { players: [], locations: [], plays: [], boards: [] } }));
        });
    } else {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok' }));
    }
});

server.listen(3001, () => {
    console.log('BGG Proxy running on port 3001');
});
