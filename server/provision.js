const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { Client, escapeIdentifier, escapeLiteral } = require('pg');
const { Database } = require('./database');
const { configPath } = require('./config');

function validateTarget(target) {
    for (const name of [target.database, target.user]) {
        if (typeof name !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(name)) {
            throw new Error('POSTGRES_DB and POSTGRES_USER must contain only letters, numbers and underscores, starting with a letter or underscore.');
        }
    }
    if (['postgres', 'template0', 'template1'].includes(target.database) || target.user === 'postgres' || target.user.startsWith('pg_')) {
        throw new Error('Choose a dedicated app database and role, not a PostgreSQL system name.');
    }
    if (!Number.isInteger(target.port) || target.port < 1 || target.port > 65535 || typeof target.host !== 'string' || !target.host) {
        throw new Error('Invalid Postgres host or port.');
    }
}
async function readCredentials(file, target) {
    try {
        const saved = JSON.parse(await fs.readFile(file, 'utf8'));
        return ['host', 'port', 'database', 'user'].every(key => saved[key] === target[key]) ? saved.password : null;
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function provision(adminCredentials, target, { file = configPath, appPassword } = {}) {
    validateTarget(target);
    if (adminCredentials.user === target.user) throw new Error('Use a separate administrator account to provision the app role.');
    if (appPassword !== undefined && (typeof appPassword !== 'string' || !appPassword || appPassword.includes('\0'))) {
        throw new Error('POSTGRES_PASSWORD must be a non-empty password.');
    }
    const admin = new Client({ host: target.host, port: target.port, database: 'postgres',
        user: adminCredentials.user, password: adminCredentials.password, connectionTimeoutMillis: 5000 });
    const pendingFile = `${file}.pending`;
    const marker = `Task Progress Tracker application role for ${target.database}`;
    try {
        await admin.connect();
        // CREATE DATABASE cannot run in a transaction; serialize the full setup on this session.
        await admin.query('SET statement_timeout = 30000');
        await admin.query('SELECT pg_advisory_lock(4317, 2)');
        const { rows: [role] } = await admin.query(`SELECT oid, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls,
            shobj_description(oid, 'pg_authid') AS marker FROM pg_roles WHERE rolname=$1`, [target.user]);
        const { rows: [existingDatabase] } = await admin.query('SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1', [target.database]);
        if (existingDatabase && existingDatabase.owner !== target.user) {
            throw new Error('The requested database belongs to another role. Setup will not change its ownership or data. Choose another POSTGRES_DB.');
        }
        if (role) {
            if (role.marker !== marker || !role.rolcanlogin || role.rolsuper || role.rolcreatedb || role.rolcreaterole || role.rolreplication || role.rolbypassrls) {
                throw new Error('The requested role is not a restricted role provisioned for this app. Choose another POSTGRES_USER.');
            }
            const memberships = await admin.query('SELECT 1 FROM pg_auth_members WHERE member=$1', [role.oid]);
            const otherDatabases = await admin.query('SELECT 1 FROM pg_database WHERE datdba=$1 AND datname<>$2', [role.oid, target.database]);
            if (memberships.rowCount || otherDatabases.rowCount) throw new Error('The app role has other role memberships or owns another database. Setup will not reuse it.');
        }
        const password = appPassword || await readCredentials(file, target) || await readCredentials(pendingFile, target) || (!role ? randomBytes(32).toString('base64url') : null);
        if (!password) throw new Error('The app role already exists, but its local password is missing. Supply POSTGRES_PASSWORD locally; setup will not reset the role.');
        const config = { host: target.host, port: target.port, database: target.database, user: target.user, password };
        // Keep generated app credentials recoverable if a later provisioning step fails.
        // The administrator password is never written to either credentials file.
        await fs.mkdir(path.dirname(file), { recursive: true });
        if (!role) await fs.writeFile(pendingFile, JSON.stringify(config, null, 2), { mode: 0o600 });
        if (!role) {
            await admin.query('BEGIN');
            try {
                await admin.query("SET LOCAL password_encryption = 'scram-sha-256'");
                await admin.query(`CREATE ROLE ${escapeIdentifier(target.user)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${escapeLiteral(password)}`);
                await admin.query(`COMMENT ON ROLE ${escapeIdentifier(target.user)} IS ${escapeLiteral(marker)}`);
                await admin.query('COMMIT');
            } catch (error) { await admin.query('ROLLBACK'); throw error; }
        }
        if (!existingDatabase) {
            await admin.query(`CREATE DATABASE ${escapeIdentifier(target.database)} OWNER ${escapeIdentifier(target.user)}`);
            await admin.query(`REVOKE ALL ON DATABASE ${escapeIdentifier(target.database)} FROM PUBLIC`);
        }
        const database = new Database(config);
        try { await database.sync([], null); }
        finally { await database.close(); }
        // An existing role must authenticate before replacing its recovery credentials.
        if (role) await fs.writeFile(pendingFile, JSON.stringify(config, null, 2), { mode: 0o600 });
        await fs.rename(pendingFile, file);
        return { database: target.database, user: target.user, createdRole: !role, createdDatabase: !existingDatabase };
    } finally { await admin.end(); }
}
module.exports = { provision, validateTarget };
