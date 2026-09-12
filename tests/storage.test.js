const { test } = require('node:test');
const assert = require('node:assert/strict');
require('fake-indexeddb/auto');
global.SyncProtocol = require('../js/sync-protocol');
const SyncStorage = require('../js/sync-storage');
const { randomUUID } = require('node:crypto');
const p = global.SyncProtocol;

class Remote {
    constructor() { this.id = randomUUID(); this.revision = 0; this.records = new Map(); this.processed = new Set(); this.online = true; }
    async fetch(url, request) {
        if (!this.online) throw new Error('Backend unavailable');
        const { operations } = JSON.parse(request.body);
        const results = [], blocked = new Set();
        for (const op of operations) {
            const id = p.recordKey(op.kind, op.key);
            if (blocked.has(id)) continue;
            if (this.processed.has(op.opId)) { results.push({ opId: op.opId, status: 'saved' }); continue; }
            const merged = p.merge(this.records.get(id), op);
            if (merged.conflict) { blocked.add(id); results.push({ opId: op.opId, status: 'conflict' }); continue; }
            this.records.set(id, { kind: op.kind, key: op.key, value: merged.value, revision: ++this.revision });
            this.processed.add(op.opId);
            results.push({ opId: op.opId, status: 'saved' });
        }
        const snapshot = structuredClone({ databaseId: this.id, revision: this.revision, results, records: [...this.records.values()] });
        if (this.afterCommit) await this.afterCommit();
        if (this.loseResponse) { this.loseResponse = false; throw new Error('Connection interrupted after commit'); }
        return { ok: true, json: async () => snapshot };
    }
}
function storage(t, remote, name = randomUUID()) {
    const client = new SyncStorage({ name, fetch: remote.fetch.bind(remote) });
    t.after(() => { client.stopSync(); client.db?.close(); });
    return client;
}
async function seed(client) { const task = await client.saveTask({ name: 'Read', completions: {} }); await client.sync(); return task; }
test('offline edit queue survives reopening and clears only after Postgres acknowledgement', async t => {
    const remote = new Remote(), name = randomUUID();
    const first = storage(t, remote, name);
    remote.online = false;
    const task = await first.saveTask({ name: 'Offline task' });
    await first.sync();
    assert.equal((await first.getStatus()).pending, 1);
    first.db.close();
    const reopened = storage(t, remote, name);
    assert.equal((await reopened.getTaskById(task.id)).name, 'Offline task');
    remote.online = true;
    await reopened.sync();
    assert.equal((await reopened.getStatus()).pending, 0);
    assert.equal(remote.records.get(`task:${task.id}`).value.name, 'Offline task');
});
test('fresh browser restores server data without sample data or delete operations', async t => {
    const remote = new Remote(), first = storage(t, remote);
    const task = await seed(first);
    await first.saveSetting('view', 'single'); await first.sync();
    const restored = storage(t, remote);
    await restored.sync();
    assert.deepEqual(await restored.getAllTasks(), [task]);
    assert.equal(await restored.getSetting('view'), 'single');
    assert.equal((await restored.getStatus()).pending, 0);
});
test('lost responses retry idempotently and retain edits made during an in-flight request', async t => {
    const remote = new Remote(), client = storage(t, remote);
    const task = await client.saveTask({ name: 'First' });
    remote.loseResponse = true;
    await client.sync();
    assert.equal((await client.getStatus()).pending, 1);
    remote.afterCommit = async () => { remote.afterCommit = null; await client.updateTask(task.id, { name: 'Second' }); };
    await client.sync();
    assert.equal((await client.getTaskById(task.id)).name, 'Second');
    assert.equal((await client.getStatus()).pending, 1);
    await client.sync();
    assert.equal((await client.getStatus()).pending, 0);
    assert.equal(remote.processed.size, 2);
    assert.equal(remote.records.get(`task:${task.id}`).value.name, 'Second');
});
test('independent offline edits merge and incompatible edits have an actionable conflict', async t => {
    const remote = new Remote(), a = storage(t, remote), b = storage(t, remote);
    const task = await seed(a); await b.sync();
    await a.updateTask(task.id, { name: 'Reading' });
    await b.saveCompletion(task.id, '2026-09-12', 3);
    await a.sync(); await b.sync(); await a.sync();
    assert.deepEqual(await a.getTaskById(task.id), await b.getTaskById(task.id));
    await a.updateTask(task.id, { name: 'Local A' });
    await b.updateTask(task.id, { name: 'Local B' });
    await a.sync(); await b.sync();
    const [conflict] = await b.getConflicts();
    assert.equal(conflict.local.name, 'Local B'); assert.equal(conflict.remote.name, 'Local A');
    await b.resolveConflict(conflict, 'local'); await b.sync(); await a.sync();
    assert.equal((await a.getTaskById(task.id)).name, 'Local B');
    assert.equal((await b.getStatus()).pending, 0);
});
test('stale edits cannot resurrect deleted tasks; choosing Postgres drops the local edit', async t => {
    const remote = new Remote(), a = storage(t, remote), b = storage(t, remote);
    const task = await seed(a); await b.sync();
    await a.deleteTask(task.id); await a.sync();
    await b.updateTask(task.id, { name: 'Stale edit' }); await b.sync();
    assert.equal((await b.getStatus()).conflicts, 1);
    assert.equal(remote.records.get(`task:${task.id}`).value, null);
    await b.resolveConflict((await b.getConflicts())[0], 'remote');
    assert.deepEqual(await b.getAllTasks(), []);
    assert.equal((await b.getStatus()).pending, 0);
});
test('repeated import is idempotent, invalid/conflicting imports roll back entirely', async t => {
    const remote = new Remote(), client = storage(t, remote);
    const existing = await seed(client);
    const imported = { ...existing, id: 'legacy-id', name: 'Imported' };
    await client.importData({ tasks: [imported] });
    await client.importData({ tasks: [imported] });
    assert.equal((await client.getStatus()).pending, 1);
    await assert.rejects(client.importData({ tasks: [{ ...imported, id: 'new-id' }, { ...existing, name: 'Overwrite' }] }));
    assert.equal(await client.getTaskById('new-id'), null);
    assert.equal((await client.getTaskById(existing.id)).name, existing.name);
});
test('aborted local transaction saves neither task nor pending operation', async t => {
    const remote = new Remote(), client = storage(t, remote);
    await client.initDB();
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value) {
        if (this.name === 'outbox') throw new DOMException('Quota exceeded', 'QuotaExceededError');
        return original.call(this, value);
    };
    try { await assert.rejects(client.saveTask({ name: 'Cannot save' })); }
    finally { IDBObjectStore.prototype.put = original; }
    assert.deepEqual(await client.getAllTasks(), []);
    assert.equal((await client.getStatus()).pending, 0);
    assert.match(client.localError, /Not saved/);
});
test('two tabs and rapid completion toggles do not lose local updates', async t => {
    const remote = new Remote(), name = randomUUID(), a = storage(t, remote, name), b = storage(t, remote, name);
    const task = await seed(a); await b.initDB();
    await Promise.all([a.toggleCompletion(task.id, '2026-09-12'), b.toggleCompletion(task.id, '2026-09-12'), a.toggleCompletion(task.id, '2026-09-12')]);
    assert.equal((await a.getTaskById(task.id)).completions['2026-09-12'], 3);
    await a.sync(); assert.equal((await b.getStatus()).pending, 0);
});
test('replaced or older database snapshots never erase the working copy', async t => {
    const remote = new Remote(), client = storage(t, remote);
    const task = await seed(client);
    remote.id = randomUUID(); remote.records.clear(); remote.revision = 0;
    await client.sync();
    assert.deepEqual(await client.getTaskById(task.id), task);
    assert.equal((await client.getStatus()).mode, 'offline');
});
test('version 1 IndexedDB upgrades retain history and queue it exactly once', async t => {
    const name = randomUUID();
    const legacy = { id: 'legacy-v1', name: 'Old task', created: '2025-02-01T00:00:00.000Z', completions: { '2025-02-03': 4 } };
    await new Promise((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('tasks', { keyPath: 'id' }).put(legacy);
            const settings = request.result.createObjectStore('settings', { keyPath: 'key' });
            settings.put({ key: 'hasSampleTasks', value: 'true' });
        };
        request.onsuccess = () => { request.result.close(); resolve(); };
        request.onerror = () => reject(request.error);
    });
    const remote = new Remote(), upgraded = storage(t, remote, name);
    assert.deepEqual(await upgraded.getAllTasks(), [legacy]);
    assert.equal((await upgraded.getStatus()).pending, 1);
    await upgraded.sync(); upgraded.db.close();
    const reopened = storage(t, remote, name);
    assert.equal((await reopened.getStatus()).pending, 0);
    assert.deepEqual(await reopened.getAllTasks(), [legacy]);
});
test('multi-batch queues retain unsent changes until the next acknowledgement', async t => {
    const remote = new Remote(), client = storage(t, remote);
    const tasks = Array.from({ length: 60 }, (_, i) => ({ id: `import-${i}`, name: `Task ${i}`, created: '2026-09-12T00:00:00.000Z', completions: {} }));
    await client.importData({ tasks });
    await client.sync();
    assert.equal((await client.getStatus()).pending, 10);
    assert.equal((await client.getAllTasks()).length, 60);
    await client.sync();
    assert.equal((await client.getStatus()).pending, 0);
    assert.equal(remote.records.size, 60);
});
