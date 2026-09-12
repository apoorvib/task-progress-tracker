CREATE TABLE IF NOT EXISTS tracker_meta (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    database_id uuid NOT NULL,
    revision bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tracker_records (
    kind text NOT NULL CHECK (kind IN ('task', 'setting')),
    key text NOT NULL,
    value jsonb,
    revision bigint NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (kind, key)
);
CREATE TABLE IF NOT EXISTS tracker_operations (
    op_id text PRIMARY KEY,
    fingerprint text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
);
