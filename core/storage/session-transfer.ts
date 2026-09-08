import Database from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { encodeArchive, decodeArchive } from "./archive.js";
import { PacketRepository } from "./repository.js";
import type { PacketRecord } from "../proxy/types.js";

export async function* exportSession(dbPath: string, limit = -1): AsyncGenerator<Buffer> {
  // A separate WAL reader gives the entire export one snapshot while capture continues.
  const snapshot = new Database(dbPath, { readonly: true });
  try {
    snapshot.pragma("cache_size = -8192");
    snapshot.exec("BEGIN");
    const repository = new PacketRepository(snapshot);
    yield* encodeArchive(repository.iterateAll(limit));
  } finally { snapshot.close(); }
}

export async function importSession(source: AsyncIterable<Uint8Array>, repository: PacketRepository) {
  const directory = await mkdtemp(path.join(tmpdir(), "tapwire-import-"));
  let stage: Database.Database | undefined;
  try {
    stage = new Database(path.join(directory, "stage.db"));
    stage.pragma("cache_size = -8192");
    stage.exec(`
      CREATE TABLE chunks (id INTEGER PRIMARY KEY, bytes BLOB NOT NULL);
      CREATE TABLE records (seq INTEGER PRIMARY KEY, json TEXT NOT NULL);
      BEGIN;
    `);
    const putChunk = stage.prepare("INSERT INTO chunks VALUES (?, ?)");
    const getChunk = stage.prepare("SELECT bytes FROM chunks WHERE id = ?");
    const putRecord = stage.prepare("INSERT INTO records(json) VALUES (?)");
    let count = 0;
    for await (const record of decodeArchive(source, {
      put: (id, data) => { putChunk.run(id, data); },
      get: (id) => (getChunk.get(id) as { bytes: Buffer } | undefined)?.bytes,
    })) {
      putRecord.run(JSON.stringify(record));
      // Bound the temporary DB's rollback journal and dirty page cache.
      if (++count % 256 === 0) stage.exec("COMMIT; BEGIN;");
    }
    stage.exec("COMMIT");
    const rows = stage.prepare("SELECT json FROM records ORDER BY seq");
    function* records(): Generator<PacketRecord> {
      for (const row of rows.iterate()) yield JSON.parse((row as { json: string }).json);
    }
    // No live data is touched until every checksum and the final manifest pass.
    return repository.importRecords(records());
  } finally {
    stage?.close();
    await rm(directory, { recursive: true, force: true });
  }
}
