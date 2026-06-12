import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { deduceSelectionFromClub } from "../football/teams.js";
import { config } from "../config.js";

let db = null;

export function getDb() {
  if (db) return db;

  fs.mkdirSync(path.dirname(config.database.path), { recursive: true });
  db = new Database(config.database.path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      jid TEXT PRIMARY KEY,
      name TEXT,
      vibe TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      message_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      jid TEXT PRIMARY KEY,
      push_name TEXT,
      favorite_team TEXT,
      rival_team TEXT,
      personality TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      insult_count INTEGER DEFAULT 0,
      interaction_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_jid TEXT NOT NULL,
      user_jid TEXT NOT NULL,
      PRIMARY KEY (group_jid, user_jid),
      FOREIGN KEY (group_jid) REFERENCES groups(jid),
      FOREIGN KEY (user_jid) REFERENCES users(jid)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_jid TEXT NOT NULL,
      user_jid TEXT NOT NULL,
      user_name TEXT,
      content TEXT NOT NULL,
      is_from_bot INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_jid) REFERENCES groups(jid),
      FOREIGN KEY (user_jid) REFERENCES users(jid)
    );

    CREATE TABLE IF NOT EXISTS facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('user', 'group')),
      entity_jid TEXT NOT NULL,
      fact TEXT NOT NULL,
      source_message_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_group_created
      ON messages(group_jid, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_facts_entity
      ON facts(entity_type, entity_jid);
  `);

  migrateUsersTable(db);
  migrateMatchAlertsTable(db);
  migrateIncidentCommentsTable(db);

  return db;
}

function migrateMatchAlertsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS match_alerts (
      match_id INTEGER NOT NULL,
      group_jid TEXT NOT NULL,
      alert_type TEXT NOT NULL CHECK (alert_type IN ('preview_10m', 'kickoff')),
      sent_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (match_id, group_jid, alert_type),
      FOREIGN KEY (group_jid) REFERENCES groups(jid)
    );
  `);
}

function migrateIncidentCommentsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS incident_comments (
      match_id INTEGER NOT NULL,
      incident_id TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (match_id, incident_id)
    );

    CREATE TABLE IF NOT EXISTS match_live_tracking (
      match_id INTEGER PRIMARY KEY,
      seeded_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function migrateUsersTable(db) {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const names = new Set(columns.map((c) => c.name));

  if (!names.has("favorite_selection")) {
    db.exec("ALTER TABLE users ADD COLUMN favorite_selection TEXT");
  }

  const users = db
    .prepare(
      `SELECT jid, favorite_team FROM users
       WHERE favorite_selection IS NULL AND favorite_team IS NOT NULL`
    )
    .all();

  const update = db.prepare(`UPDATE users SET favorite_selection = ? WHERE jid = ?`);
  for (const user of users) {
    const selection = deduceSelectionFromClub(user.favorite_team);
    if (selection) update.run(selection, user.jid);
  }
}
