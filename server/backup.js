const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { Client } = require('pg');
const { databaseConfig } = require('./config');
const execute = promisify(execFile);
async function pgDumpPath() {
    if (process.env.PG_DUMP_PATH) return process.env.PG_DUMP_PATH;
    if (process.platform === 'win32') {
        const parent = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL');
        const versions = await fs.readdir(parent).catch(() => []);
        for (const version of versions.sort((a, b) => Number(b) - Number(a))) {
            const candidate = path.join(parent, version, 'bin', 'pg_dump.exe');
            try { await fs.access(candidate); return candidate; } catch { /* Try the next installed version. */ }
        }
    }
    return 'pg_dump';
}
async function backup({ force = false } = {}) {
    const client = new Client(databaseConfig());
    const config = client.connectionParameters;
    const targetId = createHash('sha256').update(JSON.stringify([config.host, String(config.port), config.database, config.user])).digest('hex');
    const prefix = `task-progress-${targetId}-`;
    const directory = process.env.BACKUP_DIR || path.join(os.homedir(), 'TaskProgressBackups');
    await fs.mkdir(directory, { recursive: true });
    const files = (await fs.readdir(directory)).filter(file => file.startsWith(prefix) && /^[\dT-]+\.dump$/.test(file.slice(prefix.length)));
    if (!force && files.length) {
        const newest = files.sort().at(-1);
        const stat = await fs.stat(path.join(directory, newest));
        if (Date.now() - stat.mtimeMs < 24 * 60 * 60 * 1000) return null;
    }
    const filename = path.join(directory, `${prefix}${new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '')}.dump`);
    const pending = `${filename}.partial`;
    try {
        await execute(await pgDumpPath(), ['--no-password', '--format=custom', '--file', pending,
            '--host', config.host, '--port', String(config.port), '--username', config.user, '--dbname', config.database],
        { windowsHide: true, timeout: 120000, env: { ...process.env, PGPASSWORD: config.password || '', PGCONNECT_TIMEOUT: '5' } });
        await fs.rename(pending, filename);
        return filename;
    } catch (error) {
        await fs.unlink(pending).catch(() => {});
        throw new Error(`Backup failed (${error.code || 'pg_dump'}). Check the database connection and pg_dump installation.`);
    }
}
function startBackups() {
    if (process.env.DISABLE_BACKUPS === '1') return;
    let running = false;
    const run = async () => {
        if (running) return;
        running = true;
        try { const file = await backup(); if (file) console.log(`Backup: ${file}`); }
        catch (error) { console.error(error.message); }
        finally { running = false; }
    };
    run();
    setInterval(run, 60 * 60 * 1000).unref();
}
if (require.main === module) backup({ force: true }).then(file => console.log(file)).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { backup, startBackups };
