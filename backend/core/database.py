import sqlite3
from contextlib import contextmanager

from backend.config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    buyer_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT DEFAULT (datetime('now')),
    settled_at TEXT,
    final_amount_paise INTEGER,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT
);

CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    buyer_id TEXT NOT NULL,
    items TEXT NOT NULL,
    pricing TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now')),
    action_type TEXT NOT NULL,
    actor TEXT NOT NULL,
    details TEXT NOT NULL,
    previous_hash TEXT NOT NULL,
    current_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS merchant_registry (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    endpoint_url TEXT NOT NULL,
    description TEXT,
    categories TEXT,
    protocol_version TEXT NOT NULL DEFAULT '0.1.0',
    capabilities TEXT,
    added_at TEXT DEFAULT (datetime('now')),
    last_seen TEXT
);

CREATE TABLE IF NOT EXISTS inventory_reservations (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'HELD',
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_webhooks (
    event_id TEXT PRIMARY KEY,
    processed_at TEXT DEFAULT (datetime('now'))
);
"""


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.database_path, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 15000")
    return conn


def init_db() -> None:
    conn = get_connection()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()
