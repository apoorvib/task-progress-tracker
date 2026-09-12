/* Each local edit and its pending operation commit in the same IndexedDB transaction. */
class SyncStorage extends EventTarget {
    constructor(options = {}) {
        super();
        this.DB_NAME = options.name || 'TaskProgressDB';
        this.fetch = options.fetch || globalThis.fetch?.bind(globalThis);
        this.syncEnabled = options.syncEnabled ?? (globalThis.location?.protocol !== 'file:');
        this.mode = 'checking';
        this.localError = null;
        this.retryDelay = 1000;
        this.stores = { tasks: 'id', settings: 'key', outbox: 'opId', remote: 'id', meta: 'key' };
    }
    initDB() {
        if (!this.ready) this.ready = this.open();
        return this.ready;
    }
    async open() {
        this.db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, 2);
            request.onupgradeneeded = () => {
                for (const [name, keyPath] of Object.entries(this.stores)) {
                    if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => this.emit('storageerror', { message: 'Close other tracker tabs to upgrade local storage.' });
        });
        this.db.onversionchange = () => { this.stopSync(); this.db.close(); this.emit('storageerror', { message: 'Local storage changed. Reload this page.' }); };
        await this.transaction(state => {
            if (state.meta.has('syncInitialized')) return;
            try {
                const old = JSON.parse(globalThis.localStorage?.getItem('taskProgress_tasks') || '[]');
                for (const task of old) {
                    SyncProtocol.validateValue('task', task.id, task);
                    if (!state.tasks.has(task.id)) state.tasks.set(task.id, task);
                }
            } catch { /* Keep IndexedDB data when legacy localStorage is unavailable. */ }
            for (const task of state.tasks.values()) this.enqueue(state, 'task', task.id, null, task);
            for (const setting of state.settings.values()) {
                if (!['hasSampleTasks', 'localStorage_migrated'].includes(setting.key)) this.enqueue(state, 'setting', setting.key, null, { value: setting.value });
            }
            state.settings.delete('hasSampleTasks');
            state.settings.delete('localStorage_migrated');
            state.meta.set('syncInitialized', { key: 'syncInitialized', value: true });
        }, true);
        return this.db;
    }
    emit(name, detail) { this.dispatchEvent(new CustomEvent(name, { detail })); }

    // The callback is synchronous: requests and writes stay inside one active transaction.
    transaction(change, write = false) {
        return new Promise((resolve, reject) => {
            const names = Object.keys(this.stores);
            const tx = this.db.transaction(names, write ? 'readwrite' : 'readonly', write ? { durability: 'strict' } : undefined);
            const state = {}, original = {};
            let remaining = names.length, result, failure;
            tx.oncomplete = () => resolve(result);
            tx.onabort = () => reject(failure || tx.error || new Error('Local save was aborted'));
            tx.onerror = () => {};
            for (const name of names) {
                const request = tx.objectStore(name).getAll();
                request.onsuccess = () => {
                    const key = this.stores[name];
                    state[name] = new Map(request.result.map(row => [row[key], row]));
                    if (write) original[name] = structuredClone(state[name]);
                    if (--remaining) return;
                    try {
                        result = change(state);
                        if (result?.then) throw new Error('IndexedDB changes must be synchronous');
                        if (write) for (const storeName of names) {
                            const store = tx.objectStore(storeName);
                            for (const id of original[storeName].keys()) if (!state[storeName].has(id)) store.delete(id);
                            for (const [id, row] of state[storeName]) if (!SyncProtocol.equal(original[storeName].get(id), row)) store.put(row);
                        }
                    } catch (error) { failure = error; tx.abort(); }
                };
            }
        });
    }
    async read(callback) { await this.initDB(); return this.transaction(callback); }
    async mutate(callback) {
        try {
            await this.initDB();
            const result = await this.transaction(callback, true);
            this.localError = null;
            this.emit('datachange');
            this.channel?.postMessage('changed');
            await this.publishStatus();
            this.scheduleSync(0);
            return result;
        } catch (error) {
            this.localError = `Not saved: ${error.message}`;
            this.emit('storageerror', { message: this.localError });
            throw error;
        }
    }
    enqueue(state, kind, key, base, value, restore = false) {
        if (SyncProtocol.equal(base, value)) return;
        SyncProtocol.validateValue(kind, key, value);
        const seq = (state.meta.get('sequence')?.value || 0) + 1;
        state.meta.set('sequence', { key: 'sequence', value: seq });
        const opId = crypto.randomUUID();
        const remote = state.remote.get(SyncProtocol.recordKey(kind, key));
        const operation = { opId, kind, key, base: SyncProtocol.copy(base), value: SyncProtocol.copy(value), baseRevision: remote?.revision || 0 };
        if (restore) operation.restore = true;
        state.outbox.set(opId, { opId, seq, operation, status: 'pending' });
    }
    getAllTasks() { return this.read(state => [...state.tasks.values()].sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id))); }
    getTaskById(id) { return this.read(state => state.tasks.get(id) || null); }
    getSetting(key) { return this.read(state => state.settings.get(key)?.value ?? null); }
    saveSetting(key, value) {
        return this.mutate(state => {
            const existing = state.settings.get(key);
            this.enqueue(state, 'setting', key, existing ? { value: existing.value } : null, { value });
            state.settings.set(key, { key, value });
            return true;
        });
    }
    generateUniqueId() { return crypto.randomUUID(); }
    saveTask(task) {
        const value = { id: task.id || this.generateUniqueId(), name: task.name, created: task.created || new Date().toISOString(), completions: task.completions || {} };
        return this.mutate(state => {
            this.enqueue(state, 'task', value.id, state.tasks.get(value.id) || null, value);
            state.tasks.set(value.id, value);
            return value;
        });
    }
    updateTask(id, changes) {
        return this.mutate(state => {
            const old = state.tasks.get(id);
            if (!old) throw new Error('This task no longer exists');
            const value = { ...old, ...changes, id, created: old.created };
            this.enqueue(state, 'task', id, old, value);
            state.tasks.set(id, value);
            return value;
        });
    }
    deleteTask(id) {
        return this.mutate(state => {
            const old = state.tasks.get(id);
            if (!old) return false;
            this.enqueue(state, 'task', id, old, null);
            state.tasks.delete(id);
            return true;
        });
    }
    saveCompletion(id, date, level) { return this.changeCompletion(id, date, () => level); }
    toggleCompletion(id, date) { return this.changeCompletion(id, date, level => (level + 1) % 5); }
    changeCompletion(id, date, change) {
        return this.mutate(state => {
            const old = state.tasks.get(id);
            if (!old) throw new Error('This task no longer exists');
            const value = { ...old, completions: { ...old.completions, [date]: change(old.completions[date] || 0) } };
            this.enqueue(state, 'task', id, old, value);
            state.tasks.set(id, value);
            return value;
        });
    }
    async getCompletionForDate(id, date) { return (await this.getTaskById(id))?.completions[date] || 0; }
    clearAllData() {
        return this.mutate(state => {
            for (const task of state.tasks.values()) this.enqueue(state, 'task', task.id, task, null);
            state.tasks.clear();
            return true;
        });
    }
    exportData() {
        return this.read(state => ({ version: '2.0', exportDate: new Date().toISOString(), tasks: [...state.tasks.values()],
            settings: Object.fromEntries([...state.settings.values()].map(row => [row.key, row.value])),
            syncRecovery: { pending: [...state.outbox.values()], remote: [...state.remote.values()] } }));
    }
    importData(data) {
        if (!data || !Array.isArray(data.tasks)) return Promise.reject(new Error('Invalid backup: tasks must be an array'));
        const ids = new Set();
        for (const task of data.tasks) {
            SyncProtocol.validateValue('task', task.id, task);
            if (ids.has(task.id)) throw new Error('Duplicate task ID in backup');
            ids.add(task.id);
        }
        if (data.settings != null && (typeof data.settings !== 'object' || Array.isArray(data.settings))) throw new Error('Invalid settings');
        for (const [key, value] of Object.entries(data.settings || {})) SyncProtocol.validateValue('setting', key, { value });
        return this.mutate(state => {
            for (const task of data.tasks) {
                const existing = state.tasks.get(task.id) || null;
                const remote = state.remote.get(SyncProtocol.recordKey('task', task.id));
                if ((existing && !SyncProtocol.equal(existing, task)) || (!existing && remote?.revision)) {
                    throw new Error(`Task "${task.name}" differs from current data. No data imported.`);
                }
                this.enqueue(state, 'task', task.id, existing, task);
                state.tasks.set(task.id, task);
            }
            for (const [key, value] of Object.entries(data.settings || {})) {
                const existing = state.settings.get(key);
                if (existing && !SyncProtocol.equal(existing.value, value)) throw new Error(`Setting "${key}" differs. No data imported.`);
                this.enqueue(state, 'setting', key, existing ? { value: existing.value } : null, { value });
                state.settings.set(key, { key, value });
            }
            return true;
        });
    }
    async getStatus() {
        return this.read(state => ({ mode: this.mode, pending: state.outbox.size,
            conflicts: [...state.outbox.values()].filter(row => row.status === 'conflict').length,
            lastSynced: state.meta.get('lastSynced')?.value, error: this.localError || this.syncError }));
    }
    async publishStatus() { this.emit('syncstatus', await this.getStatus()); }
    async startSync() {
        await this.initDB();
        if (this.started) return;
        this.started = true;
        this.wake = () => this.scheduleSync(0);
        globalThis.addEventListener?.('focus', this.wake);
        globalThis.addEventListener?.('online', this.wake);
        if (globalThis.BroadcastChannel) {
            this.channel = new BroadcastChannel(`${this.DB_NAME}:sync`);
            this.channel.onmessage = event => {
                if (event.data !== 'synced') this.emit('datachange');
                this.publishStatus().catch(() => {});
                if (event.data === 'changed') this.scheduleSync(100);
            };
        }
        await this.sync();
    }
    stopSync() {
        this.started = false;
        clearTimeout(this.timer);
        this.channel?.close();
        this.channel = null;
        globalThis.removeEventListener?.('focus', this.wake);
        globalThis.removeEventListener?.('online', this.wake);
    }
    scheduleSync(delay) {
        if (!this.started || !this.syncEnabled) return;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.sync(), delay);
    }
    sync() {
        if (this.syncing) { this.resyncRequested = true; return this.syncing; }
        // Start in a microtask so even the file:// early return clears this.syncing correctly.
        this.syncing = Promise.resolve().then(async () => {
            try {
                if (!this.syncEnabled) { this.mode = 'offline'; return; }
                this.mode = 'syncing';
                await this.publishStatus();
                if (globalThis.navigator?.locks) await navigator.locks.request(`${this.DB_NAME}:sync`, () => this.exchange());
                else await this.exchange();
                this.mode = 'saved';
                this.syncError = null;
                this.retryDelay = 1000;
            } catch (error) {
                this.mode = 'offline';
                this.syncError = error.message;
                this.retryDelay = Math.min(this.retryDelay * 2, 30000);
            } finally {
                await this.publishStatus().catch(error => this.emit('storageerror', { message: `Local storage unavailable: ${error.message}` }));
                this.syncing = null;
                const requested = this.resyncRequested;
                this.resyncRequested = false;
                this.scheduleSync(this.mode === 'offline' ? this.retryDelay : requested ? 0 : 15000);
            }
        });
        return this.syncing;
    }
    async exchange() {
        const payload = await this.read(state => {
            const blocked = new Set([...state.outbox.values()].filter(row => row.status === 'conflict').map(row => SyncProtocol.recordKey(row.operation.kind, row.operation.key)));
            return { databaseId: state.meta.get('databaseId')?.value,
                operations: [...state.outbox.values()].sort((a, b) => a.seq - b.seq)
                    .filter(row => !blocked.has(SyncProtocol.recordKey(row.operation.kind, row.operation.key)))
                    .slice(0, 50).map(row => row.operation) };
        });
        const response = await this.fetch('/api/sync', { method: 'POST', cache: 'no-store',
            headers: { 'Content-Type': 'application/json', 'X-Tracker-Client': '1' },
            body: JSON.stringify(payload), signal: AbortSignal.timeout(12000) });
        const snapshot = await response.json();
        if (!response.ok) throw new Error(snapshot.error || 'Postgres unavailable');
        if (!Array.isArray(snapshot.records) || !Array.isArray(snapshot.results) || !snapshot.databaseId || !Number.isSafeInteger(snapshot.revision)) throw new Error('Invalid sync response');
        for (const record of snapshot.records) SyncProtocol.validateValue(record.kind, record.key, record.value);
        const changed = await this.transaction(state => {
            const databaseId = state.meta.get('databaseId')?.value;
            if (databaseId && databaseId !== snapshot.databaseId) throw new Error('Postgres database changed. Export local data before reconnecting.');
            if ((state.meta.get('revision')?.value || 0) > snapshot.revision) throw new Error('Postgres snapshot is older than local sync history. Local data was kept.');
            for (const result of snapshot.results) {
                const row = state.outbox.get(result.opId);
                if (!row) continue;
                if (result.status === 'saved') state.outbox.delete(result.opId);
                else if (result.status === 'conflict') row.status = 'conflict';
            }
            state.remote.clear();
            for (const record of snapshot.records) {
                const id = SyncProtocol.recordKey(record.kind, record.key);
                state.remote.set(id, { ...record, id });
            }
            state.meta.set('databaseId', { key: 'databaseId', value: snapshot.databaseId });
            state.meta.set('revision', { key: 'revision', value: snapshot.revision });
            state.meta.set('lastSynced', { key: 'lastSynced', value: new Date().toISOString() });
            const before = SyncProtocol.canonical([...state.tasks.values(), ...state.settings.values()]);
            this.rebuild(state);
            const blocked = new Set([...state.outbox.values()].filter(row => row.status === 'conflict').map(row => SyncProtocol.recordKey(row.operation.kind, row.operation.key)));
            if ([...state.outbox.values()].some(row => !blocked.has(SyncProtocol.recordKey(row.operation.kind, row.operation.key)))) this.resyncRequested = true;
            return before !== SyncProtocol.canonical([...state.tasks.values(), ...state.settings.values()]);
        }, true);
        if (changed) this.emit('datachange');
        this.channel?.postMessage(changed ? 'synced-changed' : 'synced');
    }
    rebuild(state) {
        const values = new Map([...state.remote].map(([id, row]) => [id, { kind: row.kind, key: row.key, value: row.value }]));
        for (const row of [...state.outbox.values()].sort((a, b) => a.seq - b.seq)) {
            const op = row.operation, id = SyncProtocol.recordKey(op.kind, op.key);
            values.set(id, { kind: op.kind, key: op.key, value: SyncProtocol.overlay(values.get(id)?.value ?? null, op) });
        }
        state.tasks.clear();
        state.settings.clear();
        for (const { kind, key, value } of values.values()) if (value !== null) {
            if (kind === 'task') state.tasks.set(key, value);
            else state.settings.set(key, { key, value: value.value });
        }
    }
    getConflicts() {
        return this.read(state => [...state.outbox.values()].filter(row => row.status === 'conflict').map(row => {
            const { kind, key } = row.operation;
            const remote = state.remote.get(SyncProtocol.recordKey(kind, key));
            const local = kind === 'task' ? state.tasks.get(key) || null : state.settings.has(key) ? { value: state.settings.get(key).value } : null;
            return { opId: row.opId, kind, key, local, remote: remote?.value ?? null, revision: remote?.revision || 0 };
        }));
    }
    resolveConflict(conflict, choice) {
        return this.mutate(state => {
            const row = state.outbox.get(conflict.opId);
            if (!row || row.status !== 'conflict') throw new Error('This conflict has already been resolved');
            const { kind, key } = row.operation;
            const remote = state.remote.get(SyncProtocol.recordKey(kind, key));
            const local = kind === 'task' ? state.tasks.get(key) || null : state.settings.has(key) ? { value: state.settings.get(key).value } : null;
            if ((remote?.revision || 0) !== conflict.revision || !SyncProtocol.equal(local, conflict.local)) throw new Error('Data changed while reviewing. Close and reopen the conflict.');
            if (!['local', 'remote'].includes(choice)) throw new Error('Invalid conflict choice');
            for (const [id, pending] of state.outbox) if (pending.operation.kind === kind && pending.operation.key === key) state.outbox.delete(id);
            if (choice === 'local') this.enqueue(state, kind, key, remote?.value ?? null, local, true);
            this.rebuild(state);
            return true;
        });
    }
}
if (typeof module === 'object' && module.exports) module.exports = SyncStorage;
