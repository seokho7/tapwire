import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { Readable } from "node:stream";
import { initializeStorage, reclaimStorage } from "../core/storage/db.js";
import { PacketRepository } from "../core/storage/repository.js";
import { encodeArchive } from "../core/storage/archive.js";
import { exportSession, importSession } from "../core/storage/session-transfer.js";
import { packet } from "./fixtures.js";

async function database(run: (db: Database.Database, repo: PacketRepository) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), "tapwire-test-"));
  const db = new Database(path.join(dir, "packets.db"));
  try { initializeStorage(db); await run(db, new PacketRepository(db)); }
  finally { db.close(); await rm(dir, { recursive: true, force: true }); }
}

test("import is atomic; duplicates counted; full detail restored", async () => database(async (db, repo) => {
  repo.insertRecord(packet({ id: "existing", notes: "keep" }));
  const records = [packet(), packet({ id: "existing", notes: "replace?" })];
  const chunks: Buffer[] = [];
  for await (const chunk of encodeArchive(records)) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  await assert.rejects(importSession(Readable.from([bytes.subarray(0, bytes.length - 1)]), repo));
  assert.equal(repo.count(), 1);
  assert.deepEqual(await importSession(Readable.from([bytes]), repo), { imported: 1, skipped: 1 });
  assert.deepEqual(repo.findById("packet-1"), packet());
  assert.equal(repo.findById("existing")!.notes, "keep");
  assert.deepEqual(await importSession(Readable.from([bytes]), repo), { imported: 0, skipped: 2 });
  db.exec("CREATE TRIGGER reject_packet BEFORE INSERT ON packets WHEN NEW.id = 'bad' BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  await assert.rejects(importSession(Readable.from(encodeArchive([packet({ id: "good" }), packet({ id: "bad" })])), repo));
  assert.equal(repo.findById("good"), undefined);
}));

test("snapshot export stays consistent while capture writes", async () => database(async (db, repo) => {
  repo.importRecords(Array.from({ length: 5001 }, (_, i) => packet({ id: `snapshot-${i}` })));
  const output: Buffer[] = [];
  let wrote = false;
  for await (const chunk of exportSession(db.name)) {
    output.push(chunk);
    if (output.length === 2) {
      repo.insertRecord(packet({ id: "later" }));
      repo.updateNotes("snapshot-999", "changed during export");
      wrote = true;
    }
  }
  assert.ok(wrote);
  await database(async (_target, dest) => {
    assert.deepEqual(await importSession(Readable.from([Buffer.concat(output)]), dest), { imported: 5001, skipped: 0 });
    assert.equal(dest.findById("later"), undefined);
    assert.equal(dest.findById("snapshot-999")!.notes, "");
  });
}));

test("space reclamation preserves remaining packets after deletions", async () => database(async (db, repo) => {
  const body = "x".repeat(2 * 1024 * 1024);
  repo.insertRecord(packet({ id: "big", resBody: body })); repo.insertRecord(packet());
  const before = db.pragma("page_count", { simple: true }) as number;
  repo.delete("big");
  reclaimStorage(db);
  const after = db.pragma("page_count", { simple: true }) as number;
  assert.ok(after < before, `${before} -> ${after}`);
  assert.deepEqual(repo.findById("packet-1"), packet());
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
}));

test("legacy database migration reclaims free pages without changing rows", async () => {
  const db = new Database(":memory:");
  try {
    db.exec("CREATE TABLE legacy (id TEXT PRIMARY KEY, body TEXT); INSERT INTO legacy VALUES ('keep', 'value');");
    db.prepare("INSERT INTO legacy VALUES ('remove', ?)").run("x".repeat(4 * 1024 * 1024));
    db.exec("DELETE FROM legacy WHERE id = 'remove'");
    const before = db.pragma("page_count", { simple: true }) as number;
    initializeStorage(db);
    assert.ok((db.pragma("page_count", { simple: true }) as number) < before);
    assert.deepEqual(db.prepare("SELECT * FROM legacy").all(), [{ id: "keep", body: "value" }]);
  } finally { db.close(); }
});
