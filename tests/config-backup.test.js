const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { promisify } = require('node:util');

// Run the actual modules with isolated IO, never the user's configuration or database.
function load(name, dependencies, env = {}) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server', name), 'utf8'), {
        module, __dirname: path.join(__dirname, '../server'),
        process: { env, platform: 'linux', loadEnvFile() { throw new Error('Unexpected env access'); } },
        require(id) {
            assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`);
            return dependencies[id];
        }
    });
    return module.exports;
}

function configuration(env, saved) {
    return load('config.js', {
        'node:path': path,
        'node:fs': {
            existsSync: file => path.basename(file) === 'database.json' && !!saved,
            readFileSync: () => JSON.stringify(saved)
        }
    }, env);
}
const saved = { host: '127.0.0.1', port: 5432, database: 'task_progress', user: 'task_progress_app', password: 'synthetic' };

test('setup and runtime both reject DATABASE_URL without exposing its contents', () => {
    const config = configuration({ DATABASE_URL: 'postgres://admin:secret@other/unrelated' });
    for (const method of [config.postgresSettings, config.databaseConfig]) {
        assert.throws(() => method(), error => /DATABASE_URL is not supported/.test(error.message) && !error.message.includes('secret'));
    }
});

test('saved credentials require the complete endpoint and setup defaults match runtime', () => {
    assert.equal(configuration({}, saved).databaseConfig().password, saved.password);
    for (const env of [{ POSTGRES_HOST: 'other' }, { POSTGRES_PORT: '5433' }, { POSTGRES_DB: 'other' }, { POSTGRES_USER: 'other' }]) {
        const config = configuration(env, saved);
        const runtime = config.databaseConfig();
        assert.equal(runtime.password, undefined);
        for (const [key, value] of Object.entries(config.postgresSettings())) assert.equal(runtime[key], value);
    }
    const config = configuration({}, { ...saved, port: 5433 });
    assert.equal(config.databaseConfig().port, 5432);
    assert.equal(config.databaseConfig().password, undefined);
    assert.equal(configuration({ POSTGRES_HOST: 'other', POSTGRES_PASSWORD: 'new' }, saved).databaseConfig().password, 'new');
    assert.equal(configuration({ POSTGRES_PASSWORD: 'override' }, saved).databaseConfig().password, 'override');
});

test('backup freshness is scoped to endpoint, excludes passwords and ignores legacy dumps', async () => {
    const files = new Map([['task-progress-2026-09-12T01-00-00-000.dump', { mtimeMs: Date.now() }]]);
    const dumps = [];
    let target = { ...saved };
    let fail = false;
    const { backup } = load('backup.js', {
        'node:path': path, 'node:crypto': require('node:crypto'),
        'node:util': { promisify }, 'node:os': { homedir: () => 'synthetic-home' },
        './config': { databaseConfig: () => ({ ...target }) },
        pg: { Client: class { constructor(config) { this.connectionParameters = config; } } },
        'node:fs/promises': {
            async mkdir() {}, async readdir() { return [...files.keys()]; },
            async stat(file) { return files.get(path.basename(file)); },
            async rename(from, to) { files.set(path.basename(to), files.get(path.basename(from))); files.delete(path.basename(from)); },
            async unlink(file) { files.delete(path.basename(file)); }
        },
        'node:child_process': { execFile(executable, args, options, callback) {
            const filename = args[args.indexOf('--file') + 1];
            files.set(path.basename(filename), { mtimeMs: Date.now() });
            if (fail) return callback(Object.assign(new Error('synthetic'), { code: 1 }));
            dumps.push(filename);
            callback(null, '', '');
        } }
    });
    assert.ok(await backup());
    assert.equal(await backup(), null);
    target.password = 'rotated';
    assert.equal(await backup(), null);
    for (const change of [{ database: 'restored' }, { host: 'other' }, { port: 5433 }, { user: 'other' }]) {
        target = { ...target, ...change };
        assert.ok(await backup());
        assert.equal(await backup(), null);
    }
    assert.equal(dumps.length, 5);
    assert.equal(new Set(dumps).size, 5);
    assert.ok(await backup({ force: true }));
    target.database = 'failed';
    fail = true;
    await assert.rejects(backup(), /Backup failed/);
    assert.equal([...files.keys()].some(file => file.endsWith('.partial')), false);
    fail = false;
    assert.ok(await backup());
});
