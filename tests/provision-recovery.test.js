const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');

// Execute only reviewed source; all configuration IO and database clients are fake.
function load(name, dependencies, env = {}) {
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(root, 'server', name), 'utf8');
    vm.runInNewContext(source, {
        module, exports: module.exports, __dirname: path.join(root, 'server'),
        process: { env, loadEnvFile() { throw new Error('Credential file access prohibited'); } },
        require(id) {
            if (!Object.hasOwn(dependencies, id)) throw new Error(`Unexpected dependency: ${id}`);
            return dependencies[id];
        }
    }, { filename: name });
    return module.exports;
}

function provisioningHarness({ failRevoke = false, failSync = false } = {}) {
    const target = { host: '127.0.0.1', port: 9999, database: 'review_db', user: 'review_app' };
    const state = { files: new Map(), role: false, database: false, publicAccess: true, password: null };
    const file = '/synthetic/database.json';
    const provision = load('provision.js', {
        'node:path': path,
        'node:crypto': { randomBytes: () => ({ toString: () => 'synthetic-generated-secret' }) },
        './config': { configPath: file },
        'node:fs/promises': {
            async readFile(p) { if (!state.files.has(p)) throw Object.assign(new Error('missing'), { code: 'ENOENT' }); return state.files.get(p); },
            async mkdir() {},
            async writeFile(p, value) { state.files.set(p, value); },
            async rename(from, to) { state.files.set(to, state.files.get(from)); state.files.delete(from); }
        },
        pg: {
            escapeIdentifier: value => `"${value}"`, escapeLiteral: value => `'${value}'`,
            Client: class {
                async connect() {}
                async end() {}
                async query(sql) {
                    if (sql.includes('FROM pg_roles')) return { rows: state.role ? [{ oid: 1, rolcanlogin: true, marker: `Task Progress Tracker application role for ${target.database}` }] : [] };
                    if (sql.includes('pg_get_userbyid')) return { rows: state.database ? [{ owner: target.user }] : [] };
                    if (sql.includes('FROM pg_auth_members') || sql.includes('WHERE datdba=')) return { rowCount: 0, rows: [] };
                    if (sql.startsWith('CREATE ROLE')) { state.role = true; state.password = JSON.parse(state.files.get(`${file}.pending`)).password; }
                    if (sql.startsWith('CREATE DATABASE')) state.database = true;
                    if (sql.startsWith('REVOKE ALL')) {
                        if (failRevoke) { failRevoke = false; throw new Error('Simulated interruption before REVOKE'); }
                        state.publicAccess = false;
                    }
                    return { rows: [] };
                }
            }
        },
        './database': { Database: class {
            constructor(c) { this.config = c; }
            async sync() {
                if (failSync) { failSync = false; throw new Error('Simulated schema initialization failure'); }
                if (this.config.password !== state.password) throw new Error('password authentication failed');
            }
            async close() {}
        } }
    }).provision;
    return { state, file, run: options => provision({ user: 'synthetic_admin', password: 'synthetic_admin_secret' }, target, { file, ...options }) };
}


test('failed password override preserves partial-setup recovery credentials', async () => {
    const h = provisioningHarness({ failSync: true });
    await assert.rejects(h.run(), /schema initialization failure/);
    const original = h.state.files.get(`${h.file}.pending`);
    await assert.rejects(h.run({ appPassword: 'synthetic-mistyped-secret' }), /authentication failed/);
    assert.equal(h.state.files.get(`${h.file}.pending`), original);
    await h.run();
    assert.equal(h.state.files.get(h.file), original);
    assert.equal(h.state.files.has(`${h.file}.pending`), false);
    await assert.rejects(h.run({ appPassword: 'another-wrong-password' }), /authentication failed/);
    assert.equal(h.state.files.get(h.file), original);
    assert.equal(h.state.files.has(`${h.file}.pending`), false);
    await h.run();
});
