const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const configPath = path.join(root, '.local', 'database.json');
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
function postgresSettings(env = process.env) {
    if (env.DATABASE_URL) throw new Error('DATABASE_URL is not supported. Remove it and configure this app using POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER and POSTGRES_PASSWORD.');
    return { host: env.POSTGRES_HOST || '127.0.0.1', port: Number(env.POSTGRES_PORT || 5432),
        database: env.POSTGRES_DB || 'task_progress', user: env.POSTGRES_USER || 'task_progress_app' };
}
function databaseConfig() {
    const target = postgresSettings();
    if (fs.existsSync(configPath)) {
        const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (['host', 'port', 'database', 'user'].every(key => saved[key] === target[key])) {
            return { ...target,
                password: process.env.POSTGRES_PASSWORD || saved.password };
        }
    }
    return { ...target, password: process.env.POSTGRES_PASSWORD };
}
const appPath = path.join(root, '.local', 'app.json');
const app = fs.existsSync(appPath) ? JSON.parse(fs.readFileSync(appPath, 'utf8')) : {};
module.exports = { root, configPath, postgresSettings, databaseConfig, port: Number(process.env.PORT || app.port || 4317) };
