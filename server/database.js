const { Pool } = require('pg');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const protocol = require('../js/sync-protocol');
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
class Database {
    constructor(config) {
        this.pool = new Pool({ ...config, max: 4, connectionTimeoutMillis: 2000, statement_timeout: 10000 });
        this.pool.on('error', error => console.error('Postgres connection:', error.code || 'unavailable'));
    }
    async sync(operations, expectedDatabaseId) {
        operations.forEach(protocol.validateOperation);
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SET LOCAL synchronous_commit = on');
            // One local-user dataset: serialize writes and their consistent recovery snapshot.
            await client.query('SELECT pg_advisory_xact_lock(4317, 1)');
            if (!this.initialized) {
                await client.query(schema);
                await client.query('INSERT INTO tracker_meta(singleton, database_id) VALUES(true, $1) ON CONFLICT DO NOTHING', [randomUUID()]);
            }
            const { rows: [meta] } = await client.query('SELECT database_id, revision FROM tracker_meta');
            if (expectedDatabaseId && expectedDatabaseId !== meta.database_id) {
                const error = new Error('The Postgres database has changed. Export local data before reconnecting to a different database.');
                error.status = 409;
                throw error;
            }
            let revision = Number(meta.revision);
            const results = [], blocked = new Set();
            for (const op of operations) {
                const id = protocol.recordKey(op.kind, op.key);
                if (blocked.has(id)) continue;
                const fingerprint = createHash('sha256').update(protocol.canonical(op)).digest('hex');
                const { rows: [processed] } = await client.query('SELECT fingerprint FROM tracker_operations WHERE op_id = $1', [op.opId]);
                if (processed) {
                    if (processed.fingerprint !== fingerprint) {
                        const error = new Error('Operation ID was reused with different data');
                        error.status = 400;
                        throw error;
                    }
                    results.push({ opId: op.opId, status: 'saved' });
                    continue;
                }
                const { rows: [row] } = await client.query('SELECT value, revision FROM tracker_records WHERE kind=$1 AND key=$2', [op.kind, op.key]);
                const current = row ? { value: row.value, revision: Number(row.revision) } : null;
                const merged = protocol.merge(current, op);
                if (merged.conflict) {
                    results.push({ opId: op.opId, status: 'conflict' });
                    blocked.add(id);
                    continue;
                }
                if (!row || !protocol.equal(row.value, merged.value)) {
                    revision++;
                    await client.query(`INSERT INTO tracker_records(kind,key,value,revision) VALUES($1,$2,$3,$4)
                        ON CONFLICT(kind,key) DO UPDATE SET value=excluded.value, revision=excluded.revision, updated_at=now()`,
                    [op.kind, op.key, merged.value === null ? null : JSON.stringify(merged.value), revision]);
                }
                await client.query('INSERT INTO tracker_operations(op_id,fingerprint) VALUES($1,$2)', [op.opId, fingerprint]);
                results.push({ opId: op.opId, status: 'saved' });
            }
            await client.query('UPDATE tracker_meta SET revision=$1', [revision]);
            const { rows } = await client.query('SELECT kind, key, value, revision FROM tracker_records ORDER BY kind, key');
            await client.query('COMMIT');
            this.initialized = true;
            return { databaseId: meta.database_id, revision, results, records: rows.map(row => ({ ...row, revision: Number(row.revision) })) };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally { client.release(); }
    }
    close() { return this.pool.end(); }
}
module.exports = { Database };
