import Database from "better-sqlite3";
import { performance } from "node:perf_hooks";
import { brotliCompress } from "node:zlib";
import { promisify } from "node:util";
import { constants } from "node:zlib";
import { Readable } from "node:stream";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { encodeArchive } from "../core/storage/archive.js";
import { importSession } from "../core/storage/session-transfer.js";
import { initializeStorage } from "../core/storage/db.js";
import { PacketRepository } from "../core/storage/repository.js";
import { toSession } from "../core/storage/session.js";
import { packet } from "../tests/fixtures.js";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const compress = promisify(brotliCompress);
const input = process.argv[2];
let source: Database.Database | undefined;
try {
  source = input ? new Database(input, { readonly: true }) : undefined;
  if (source) source.exec("BEGIN");
  const records = source ? [...new PacketRepository(source).iterateAll()] : (() => {
    const assets = Array.from({ length: 16 }, () => randomBytes(256 * 1024).toString("base64"));
    return Array.from({ length: 200 }, (_, i) => packet({
      id: `benchmark-${i}`, timestamp: 1700000000000 + i,
      resBody: i % 4 === 0 ? assets[(i / 4) % assets.length] : JSON.stringify({ index: i, data: "example API response 한글 ".repeat(1000) }),
      resBodyType: i % 4 === 0 ? "binary" : "json",
    }));
  })();
  const json = Buffer.from(JSON.stringify(toSession(records), (_, value) => value === null ? undefined : value));
  let start = performance.now();
  const old = await compress(json, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } });
  const oldMs = performance.now() - start;
  start = performance.now();
  const blocks: Buffer[] = [];
  for await (const block of encodeArchive(records)) blocks.push(block);
  const archive = Buffer.concat(blocks);
  const encodeMs = performance.now() - start;
  const directory = await mkdtemp(path.join(tmpdir(), "tapwire-benchmark-"));
  const target = new Database(path.join(directory, "restored.db"));
  let decodeMs: number;
  try {
    initializeStorage(target);
    const repo = new PacketRepository(target);
    start = performance.now();
    const result = await importSession(Readable.from([archive]), repo);
    decodeMs = performance.now() - start;
    assert.equal(result.imported, records.length);
    for (const record of records) assert.deepEqual(repo.findById(record.id), record);
  } finally { target.close(); await rm(directory, { recursive: true, force: true }); }
  console.log(JSON.stringify({
    fixture: input ? "local capture (contents omitted)" : "synthetic mixed HTTP (16 rotating binary assets + JSON)",
    packets: records.length, jsonBytes: json.length, tw2LosslessBytes: old.length + 3,
    tw3Bytes: archive.length, reductionVsTw2Percent: +((1 - archive.length / (old.length + 3)) * 100).toFixed(2),
    tw2EncodeMs: +oldMs.toFixed(1), tw3EncodeMs: +encodeMs.toFixed(1),
    tw3ImportMs: +decodeMs.toFixed(1), exactRestoration: true,
  }, null, 2));
} finally { source?.close(); }
