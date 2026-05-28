import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Override via ENV; otherwise the path baked in at install time.
const DB_PATH = process.env.CHAT_DB_PATH || "/Users/hulki/codex/thermomix-master/state/chat.sqlite";

let _db: Database.Database | null = null;

function db(): Database.Database {
  if (_db) return _db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("busy_timeout = 3000");
  migrate(_db);
  return _db;
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      body TEXT NOT NULL,
      delivered_to_peer INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_undelivered
      ON chat_messages(delivered_to_peer, id)
      WHERE role='user' AND delivered_to_peer=0;
    CREATE INDEX IF NOT EXISTS idx_chat_recent
      ON chat_messages(id DESC);
    CREATE TABLE IF NOT EXISTS peer_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      peer_id TEXT,
      peer_last_seen INTEGER,
      daemon_last_seen INTEGER NOT NULL
    );
  `);
}

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  body: string;
  delivered_to_peer: 0 | 1;
  created_at: number;
};

export type PeerStatus = {
  peer_id: string | null;
  peer_last_seen: number | null;
  daemon_last_seen: number;
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

export function chatRecent(limit: number = 200): ChatMessage[] {
  const rows = db().prepare(
    "SELECT * FROM chat_messages ORDER BY id DESC LIMIT ?",
  ).all(limit) as ChatMessage[];
  return rows.reverse();
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

export function setPeerStatus(peerId: string | null): void {
  const now = Math.floor(Date.now() / 1000);
  if (peerId) {
    db().prepare(`
      INSERT INTO peer_status (id, peer_id, peer_last_seen, daemon_last_seen)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        peer_id = excluded.peer_id,
        peer_last_seen = excluded.peer_last_seen,
        daemon_last_seen = excluded.daemon_last_seen
    `).run(peerId, now, now);
  } else {
    // Daemon-heartbeat ohne aktiven peer: nur daemon_last_seen updaten, peer_last_seen behalten
    db().prepare(`
      INSERT INTO peer_status (id, peer_id, peer_last_seen, daemon_last_seen)
      VALUES (1, NULL, NULL, ?)
      ON CONFLICT(id) DO UPDATE SET
        peer_id = NULL,
        daemon_last_seen = excluded.daemon_last_seen
    `).run(now);
  }
}

export function getPeerStatus(): PeerStatus | null {
  return db().prepare(
    "SELECT peer_id, peer_last_seen, daemon_last_seen FROM peer_status WHERE id = 1",
  ).get() as PeerStatus | null;
}
