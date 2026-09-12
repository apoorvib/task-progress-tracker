(function(root, factory) {
    const protocol = factory();
    if (typeof module === 'object' && module.exports) module.exports = protocol;
    else root.SyncProtocol = protocol;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const equal = (a, b) => canonical(a) === canonical(b);
    function canonical(value) {
        if (value === undefined) return 'undefined';
        if (value === null || typeof value !== 'object') return JSON.stringify(value);
        if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    }
    const copy = value => value == null ? null : structuredClone(value);
    const recordKey = (kind, key) => `${kind}:${key}`;
    const validKey = key => typeof key === 'string' && /^[a-zA-Z0-9_-]{1,150}$/.test(key);
    function validateValue(kind, key, value) {
        if (!validKey(key) || !['task', 'setting'].includes(kind)) throw new Error('Invalid record ID');
        if (value === null) return;
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid record');
        if (kind === 'setting') {
            if (!Object.hasOwn(value, 'value') || Object.keys(value).length !== 1) throw new Error('Invalid setting');
            return;
        }
        if (value.id !== key || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 500 ||
            typeof value.created !== 'string' || !Number.isFinite(Date.parse(value.created))) throw new Error('Invalid task');
        if (!value.completions || typeof value.completions !== 'object' || Array.isArray(value.completions)) throw new Error('Invalid completions');
        if (Object.keys(value).some(key => !['id', 'name', 'created', 'completions'].includes(key))) throw new Error('Unexpected task field');
        for (const [date, level] of Object.entries(value.completions)) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
                new Date(date).toISOString().slice(0, 10) !== date || !Number.isInteger(level) || level < 0 || level > 4) {
                throw new Error('Invalid completion date or level');
            }
        }
    }
    function validateOperation(op) {
        if (!op || !validKey(op.opId) || !Number.isSafeInteger(op.baseRevision) || op.baseRevision < 0) throw new Error('Invalid operation');
        validateValue(op.kind, op.key, op.base);
        validateValue(op.kind, op.key, op.value);
        if (op.restore !== undefined && typeof op.restore !== 'boolean') throw new Error('Invalid restore flag');
    }
    function fields(value, kind) {
        if (!value) return {};
        if (kind === 'setting') return { value: value.value };
        return { name: value.name, created: value.created, ...Object.fromEntries(
            Object.entries(value.completions).map(([date, level]) => [`day:${date}`, level])) };
    }
    function applyFields(value, changes, kind, key) {
        if (kind === 'setting') return { value: changes.value };
        const next = copy(value) || { id: key, completions: {} };
        for (const [field, data] of Object.entries(changes)) {
            const target = field.startsWith('day:') ? next.completions : next;
            const name = field.startsWith('day:') ? field.slice(4) : field;
            if (data === undefined) delete target[name];
            else target[name] = copy(data);
        }
        return next;
    }
    function changesFor(op) {
        const before = fields(op.base, op.kind), after = fields(op.value, op.kind);
        return Object.fromEntries([...new Set([...Object.keys(before), ...Object.keys(after)])]
            .filter(key => !equal(before[key], after[key])).map(key => [key, after[key]]));
    }
    // Three-way merge: separate dates/names commute; competing edits require a decision.
    function merge(current, op) {
        const value = current?.value ?? null;
        const revision = current?.revision ?? 0;
        if (equal(value, op.value)) return { value: copy(value) };
        if (value === null && op.value !== null) {
            if (revision > 0 && !(op.restore && op.base === null && op.baseRevision === revision)) return { conflict: true };
            if (op.base !== null) return { conflict: true };
            return { value: copy(op.value) };
        }
        if (op.value === null) return equal(value, op.base) ? { value: null } : { conflict: true };
        if (op.base === null) return { conflict: true };
        const before = fields(op.base, op.kind), remote = fields(value, op.kind), changes = changesFor(op);
        if (Object.entries(changes).some(([key, next]) => !equal(remote[key], before[key]) && !equal(remote[key], next))) return { conflict: true };
        return { value: applyFields(value, changes, op.kind, op.key) };
    }
    function overlay(value, op) {
        if (op.value === null) return null;
        if (value === null || op.base === null) return copy(op.value);
        return applyFields(value, changesFor(op), op.kind, op.key);
    }
    return { equal, canonical, copy, recordKey, validKey, validateValue, validateOperation, merge, overlay };
});
