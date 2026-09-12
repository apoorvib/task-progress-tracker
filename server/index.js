const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { root, port, databaseConfig } = require('./config');
const { Database } = require('./database');

function createServer(database, listenPort = port) {
    const host = `localhost:${listenPort}`;
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
    return http.createServer(async (req, res) => {
        const json = (status, body) => {
            res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify(body));
        };
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'same-origin');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
        if (req.headers.host !== host) return json(403, { error: `Open http://${host}` });
        const url = new URL(req.url, `http://${host}`);
        if (url.pathname === '/api/health' && req.method === 'GET') return json(200, { app: 'task-progress-tracker', version: 2 });
        if (url.pathname === '/api/sync' && req.method === 'POST') {
            if (req.headers.origin !== `http://${host}` || req.headers['x-tracker-client'] !== '1' ||
                !req.headers['content-type']?.startsWith('application/json')) return json(403, { error: 'Same-origin requests only' });
            try {
                let length = 0, chunks = [];
                for await (const chunk of req) {
                    length += chunk.length;
                    if (length > 5 * 1024 * 1024) return json(413, { error: 'Sync batch is too large' });
                    chunks.push(chunk);
                }
                let body;
                try {
                    body = JSON.parse(Buffer.concat(chunks).toString());
                    if (!body || !Array.isArray(body.operations) || body.operations.length > 100 ||
                        (body.databaseId != null && typeof body.databaseId !== 'string')) throw new Error('Invalid sync request');
                    body.operations.forEach(require('../js/sync-protocol').validateOperation);
                } catch (error) { return json(400, { error: error.message }); }
                return json(200, await database.sync(body.operations, body.databaseId));
            } catch (error) {
                console.error('Sync:', error.code || error.message);
                return json(error.status || 503, { error: error.status ? error.message : 'Postgres unavailable. Changes remain saved locally.' });
            }
        }
        if (url.pathname.startsWith('/api/')) return json(404, { error: 'Not found' });
        if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: 'Method not allowed' });
        let filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        // Serve only public assets. Configuration, backups, source and dependencies stay private.
        if (filename === 'node_modules/lucide/dist/umd/lucide.js') { /* Locally bundled icons. */ }
        else if (!['index.html', 'manifest.json', 'service-worker.js'].includes(filename) &&
            !/^(js|css|img)\/[a-zA-Z0-9_-]+\.(js|css|svg)$/.test(filename)) return json(404, { error: 'Not found' });
        try {
            const data = await fs.readFile(path.join(root, filename));
            res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            res.end(req.method === 'HEAD' ? undefined : data);
        } catch { json(404, { error: 'Not found' }); }
    });
}
if (require.main === module) {
    let currentConfig = JSON.stringify(databaseConfig());
    let database = new Database(JSON.parse(currentConfig));
    const server = createServer({ sync: async (...args) => {
        const nextConfig = JSON.stringify(databaseConfig());
        if (nextConfig !== currentConfig) {
            const oldDatabase = database;
            database = new Database(JSON.parse(nextConfig));
            currentConfig = nextConfig;
            oldDatabase.close().catch(() => {});
        }
        return database.sync(...args);
    } });
    server.listen(port, '127.0.0.1', () => {
        console.log(`Task Progress Tracker: http://localhost:${port}`);
        const { startBackups } = require('./backup');
        startBackups();
    });
    server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is occupied. Use the launcher to reuse the app.` : error.message); process.exitCode = 1; });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => database.close().then(() => process.exit())));
}
module.exports = { createServer };
