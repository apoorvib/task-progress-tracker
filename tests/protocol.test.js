const { test } = require('node:test');
const assert = require('node:assert/strict');
const p = require('../js/sync-protocol');
const task = { id: 'task-1', name: 'Exercise', created: '2026-09-12T12:00:00.000Z', completions: { '2026-09-01': 1 } };
const operation = changes => ({ opId: 'operation-1', kind: 'task', key: task.id, baseRevision: 1, base: task, value: { ...task, ...changes } });
test('independent date and name edits merge without overwriting remote work', () => {
    const current = { revision: 2, value: { ...task, name: 'Walking' } };
    const op = operation({ completions: { ...task.completions, '2026-09-02': 4 } });
    assert.deepEqual(p.merge(current, op).value, { ...op.value, name: 'Walking' });
});
test('competing edits conflict, while convergent edits are retry safe', () => {
    const op = operation({ name: 'Reading' });
    assert.equal(p.merge({ revision: 2, value: { ...task, name: 'Writing' } }, op).conflict, true);
    assert.deepEqual(p.merge({ revision: 2, value: op.value }, op).value, op.value);
});
test('deletions cannot erase unseen work or be resurrected by stale clients', () => {
    assert.equal(p.merge({ revision: 2, value: { ...task, name: 'Changed' } }, { ...operation({}), value: null }).conflict, true);
    assert.equal(p.merge({ revision: 2, value: null }, operation({ name: 'Old edit' })).conflict, true);
    assert.equal(p.merge({ revision: 2, value: null }, { ...operation({}), base: null, baseRevision: 0 }).conflict, true);
    assert.deepEqual(p.merge({ revision: 2, value: null }, { ...operation({}), base: null, baseRevision: 2, restore: true }).value, task);
});
test('validation rejects malformed dates, levels and unsupported fields', () => {
    for (const completions of [{ '2026-02-30': 2 }, { '2026-01-01': 5 }, { '2026-01-01': '1' }]) {
        assert.throws(() => p.validateValue('task', task.id, { ...task, completions }));
    }
    assert.throws(() => p.validateOperation({ ...operation({}), key: '../config' }));
    assert.throws(() => p.validateValue('task', task.id, { ...task, extra: true }));
});
