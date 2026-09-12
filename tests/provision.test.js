const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Client, escapeIdentifier } = require('pg');
const { provision, validateTarget } = require('../server/provision');
const { postgresSettings, root } = require('../server/config');
const { Database } = require('../server/database');

test('provisioning uses POSTGRES names and rejects unsafe or system targets', () => {
    const target = postgresSettings({ POSTGRES_DB: 'task_progress', POSTGRES_USER: 'task_progress_app', POSTGRES_PORT: '5433' });
    assert.deepEqual(target, { host: '127.0.0.1', port: 5433, database: 'task_progress', user: 'task_progress_app' });
    validateTarget(target);
    for (const changes of [{ database: 'postgres' }, { database: 'template1' }, { user: 'postgres' }, { user: 'pg_admin' }, { user: 'bad;name' }, { port: NaN }]) {
        assert.throws(() => validateTarget({ ...target, ...changes }));
    }
});

test('provisioning creates a restricted role, resumes failures and preserves existing data', { skip: !process.env.TEST_DATABASE_URL }, async t => {
    const admin = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await admin.connect();
    const connection = admin.connectionParameters;
    const credentials = { user: connection.user, password: connection.password || 'admin-only-test-password' };
    const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
    const target = { host: connection.host, port: Number(connection.port), database: `provision_db_${suffix}`, user: `provision_app_${suffix}` };
    const directory = path.join(root, '.local', `provision-test-${suffix}`);
    const file = path.join(directory, 'database.json');
    const otherDatabase = `other_db_${suffix}`, otherRole = `other_role_${suffix}`;
    t.after(async () => {
        for (const name of [target.database, otherDatabase]) await admin.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(name)}`);
        for (const name of [target.user, otherRole]) await admin.query(`DROP ROLE IF EXISTS ${escapeIdentifier(name)}`);
        await admin.end();
        // This unique, generated directory is always inside the ignored workspace test folder.
        assert.equal(path.dirname(directory), path.join(root, '.local'));
        await fs.rm(directory, { recursive: true, force: true });
    });
    await admin.query(`CREATE DATABASE ${escapeIdentifier(otherDatabase)}`);
    await assert.rejects(provision(credentials, { ...target, database: otherDatabase }, { file }), /belongs to another role/);
    assert.equal((await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [target.user])).rowCount, 0);
    await admin.query(`CREATE ROLE ${escapeIdentifier(otherRole)} LOGIN`);
    await assert.rejects(provision(credentials, { ...target, user: otherRole }, { file }), /not a restricted role provisioned/);

    // Interrupt after role/database creation to exercise recovery of the generated password.
    const originalSync = Database.prototype.sync;
    Database.prototype.sync = async () => { throw new Error('Simulated schema initialization failure'); };
    try { await assert.rejects(provision(credentials, target, { file }), /Simulated schema/); }
    finally { Database.prototype.sync = originalSync; }
    const pending = JSON.parse(await fs.readFile(`${file}.pending`, 'utf8'));
    assert.equal(pending.user, target.user);
    assert.notEqual(pending.password, credentials.password);
    assert.ok(pending.password.length >= 32);
    assert.deepEqual(Object.keys(pending).sort(), ['database', 'host', 'password', 'port', 'user']);
    await assert.rejects(fs.access(file), { code: 'ENOENT' });
    const result = await provision(credentials, target, { file });
    assert.equal(result.createdRole, false);
    assert.equal(result.createdDatabase, false);
    const config = JSON.parse(await fs.readFile(file, 'utf8'));
    assert.equal(config.password, pending.password);
    await assert.rejects(fs.access(`${file}.pending`), { code: 'ENOENT' });
    const { rows: [role] } = await admin.query('SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolpassword FROM pg_authid WHERE rolname=$1', [target.user]);
    assert.equal(role.rolcanlogin, true);
    for (const key of ['rolsuper', 'rolcreatedb', 'rolcreaterole', 'rolreplication', 'rolbypassrls']) assert.equal(role[key], false);
    assert.match(role.rolpassword, /^SCRAM-SHA-256\$/);
    const app = new Client(config);
    await app.connect();
    try {
        assert.equal((await app.query('SELECT current_user AS name')).rows[0].name, target.user);
        assert.equal((await app.query('SELECT count(*) FROM tracker_meta')).rows[0].count, '1');
        await assert.rejects(app.query(`CREATE DATABASE ${escapeIdentifier(`forbidden_${suffix}`)}`), { code: '42501' });
        await assert.rejects(app.query(`CREATE ROLE ${escapeIdentifier(`forbidden_${suffix}`)}`), { code: '42501' });
        await app.query("INSERT INTO tracker_records(kind,key,value,revision) VALUES('setting','test','{\"value\":true}',1)");
    } finally { await app.end(); }
    await provision(credentials, target, { file });
    assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).password, config.password);
    const check = new Client(config);
    await check.connect();
    try { assert.equal((await check.query("SELECT value FROM tracker_records WHERE key='test'")).rows[0].value.value, true); }
    finally { await check.end(); }
    assert.equal((await admin.query('SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1', [otherDatabase])).rows[0].owner, credentials.user);
});
