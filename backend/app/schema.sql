-- PDS Virtual Inspection System Database Schema

CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    district TEXT,
    taluka TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shops (
    shop_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    district TEXT NOT NULL,
    taluka TEXT NOT NULL,
    cards_count INTEGER NOT NULL,
    vulnerability_index REAL NOT NULL,
    inspector_id TEXT,
    FOREIGN KEY (inspector_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS shop_weeks (
    shop_id TEXT NOT NULL,
    week_start TEXT NOT NULL,
    transactions INTEGER NOT NULL,
    auth_attempts INTEGER NOT NULL,
    auth_failures INTEGER NOT NULL,
    unauth_sales INTEGER NOT NULL,
    complaints_count INTEGER NOT NULL,
    stock_opening_kg REAL NOT NULL,
    stock_received_kg REAL NOT NULL,
    stock_sold_kg REAL NOT NULL,
    stock_closing_kg REAL NOT NULL,
    board_distributed_kg REAL NOT NULL,
    PRIMARY KEY (shop_id, week_start),
    FOREIGN KEY (shop_id) REFERENCES shops(shop_id)
);

CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT NOT NULL,
    week_start TEXT NOT NULL,
    category TEXT NOT NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(shop_id)
);

CREATE TABLE IF NOT EXISTS ground_truth (
    shop_id TEXT PRIMARY KEY,
    scenario TEXT NOT NULL,
    is_positive INTEGER NOT NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(shop_id)
);

CREATE TABLE IF NOT EXISTS runs (
    run_id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL,
    started_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    shops_scored INTEGER NOT NULL,
    explained INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scores (
    shop_id TEXT NOT NULL,
    week_start TEXT NOT NULL,
    risk_score REAL NOT NULL,
    band TEXT NOT NULL,
    breakdown_json TEXT NOT NULL,
    run_id INTEGER NOT NULL,
    PRIMARY KEY (shop_id, week_start),
    FOREIGN KEY (shop_id) REFERENCES shops(shop_id),
    FOREIGN KEY (run_id) REFERENCES runs(run_id)
);

CREATE TABLE IF NOT EXISTS explanations (
    shop_id TEXT NOT NULL,
    week_start TEXT NOT NULL,
    source TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    facts_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (shop_id, week_start),
    FOREIGN KEY (shop_id) REFERENCES shops(shop_id)
);

CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT NOT NULL,
    week_start TEXT NOT NULL,
    outcome TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(shop_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    actor_id TEXT,
    target_user_id TEXT,
    ip TEXT,
    detail_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (actor_id) REFERENCES users(user_id),
    FOREIGN KEY (target_user_id) REFERENCES users(user_id)
);

-- SQLite Triggers for audit_log (Append-Only)
CREATE TRIGGER IF NOT EXISTS audit_log_no_update
BEFORE UPDATE ON audit_log
BEGIN
    SELECT RAISE(ABORT, 'audit_log is append-only: UPDATE blocked');
END;

CREATE TRIGGER IF NOT EXISTS audit_log_no_delete
BEFORE DELETE ON audit_log
BEGIN
    SELECT RAISE(ABORT, 'audit_log is append-only: DELETE blocked');
END;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_scope ON users(district, taluka);
CREATE INDEX IF NOT EXISTS idx_shops_inspector ON shops(inspector_id);
CREATE INDEX IF NOT EXISTS idx_shop_weeks_week ON shop_weeks(week_start);
CREATE INDEX IF NOT EXISTS idx_shop_weeks_shop_week ON shop_weeks(shop_id, week_start);
CREATE INDEX IF NOT EXISTS idx_scores_week_score ON scores(week_start, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_shop_week ON complaints(shop_id, week_start);
CREATE INDEX IF NOT EXISTS idx_feedback_shop_week ON feedback(shop_id, week_start);
CREATE INDEX IF NOT EXISTS idx_audit_log_event ON audit_log(event);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
