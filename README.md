# Task Progress Tracker

Track daily tasks and habits with a monthly completion grid. Edits save immediately
in IndexedDB and synchronize to a local PostgreSQL database. Once the status reads
**Saved to Postgres**, clearing Chrome cookies or site data will not remove that
saved copy. Opening the app again restores it.

## What You Can Do

- Create, rename and delete tasks, and track daily completion across months.
- Switch between all tasks and a single task; view preferences sync too.
- Keep editing during a local server or database outage, with pending saves shown.
- Review conflicting edits instead of silently overwriting another tab's changes.
- Import and export JSON, and back up synced data with PostgreSQL dumps.

This is a local, single-user application, not a hosted website. Use the desktop
shortcut or localhost address for normal use; opening `index.html` directly does
not connect to PostgreSQL.

## Setup on Windows

Requires Node.js 22 or later and a running local PostgreSQL installation.

From the project directory, configure the app database and role in `.env` before
running setup. Existing process environment variables take precedence:

```dotenv
POSTGRES_DB="task_progress"
POSTGRES_USER="task_progress_app"
```

Then install dependencies, provision the database, and create the desktop shortcut:

```powershell
npm ci
npm run setup
npm run shortcut
```

Optional `POSTGRES_HOST` and `POSTGRES_PORT` default to `127.0.0.1` and `5432`.
An existing PostgreSQL server on port `5432` can host this database alongside another
project's database. You do not need a second server or port; use a dedicated database
and role rather than another project's credentials. The web app uses port `4317`,
which is separate from PostgreSQL's port.

`DATABASE_URL` is rejected by both setup and runtime; use the `POSTGRES_*` variables
so both always select the same database. Saved passwords are reused only when host,
port, database and username all match. Changing the endpoint requires credentials
for that endpoint or running setup again.
Setup prompts locally for your Postgres **administrator** username and password
(usually `postgres`). It creates a dedicated login role without superuser,
database-creation, role-creation, replication or row-security-bypass privileges,
creates the database owned by that role, and initializes tables as the app user.
The administrator must have provisioning privileges.
At this prompt, do **not** enter `task_progress_app`: that is the restricted app
role being provisioned, not the administrator. Use the administrator account from
your PostgreSQL installation; setup cannot discover its password.

The app password is generated automatically. You do not need to add one to `.env`.
Optional `POSTGRES_PASSWORD` supplies the app password explicitly; this is not the
administrator password. Administrator credentials are used only during setup and
are never written to configuration.

Only app credentials are saved in ignored `.local/database.json`, restricted to your
Windows account and SYSTEM. They are never served to the browser. Do not commit or
share this file. Re-running setup reuses its app role, password and database without
erasing tasks. Partial setup retains app credentials in `.local/database.json.pending`
so the same command can resume.

Setup refuses to take ownership of another role's database, reuse an unrelated or
privileged role, or reset an existing role's password. Use different names if they
collide with another project. Keep `.env` names consistent with the provisioned
database; the app will not fall back to old administrator credentials.

## Daily Use

Open the **Task Progress Tracker** desktop shortcut. It starts the local backend in
the background and opens **http://localhost:4317**. Repeated launches reuse the
server. The frontend still loads when Postgres is unavailable.
Closing the browser does not stop the background backend. After a computer restart,
open the shortcut again. Before clearing browser site data, check that the status
reads **Saved to Postgres**.

For a terminal launch:

```powershell
npm start
```

Keep the same hostname and port: `localhost`, `127.0.0.1`, and different ports have
different browser storage. If the default port is occupied by another app, the
launcher reports it rather than silently moving your data to another origin.
An intentional custom port can be saved as `{"port":4318}` in `.local/app.json`;
both the launcher and server use it. Export pending data before changing origins.

## Move Existing Browser Data

1. Open the original `index.html` at its original file location, using the same
   browser profile as before. Export Data downloads your existing tasks and history.
2. Launch the localhost app through the desktop shortcut.
3. Import the exported JSON and wait for **Saved to Postgres**.
4. Export again to check task IDs, dates and completion history before removing any
   old browser data or backup files.

Imports add missing tasks and keep unrelated tasks. Identical imports are safe to
repeat. A differing duplicate ID or invalid entry cancels the entire import without
changing existing data. Imports never silently restore a server-deleted task.
Version 1 exports remain supported. Opening a file directly remains useful for
migration and local editing where the browser permits IndexedDB, but synchronization
is enabled only when using the localhost app.

## Save Status and Offline Edits

- **Saved to Postgres**: every queued change has a committed database acknowledgement.
- **Saved locally - N pending**: edits are in IndexedDB and will retry automatically.
- **Syncing**: the app is sending pending changes or checking for server changes.
- **Conflicts to review**: both versions remain available until you choose one.
- **Not saved**: the local transaction failed. The attempted edit was not saved.

Sync runs after edits, at launch, on window focus, and periodically while open.
Failures retry with increasing delays, up to 30 seconds. An open tab can keep editing
if the backend stops. Reloading requires the local backend; the shortcut starts it.
Internet access is not required. This release does not register a service worker.

**Pending changes can be lost if browser site data is cleared before they sync.**
Closing and reopening normally preserves them. Clearing browser storage restores
only the copy that already reached Postgres. Explicitly deleting a task in the app
also deletes it from the active Postgres dataset after sync.

## Backups

The backend checks hourly and makes a PostgreSQL custom-format backup when the last
backup is at least 24 hours old. It also checks when it starts. These checks run only
while the backend is running. Backups are stored outside the browser profile in
`%USERPROFILE%\TaskProgressBackups`. Existing backups are retained.
Backup filenames include a hash of the host, port, database and username (never the
password). The 24-hour check applies only to that target; older unscoped backups
remain available but do not suppress new backups.

```powershell
npm run backup
```

This forces an immediate backup. `pg_dump` is discovered from the installed Windows
PostgreSQL versions; set `PG_DUMP_PATH` for a custom executable and `BACKUP_DIR` for
a different destination. Backup errors appear in `.local/server-error.log` when
using the launcher, or in the terminal with `npm start`.

Use PostgreSQL's `pg_restore` to restore a `.dump` into a separate empty database.
Export pending browser changes and stop the app before switching to the restored
database. The app refuses a different database identity or an older server snapshot
to avoid silently losing local changes; keep the export before resetting browser
storage for an intentional restore. Test the restored copy before replacing anything.

Postgres backups contain synced data. JSON exports also include the current local
tasks and pending-operation recovery information. Automatic backups on the same
disk do not protect against disk loss; copy important backups to another device.

## Troubleshooting

| Symptom | What to Check |
| --- | --- |
| Setup asks for a separate administrator | Enter your PostgreSQL administrator, usually `postgres`, not `task_progress_app`. |
| `DATABASE_URL` is rejected | Remove it from the project `.env` and inherited environment; configure this app with `POSTGRES_*` instead. |
| Changes remain pending | Check that PostgreSQL is running and the backend is reachable. Keep browser site data intact; export JSON before troubleshooting storage. |
| Port `4317` is occupied | Check which process owns it. The launcher will not stop another application or silently choose a new origin. |
| App is empty after moving to localhost | File-based browser storage is separate. Follow **Move Existing Browser Data** above. |
| Database identity or older-snapshot error | Preserve a JSON export first, then follow the intentional restore guidance above. Do not clear storage as a first troubleshooting step. |

When using the desktop launcher, backend output is in `.local/server.log` and errors
are in `.local/server-error.log`. With `npm start`, they appear in the terminal.
Never share `.env`, `.local/database.json`, or `.local/database.json.pending`;
they may contain app credentials and are excluded from Git.

## Verification

```powershell
npm test
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-postgres.ps1
```

The first command runs protocol, IndexedDB, configuration, backup-scheduling and
setup-recovery regression tests; real-database tests are skipped unless
`TEST_DATABASE_URL` is set. The second uses the
installed PostgreSQL 18 binaries to start an isolated temporary cluster on port 54329,
runs the real-database tests too, and stops the cluster afterward. It does not touch
your normal PostgreSQL service or data. Temporary test files stay under ignored
`.local/pg-test-*`. Alternatively set `TEST_DATABASE_URL` to a dedicated test database.

## Implementation

- `js/sync-storage.js`: IndexedDB transactions, persistent queue and synchronization.
- `js/sync-protocol.js`: shared validation and per-field three-way merge.
- `js/sync-ui.js`: save status and conflict decisions.
- `server/`: localhost HTTP API, PostgreSQL transactions and backups.
- `scripts/`: credential setup, launcher, desktop shortcut and integration checks.

See [storage design](docs/storage.md) for synchronization and recovery details.
The application is intended for one user on one machine, with multiple tabs or
browser profiles. It is not a public or multi-user web service.

## License

[MIT](LICENSE.md).
