import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes, createHash } from "node:crypto";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { Readable } from "node:stream";
import { ARCHIVE_MAGIC, ARCHIVE_LIMITS, encodeArchive, decodeArchive } from "../core/storage/archive.js";
import { toSession } from "../core/storage/session.js";
import { packet } from "./fixtures.js";
import type { PacketRecord } from "../core/proxy/types.js";

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of source) result.push(item);
  return result;
}
async function encode(packets: PacketRecord[]) {
  return Buffer.concat(await collect(encodeArchive(packets)));
}
async function decode(bytes: Buffer, fragmented = false) {
  const chunks = new Map<number, Buffer>();
  const source = fragmented ? (async function* () {
    for (let i = 0; i < bytes.length; i += 7) yield bytes.subarray(i, i + 7);
  })() : Readable.from([bytes]);
  return collect(decodeArchive(source, {
    put: (id, data) => { chunks.set(id, Buffer.from(data)); }, get: id => chunks.get(id),
  }));
}

// Build valid checksummed frames to exercise semantic validation beyond corruption checks.
function rawFrame(kind: number, data: Buffer) {
  const header = Buffer.alloc(42);
  header[0] = kind;
  header.writeUInt32LE(data.length, 2); header.writeUInt32LE(data.length, 6);
  createHash("sha256").update(data).digest().copy(header, 10);
  return Buffer.concat([header, data]);
}

test("exact round trip: null/empty, binary bytes, Unicode, unusual headers and large bodies", async () => {
  const binary = randomBytes(360_000).toString("base64");
  const records = [packet(), packet({ id: "empty", reqBody: "", resBody: null, resHeaders: null }),
    packet({ id: "binary", reqBody: binary, resBody: binary, reqBodyType: "binary", resBodyType: "binary" }),
    packet({ id: "text", resBody: "한글 😀\r\n\u0000".repeat(50_000), notes: "\ud800" }),
    packet({ id: "legacy-b64", reqBody: " YQ\n", reqBodyType: "binary", resBody: "\ud800x\udc00", resBodyType: "text",
      reqHeaders: JSON.parse('{"__proto__":"literal","X-Order":["b","a"]}') }),
  ];
  assert.deepEqual(await decode(await encode(records), true), records);
});

test("empty archives and more than 5,000 packets preserve every record", async () => {
  assert.deepEqual(await decode(await encode([])), []);
  const records = Array.from({ length: 5001 }, (_, i) => packet({ id: `p-${i}`, timestamp: i }));
  assert.deepEqual(await decode(await encode(records)), records);
});

test("deduplicates distant binary bodies across block boundaries", async () => {
  const binary = randomBytes(2 * 1024 * 1024).toString("base64");
  const records = [packet({ id: "a", resBody: binary, resBodyType: "binary" }),
    packet({ id: "b", resBody: randomBytes(5 * 1024 * 1024).toString("base64"), resBodyType: "binary" }),
    packet({ id: "c", resBody: binary, resBodyType: "binary" })];
  const archive = await encode(records);
  assert.ok(archive.length < 7.1 * 1024 * 1024, `archive bytes: ${archive.length}`);
  assert.deepEqual(await decode(archive), records);
});

test("reads legacy JSON, gzip .wspy and TW2 Brotli including stripped defaults", async () => {
  const record = packet();
  const json = Buffer.from(JSON.stringify(toSession([record]), (_, v) => v === null ? undefined : v));
  for (const bytes of [json, gzipSync(json), Buffer.concat([Buffer.from([84, 87, 2]), brotliCompressSync(json)])]) {
    assert.deepEqual(await decode(bytes), [record]);
  }
});

test("rejects truncated, modified, appended and unsupported archives", async () => {
  const bytes = await encode([packet()]);
  for (const length of [0, 2, 10, bytes.length - 1, bytes.length - 42]) {
    await assert.rejects(decode(bytes.subarray(0, length)));
  }
  const modified = Buffer.from(bytes); modified[50] ^= 0xff;
  await assert.rejects(decode(modified));
  await assert.rejects(decode(Buffer.concat([bytes, Buffer.from([0])])), /trailing/);
  await assert.rejects(decode(Buffer.from([84, 87, 99])), /unsupported/);
});

test("rejects oversized frames before allocating and invalid legacy records", async () => {
  const header = Buffer.alloc(42); header[0] = 1;
  header.writeUInt32LE(ARCHIVE_LIMITS.frameBytes + 1, 2);
  header.writeUInt32LE(ARCHIVE_LIMITS.frameBytes + 1, 6);
  await assert.rejects(decode(Buffer.concat([ARCHIVE_MAGIC, header])), /frame header/);
  await assert.rejects(decode(Buffer.from(JSON.stringify(toSession([packet({ reqHeaders: [] as never })])))), /invalid/);
});

test("rejects a valid-checksum frame with invalid metadata or manifest", async () => {
  const metadata = Buffer.from(JSON.stringify({ dictionary: [], rows: [[[], null, null]], chunks: [] }));
  const size = Buffer.alloc(4); size.writeUInt32LE(metadata.length);
  await assert.rejects(decode(Buffer.concat([ARCHIVE_MAGIC, rawFrame(1, Buffer.concat([size, metadata]))])), /packet row/);
  await assert.rejects(decode(Buffer.concat([ARCHIVE_MAGIC, rawFrame(2, Buffer.from('{}'))])), /manifest/);
});

test("dictionary restoration does not share mutable headers or tags", async () => {
  const records = await decode(await encode([packet(), packet({ id: "other" })]));
  records[0].reqHeaders.accept = "changed"; records[0].tags.push("changed");
  assert.equal(records[1].reqHeaders.accept, "application/json");
  assert.deepEqual(records[1].tags, ["test", "한글"]);
});

test("rejects forged dictionary/body references and compressed expansion", async () => {
  const source = await encode([packet()]);
  // The first frame is Brotli-compressed, with its raw metadata at offset 4.
  const { brotliDecompressSync } = await import("node:zlib");
  const storedLength = source.readUInt32LE(5);
  const stored = source.subarray(45, 45 + storedLength);
  const raw = source[4] === 1 ? brotliDecompressSync(stored) : stored;
  const metaLength = raw.readUInt32LE(0);
  const original = JSON.parse(raw.subarray(4, 4 + metaLength).toString("utf8"));
  for (const mutate of [
    (block: typeof original) => { block.rows[0][0][0] = [99999]; },
    (block: typeof original) => { block.rows[0][2] = ["utf8", 1, [99999]]; },
    (block: typeof original) => { block.rows[0][2] = ["utf8", ARCHIVE_LIMITS.bodyBytes + 1, []]; },
  ]) {
    const block = structuredClone(original); mutate(block);
    const metadata = Buffer.from(JSON.stringify(block));
    const length = Buffer.alloc(4); length.writeUInt32LE(metadata.length);
    const payload = Buffer.concat([length, metadata, raw.subarray(4 + metaLength)]);
    await assert.rejects(decode(Buffer.concat([ARCHIVE_MAGIC, rawFrame(1, payload)])), /reference|body/);
  }
  const compressed = brotliCompressSync(Buffer.alloc(1024 * 1024));
  const header = Buffer.alloc(42); header[0] = 1; header[1] = 1;
  header.writeUInt32LE(compressed.length, 2); header.writeUInt32LE(10, 6);
  await assert.rejects(decode(Buffer.concat([ARCHIVE_MAGIC, header, compressed])), /larger|length|size/i);
});
