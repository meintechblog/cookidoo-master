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
  `);
}

export type PinnedUrl = {
  id: number;
  url: string;
  status: "queued" | "processing" | "done" | "error" | "skipped";
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
