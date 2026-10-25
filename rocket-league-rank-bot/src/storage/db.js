import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  announce_channel_id TEXT,
  review_channel_id TEXT,
  moderator_role_id TEXT,
  roles_enabled INTEGER NOT NULL DEFAULT 0
);
-- Configuration par rang. notify NULL = valeur par défaut (Silver et Gold).
CREATE TABLE IF NOT EXISTS rank_settings (
  guild_id TEXT NOT NULL,
  rank TEXT NOT NULL,
  notify INTEGER,
  gif_url TEXT,
  message_template TEXT,
  role_id TEXT,
  PRIMARY KEY (guild_id, rank)
);
CREATE TABLE IF NOT EXISTS accounts (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);
CREATE TABLE IF NOT EXISTS rank_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  playlist TEXT NOT NULL,
  rank TEXT NOT NULL,
  screenshot_url TEXT,
  origin TEXT NOT NULL DEFAULT 'declaration',
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | approved | rejected
  created_at INTEGER NOT NULL,
  reviewer_id TEXT,
  reviewed_at INTEGER,
  review_message_id TEXT,
  change_type TEXT,                            -- first | promotion | demotion | same
  previous_rank TEXT,
  notify_state TEXT NOT NULL DEFAULT 'none',   -- none | pending | sending | sent | failed
  notify_attempts INTEGER NOT NULL DEFAULT 0,
  notify_message_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_pending
  ON rank_requests (guild_id, user_id, playlist, status);
CREATE INDEX IF NOT EXISTS idx_requests_notify ON rank_requests (notify_state);
-- Dernier état validé : une ligne par membre ET par playlist.
CREATE TABLE IF NOT EXISTS validated_ranks (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  playlist TEXT NOT NULL,
  rank TEXT NOT NULL,
  request_id INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, playlist)
);
`;

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
