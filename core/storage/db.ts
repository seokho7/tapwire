import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS packets (
  id            TEXT PRIMARY KEY,
  timestamp     INTEGER NOT NULL,
  client_ip     TEXT,
  method        TEXT NOT NULL,
  url           TEXT NOT NULL,
  host          TEXT NOT NULL,
  path          TEXT NOT NULL,
  http_version  TEXT,
  is_https      INTEGER DEFAULT 0,
  req_headers   TEXT NOT NULL,
  req_body      TEXT,
  req_body_type TEXT,
  status_code   INTEGER,
  status_msg    TEXT,
  res_headers   TEXT,
  res_body      TEXT,
  res_body_type TEXT,
  duration      INTEGER,
  tags          TEXT DEFAULT '[]',
  notes         TEXT DEFAULT '',
  intercepted   INTEGER DEFAULT 0,
  replayed      INTEGER DEFAULT 0,
  content_type  TEXT
);

CREATE INDEX IF NOT EXISTS idx_timestamp ON packets(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_host ON packets(host);
CREATE INDEX IF NOT EXISTS idx_method ON packets(method);
CREATE INDEX IF NOT EXISTS idx_status ON packets(status_code);
`;

export function getDb(dataDir?: string): Database.Database {
  if (db) return db;

  const dir = dataDir ?? process.env.DATA_DIR ?? "./data";
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, "packets.db");

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = -65536");     // 64MB page cache
  db.pragma("temp_store = memory");
  db.pragma("wal_autocheckpoint = 500"); // checkpoint every 500 pages (~2MB)
  db.pragma("mmap_size = 134217728");   // 128MB mmap
  db.exec(SCHEMA);

  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}
