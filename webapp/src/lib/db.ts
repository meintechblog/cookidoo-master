import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { STATE_DIR } from "./repo-paths";

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  _db = new Database(path.join(STATE_DIR, "thermomix.sqlite"));
  _db.pragma("journal_mode = WAL");
  migrate(_db);
  return _db;
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS pinned_urls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'queued',
      slug TEXT,
      error TEXT,
      pinned_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      processed_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      stdout TEXT,
      stderr TEXT,
      started_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      finished_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,        -- 'user' | 'assistant'
      body TEXT NOT NULL,
      delivered_to_peer INTEGER NOT NULL DEFAULT 0,   -- 1 = Mac-Daemon hat's abgeholt
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_undelivered
      ON chat_messages(delivered_to_peer, id)
      WHERE role='user' AND delivered_to_peer=0;
  `);
}

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  body: string;
  delivered_to_peer: 0 | 1;
  created_at: number;
};

export function chatInsert(role: "user" | "assistant", body: string): ChatMessage {
  const info = db().prepare("INSERT INTO chat_messages (role, body) VALUES (?, ?)").run(role, body);
  return db().prepare("SELECT * FROM chat_messages WHERE id = ?").get(info.lastInsertRowid) as ChatMessage;
}

export function chatList(sinceId: number = 0, limit: number = 200): ChatMessage[] {
  return db().prepare(
    "SELECT * FROM chat_messages WHERE id > ? ORDER BY id ASC LIMIT ?",
  ).all(sinceId, limit) as ChatMessage[];
}

export function chatUndeliveredUserMessages(): ChatMessage[] {
  return db().prepare(
    "SELECT * FROM chat_messages WHERE role='user' AND delivered_to_peer=0 ORDER BY id ASC",
  ).all() as ChatMessage[];
}

export function chatMarkDelivered(ids: number[]): void {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  db().prepare(`UPDATE chat_messages SET delivered_to_peer=1 WHERE id IN (${placeholders})`).run(...ids);
}

export type PinnedUrl = {
  id: number;
  url: string;
  status: "queued" | "processing" | "ready_for_review" | "publishing" | "done" | "error" | "skipped";
  slug: string | null;
  error: string | null;
  pinned_at: number;
  processed_at: number | null;
};

export function listPinned(): PinnedUrl[] {
  return db().prepare("SELECT * FROM pinned_urls ORDER BY pinned_at DESC").all() as PinnedUrl[];
}

export function pinUrl(url: string): PinnedUrl {
  const existing = db().prepare("SELECT * FROM pinned_urls WHERE url = ?").get(url) as PinnedUrl | undefined;
  if (existing) return existing;
  const info = db().prepare("INSERT INTO pinned_urls (url) VALUES (?)").run(url);
  return db().prepare("SELECT * FROM pinned_urls WHERE id = ?").get(info.lastInsertRowid) as PinnedUrl;
}

export function updatePinned(id: number, patch: Partial<Pick<PinnedUrl, "status" | "slug" | "error" | "processed_at">>) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const set = keys.map(k => `${k} = @${k}`).join(", ");
  db().prepare(`UPDATE pinned_urls SET ${set} WHERE id = @id`).run({ ...patch, id });
}
