import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let db: Database.Database | null = null;
let maintenance: ReturnType<typeof setInterval> | undefined;

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
  initializeStorage(db);
  const connection = db;
  maintenance = setInterval(() => {
    try { reclaimStorage(connection); }
    catch (error) { console.warn("[Storage] Space reclamation deferred:", error); }
  }, 1000);
  maintenance.unref();
  return db;
}

export function initializeStorage(db: Database.Database): void {
  // Existing databases need one VACUUM to add the page map. SQLite performs
  // this atomically; a failed migration leaves the original data usable.
  if (db.pragma("auto_vacuum", { simple: true }) === 0) {
    db.pragma("auto_vacuum = INCREMENTAL");
    if (db.pragma("page_count", { simple: true }) !== 0) {
      try { db.exec("VACUUM"); }
      catch (error) { console.warn("[Storage] Space reclamation migration deferred:", error); }
    }
  }
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = -65536");     // 64MB page cache
  db.pragma("temp_store = memory");
  db.pragma("wal_autocheckpoint = 500"); // checkpoint every 500 pages (~2MB)
  db.pragma("journal_size_limit = 8388608"); // shrink a reused WAL to at most 8 MiB
  db.pragma("mmap_size = 134217728");   // 128MB mmap
  db.exec(SCHEMA);
}

export function reclaimStorage(db: Database.Database): void {
  if ((db.pragma("freelist_count", { simple: true }) as number) > 0) {
    // Bound each maintenance pass; capture never waits for a full VACUUM.
    db.pragma("incremental_vacuum(1024)");
    db.pragma("wal_checkpoint(PASSIVE)");
  }
}

export function closeDb(): void {
  clearInterval(maintenance);
  maintenance = undefined;
  db?.close();
  db = null;
}
