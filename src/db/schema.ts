import * as SQLite from "expo-sqlite";

const DB_NAME = "emergency_alert.db";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await initializeSchema(db);
  return db;
}

async function initializeSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('critical', 'warning', 'info')),
      status TEXT NOT NULL CHECK(status IN ('active', 'resolved', 'expired')),
      category TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      expires_at TEXT,
      requires_response INTEGER NOT NULL DEFAULT 0,
      response_options TEXT, -- JSON array
      metadata TEXT,         -- JSON object
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_responses (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      response TEXT NOT NULL CHECK(response IN ('safe', 'need_assistance', 'evacuating', 'sheltering')),
      latitude REAL,
      longitude REAL,
      location_accuracy REAL,
      responded_at TEXT NOT NULL,
      synced_at TEXT,
      FOREIGN KEY (alert_id) REFERENCES alerts(id)
    );

    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      alert_id TEXT,
      user_id TEXT NOT NULL,
      hotline_number TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_seconds INTEGER,
      recording_url TEXT,
      status TEXT NOT NULL CHECK(status IN ('connecting', 'connected', 'disconnected', 'failed')),
      synced_at TEXT,
      FOREIGN KEY (alert_id) REFERENCES alerts(id)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('user_response', 'location_update', 'call_log')),
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'syncing', 'synced', 'failed')),
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
    CREATE INDEX IF NOT EXISTS idx_user_responses_alert ON user_responses(alert_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
  `);
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
