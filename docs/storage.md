# Storage and Recovery

The browser is the working copy. PostgreSQL is the durable copy outside Chrome's
profile. Each edit is usable immediately after its IndexedDB transaction commits;
Postgres availability never blocks local task editing.

## Local Transactions

`TaskProgressDB` version 2 retains the existing `tasks` and `settings` stores and adds
`outbox`, `remote` and `meta`. Each mutation reads the current state and atomically
writes both its working record and an operation with a random UUID and monotonic
local sequence. Promise resolution waits for transaction completion, not individual
request success. A failed transaction rolls back the task and queue together.

Legacy IndexedDB data and eligible localStorage tasks are queued once during upgrade.
The app does not generate sample data when a database is empty. The original
`indexedDB-storage.js` remains in the repository for reference, but is no longer
loaded by `index.html`.

## Protocol

`POST /api/sync` accepts at most 100 operations (the browser batches 50), an optional
previously observed database UUID, and returns operation results plus a complete
server snapshot. Each operation carries its stable ID, entity key, base revision,
base value and desired value. SQL uses parameters for data.

Postgres stores task documents (including daily completions) and settings in
`tracker_records` as JSONB, alongside server revisions. This preserves the existing
task format; merge logic still treats each completion date as a separate field.
`tracker_meta` holds the dataset UUID and global revision. `tracker_operations`
retains fingerprints of committed operations. Null record values are deletion
tombstones, which are retained along with operation receipts.

A transaction-level advisory lock serializes updates and their recovery snapshot.
The transaction applies non-conflicting operations, stores their receipts, and
commits before HTTP acknowledges them. Reusing an operation ID with different data
is rejected. Retrying a committed operation does not apply it again.

## Concurrent Changes

Three-way merge compares the base, local intention and current server value.
Changes to different names/dates/settings merge independently. Competing values for
the same field require review. Deletion conflicts with unseen edits; old clients
cannot recreate a tombstoned task automatically.

A conflict blocks later operations for that entity while unrelated tasks continue
syncing. The browser retains pending local changes and the current server version.
The dialog shows differences and offers a whole-version choice. Keeping local
creates a new operation against the reviewed remote version; further concurrent
changes can still conflict. Using Postgres discards that entity's pending edits.
Resolving against a stale dialog is rejected, preserving both versions.

Within one origin, IndexedDB serializes transactions across tabs. Web Locks serialize
sync exchanges where supported, and BroadcastChannel updates other tabs. Completion
toggles read and increment within one transaction. Snapshots are reconciled against
the current queue, so edits created during a network request are not overwritten.

## Recovery Boundaries

An empty local database receives the server snapshot without generating deletions.
Only explicit delete operations change the server. A different database UUID or a
server revision older than the locally observed revision is rejected. Intentional
database restoration requires preserving pending local data before resetting the
browser's association with the previous snapshot.

No browser-only design can preserve unsynced changes after explicit site-data
clearing. The UI distinguishes pending local saves from acknowledged Postgres saves.
Exports contain working tasks, settings, and pending/remote recovery information;
normal import restores working tasks/settings, not raw sync receipts. Differing
duplicate IDs cancel import atomically, avoiding accidental overwrite.

## Local Server and Backups

Setup reads `POSTGRES_DB` and `POSTGRES_USER` from the environment or project `.env`.
Administrator credentials arrive through a local secure prompt and stdin, and are
never saved. Provisioning creates a restricted login role and a database owned by
that role, then initializes the schema as the app user. Generated app credentials
are journaled locally before role creation so interrupted setup can resume without
resetting passwords. Setup refuses unrelated roles or databases. The final runtime
configuration contains only the app connection, never the administrator connection.

The server binds to IPv4 loopback, validates the exact localhost Host, and accepts
sync only with the matching Origin, JSON content type and custom request header.
There is no permissive CORS configuration. Static serving is an explicit public
asset allowlist; configuration, backup files, Git and server sources are excluded.

The desktop launcher uses a named mutex and health check to reuse an existing
instance. The backend remains running after the browser closes. It serves the UI
even when Postgres is unavailable and reloads local credentials after setup.

Backups use `pg_dump` custom format, with credentials in the child process environment,
never shell arguments. Partial output is renamed only after successful completion.
Scheduled checks run at startup and hourly while the backend is running, with a
24-hour interval between successful backups. No backups are automatically deleted.

## Verification Coverage

Regression tests cover local transaction rollback, legacy migration, queue persistence,
lost acknowledgements, concurrent toggles, independent merges, conflicting edits,
deletion tombstones, idempotent imports, fresh-browser restoration and database
identity checks. Real PostgreSQL integration checks cover commit/rollback, receipts,
conflicts, HTTP origin enforcement, and private-file exclusion.

Browser verification uses an isolated database and browser origin. It checks offline
reload, synchronization after recovery, site-data clearing, settings restoration,
conflict resolution and desktop/mobile layouts. It never clears the user's browser
profile or modifies their existing tasks.
