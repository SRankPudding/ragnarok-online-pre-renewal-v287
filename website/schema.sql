CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    password_box TEXT,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'created', 'taken', 'expired'))
);
CREATE INDEX IF NOT EXISTS jobs_by_time ON jobs (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS active_names ON jobs (username) WHERE status IN ('pending', 'created');
CREATE TABLE IF NOT EXISTS login_attempts (ip_hash TEXT NOT NULL, attempted_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS login_attempts_by_ip ON login_attempts (ip_hash);
