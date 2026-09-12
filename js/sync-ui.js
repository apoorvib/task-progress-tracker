class SyncUI {
    constructor(storage) {
        this.storage = storage;
        this.status = document.getElementById('sync-status');
        this.warning = document.getElementById('sync-warning');
        this.review = document.getElementById('review-conflicts');
        this.retry = document.getElementById('sync-now');
        this.dialog = document.getElementById('conflict-dialog');
        storage.addEventListener('syncstatus', event => this.render(event.detail));
        storage.addEventListener('storageerror', event => {
            this.status.textContent = event.detail.message;
            this.status.dataset.state = 'error';
        });
        this.retry.addEventListener('click', () => storage.sync());
        this.review.addEventListener('click', () => this.showConflicts());
        document.getElementById('close-conflicts').addEventListener('click', () => this.dialog.close());
        globalThis.lucide?.createIcons();
    }
    render(status) {
        let label;
        if (this.storage.localError) label = this.storage.localError;
        else if (status.conflicts) label = `Saved locally - ${status.conflicts} conflict${status.conflicts === 1 ? '' : 's'} to review`;
        else if (status.mode === 'syncing') label = status.pending ? `Syncing - ${status.pending} pending` : 'Checking Postgres...';
        else if (status.pending) label = `Saved locally - ${status.pending} pending`;
        else if (status.mode === 'saved') label = 'Saved to Postgres';
        else if (status.lastSynced) label = 'Postgres unavailable - no pending changes';
        else label = this.storage.syncEnabled ? 'Postgres unavailable - local storage ready' : 'Local file - sync unavailable';
        this.status.textContent = label;
        this.status.dataset.state = this.storage.localError || status.conflicts ? 'error' : status.pending || status.mode === 'offline' ? 'pending' : 'saved';
        this.status.title = status.error || (status.lastSynced ? `Last sync: ${new Date(status.lastSynced).toLocaleString()}` : '');
        this.warning.hidden = status.pending === 0;
        this.review.hidden = status.conflicts === 0;
        this.retry.disabled = status.mode === 'syncing' || !this.storage.syncEnabled;
    }
    async showConflicts() {
        const container = document.getElementById('conflict-list');
        container.replaceChildren();
        const conflicts = await this.storage.getConflicts();
        for (const conflict of conflicts) {
            const section = document.createElement('section');
            const heading = document.createElement('h3');
            heading.textContent = conflict.local?.name || conflict.remote?.name || conflict.key;
            section.appendChild(heading);
            const table = document.createElement('table');
            const header = document.createElement('tr');
            for (const title of ['Field', 'Local version', 'Postgres version']) {
                const cell = document.createElement('th'); cell.textContent = title; header.appendChild(cell);
            }
            table.appendChild(header);
            const display = value => {
                if (value === null) return { Status: 'Deleted' };
                if (conflict.kind === 'setting') return { Value: JSON.stringify(value.value) };
                return { Status: 'Active', Name: value.name, Created: value.created, ...value.completions };
            };
            const local = display(conflict.local), remote = display(conflict.remote);
            for (const field of new Set([...Object.keys(local), ...Object.keys(remote)])) {
                if (local[field] === remote[field]) continue;
                const row = document.createElement('tr');
                for (const value of [field, local[field] ?? '(not set)', remote[field] ?? '(not set)']) {
                    const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
                }
                table.appendChild(row);
            }
            section.appendChild(table);
            const actions = document.createElement('div'); actions.className = 'conflict-actions';
            for (const [choice, label] of [['local', 'Keep local version'], ['remote', 'Use Postgres version']]) {
                const button = document.createElement('button');
                button.className = 'btn-secondary'; button.textContent = label;
                button.addEventListener('click', async () => {
                    for (const item of actions.children) item.disabled = true;
                    try { await this.storage.resolveConflict(conflict, choice); await this.showConflicts(); }
                    catch (error) { alert(error.message); await this.showConflicts(); }
                });
                actions.appendChild(button);
            }
            section.appendChild(actions); container.appendChild(section);
        }
        if (!conflicts.length) { this.dialog.close(); return; }
        if (!this.dialog.open) this.dialog.showModal();
    }
}
