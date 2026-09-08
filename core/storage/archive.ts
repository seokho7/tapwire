import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { brotliCompress, brotliDecompress, gunzip, constants } from "node:zlib";
import type { PacketRecord } from "../proxy/types.js";
import { parseSession, validatePacket } from "./session.js";

const compress = promisify(brotliCompress);
const decompress = promisify(brotliDecompress);
const unzip = promisify(gunzip);
export const ARCHIVE_MAGIC = Buffer.from([0x54, 0x57, 0x03]);
const FRAME_HEADER = 42; // kind:u8, codec:u8, stored:u32le, raw:u32le, sha256:32
const CHUNK_SIZE = 64 * 1024;
const BLOCK_TARGET = 4 * 1024 * 1024;
const MAX_INDEX = 262_144;
export const ARCHIVE_LIMITS = {
  frameBytes: 64 * 1024 * 1024,
  bodyBytes: 64 * 1024 * 1024,
  fileBytes: 8 * 1024 ** 3,
  restoredBytes: 8 * 1024 ** 3,
  legacyBytes: 256 * 1024 * 1024,
  packets: 1_000_000,
};

// Metadata fields have a fixed order. Strings, header objects, and tag arrays use
// a block-local dictionary. Bodies use references into the session-wide chunk store.
const FIELDS = [
  "id", "timestamp", "clientIp", "method", "url", "host", "path", "httpVersion",
  "isHttps", "reqHeaders", "reqBodyType", "statusCode", "statusMessage", "resHeaders",
  "resBodyType", "duration", "contentType", "tags", "intercepted", "replayed", "notes",
] as const;
type BodyRef = [encoding: "utf8" | "utf16le" | "base64", bytes: number, chunks: number[]] | null;
type Row = [unknown[], BodyRef, BodyRef];
interface Block { dictionary: unknown[]; rows: Row[]; chunks: number[] }
export interface ChunkStore {
  put(id: number, data: Buffer): void;
  get(id: number): Buffer | undefined;
}
export interface ArchiveStats { packets: number; chunks: number; exported: number }
const digest = (data: Buffer) => createHash("sha256").update(data).digest();
const invalid = (detail: string): never => { throw new Error(`Invalid Tapwire archive: ${detail}`); };

async function frame(kind: number, raw: Buffer): Promise<Buffer> {
  if (raw.length > ARCHIVE_LIMITS.frameBytes) throw new Error("Session block exceeds 64 MiB");
  const compressed = await compress(raw, { params: {
    [constants.BROTLI_PARAM_QUALITY]: 6,
    [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
  } });
  const stored = compressed.length < raw.length ? compressed : raw;
  const header = Buffer.alloc(FRAME_HEADER);
  header[0] = kind;
  header[1] = stored === raw ? 0 : 1;
  header.writeUInt32LE(stored.length, 2);
  header.writeUInt32LE(raw.length, 6);
  digest(raw).copy(header, 10);
  return Buffer.concat([header, stored]);
}

function bodyBytes(body: string, type: PacketRecord["reqBodyType"]): [BodyRef & {}, Buffer] {
  let encoding: "utf8" | "utf16le" | "base64" = "utf8";
  let data = Buffer.from(body, "utf8");
  // Preserve even unpaired UTF-16 surrogates and noncanonical legacy base64 exactly.
  if (type === "binary") {
    const binary = Buffer.from(body, "base64");
    if (binary.toString("base64") === body) { data = binary; encoding = "base64"; }
  }
  if (encoding === "utf8" && data.toString("utf8") !== body) {
    data = Buffer.from(body, "utf16le"); encoding = "utf16le";
  }
  if (data.length > ARCHIVE_LIMITS.bodyBytes) throw new Error("Session body exceeds 64 MiB");
  return [[encoding, data.length, []], data];
}

/** Streaming, lossless TW3 writer. Only a block and a bounded hash index stay in RAM. */
export async function* encodeArchive(packets: Iterable<PacketRecord> | AsyncIterable<PacketRecord>): AsyncGenerator<Buffer> {
  yield ARCHIVE_MAGIC;
  const index = new Map<string, number>();
  const archiveHash = createHash("sha256");
  let chunkCount = 0;
  let packetCount = 0;
  let totalBytes = 0;
  let restoredBytes = 0;
  let block: Block = { dictionary: [], rows: [], chunks: [] };
  let dictionary = new Map<string, number>();
  let blobs: Buffer[] = [];
  let blockBytes = 0;
  const intern = (value: unknown): number => {
    const key = JSON.stringify(value);
    const found = dictionary.get(key);
    if (found !== undefined) return found;
    const id = block.dictionary.length;
    dictionary.set(key, id);
    block.dictionary.push(value);
    blockBytes += Buffer.byteLength(key);
    return id;
  };
  const addBody = async function* (body: string | null, type: PacketRecord["reqBodyType"]): AsyncGenerator<Buffer, BodyRef> {
    if (body === null) return null;
    const [ref, bytes] = bodyBytes(body, type);
    for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
      const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
      const hash = digest(chunk).toString("hex");
      let id = index.get(hash);
      if (id === undefined) {
        id = chunkCount++;
        if (index.size >= MAX_INDEX) index.clear();
        index.set(hash, id);
        block.chunks.push(chunk.length);
        blobs.push(chunk);
        blockBytes += chunk.length + 8;
      }
      ref[2].push(id);
      blockBytes += 12;
      if (blockBytes >= BLOCK_TARGET) yield await flush();
    }
    return ref;
  };
  const flush = async (): Promise<Buffer> => {
    const metadata = Buffer.from(JSON.stringify(block));
    const size = Buffer.alloc(4);
    size.writeUInt32LE(metadata.length);
    const raw = Buffer.concat([size, metadata, ...blobs]);
    totalBytes += raw.length;
    if (totalBytes > ARCHIVE_LIMITS.restoredBytes) throw new Error("Session exceeds 8 GiB");
    const encoded = await frame(1, raw);
    archiveHash.update(encoded);
    block = { dictionary: [], rows: [], chunks: [] };
    dictionary = new Map(); blobs = []; blockBytes = 0;
    return encoded;
  };
  for await (const packet of packets) {
    validatePacket(packet, packetCount);
    if (++packetCount > ARCHIVE_LIMITS.packets) throw new Error("Session exceeds 1,000,000 packets");
    restoredBytes += Buffer.byteLength(JSON.stringify(packet));
    if (restoredBytes > ARCHIVE_LIMITS.restoredBytes) throw new Error("Restored session exceeds 8 GiB");
    const req = yield* addBody(packet.reqBody, packet.reqBodyType);
    const res = yield* addBody(packet.resBody, packet.resBodyType);
    const values = FIELDS.map(key => {
      const value = packet[key];
      return typeof value === "string" || (value !== null && typeof value === "object")
        ? [intern(value)] : value;
    });
    block.rows.push([values, req, res]);
    blockBytes += 256;
    if (blockBytes >= BLOCK_TARGET || block.rows.length >= 2048) yield await flush();
  }
  if (block.rows.length || block.chunks.length) yield await flush();
  yield await frame(2, Buffer.from(JSON.stringify({
    packets: packetCount, chunks: chunkCount, exported: Date.now(), sha256: archiveHash.digest("hex"),
  })));
}

class Reader {
  private iterator: AsyncIterator<Uint8Array>;
  private buffer: Buffer = Buffer.alloc(0);
  private received = 0;
  constructor(source: AsyncIterable<Uint8Array>) { this.iterator = source[Symbol.asyncIterator](); }
  async read(size: number, allowEOF = false): Promise<Buffer | null> {
    const pieces: Buffer[] = [];
    let remaining = size;
    while (remaining > 0) {
      if (!this.buffer.length) {
        const next = await this.iterator.next();
        if (next.done) {
          if (allowEOF && remaining === size) return null;
          return invalid("truncated file");
        }
        this.buffer = Buffer.from(next.value);
        this.received += this.buffer.length;
        if (this.received > ARCHIVE_LIMITS.fileBytes) invalid("file exceeds 8 GiB");
        if (!this.buffer.length) continue;
      }
      const length = Math.min(remaining, this.buffer.length);
      pieces.push(this.buffer.subarray(0, length));
      this.buffer = this.buffer.subarray(length);
      remaining -= length;
    }
    return pieces.length === 1 ? pieces[0] : Buffer.concat(pieces, size);
  }
  async rest(prefix: Buffer): Promise<Buffer> {
    const pieces = [prefix, this.buffer];
    let length = prefix.length + this.buffer.length;
    if (length > ARCHIVE_LIMITS.legacyBytes) invalid("legacy file exceeds 256 MiB");
    this.buffer = Buffer.alloc(0);
    for (;;) {
      const next = await this.iterator.next();
      if (next.done) break;
      length += next.value.length;
      if (length > ARCHIVE_LIMITS.legacyBytes) invalid("legacy file exceeds 256 MiB");
      pieces.push(Buffer.from(next.value));
    }
    return Buffer.concat(pieces);
  }
  async close(): Promise<void> { await this.iterator.return?.(); }
}

function restoreBody(ref: unknown, store: ChunkStore, chunkCount: number): string | null {
  if (ref === null) return null;
  if (!Array.isArray(ref) || ref.length !== 3) return invalid("body reference");
  const [encoding, length, ids] = ref;
  if (!["utf8", "utf16le", "base64"].includes(encoding) || !Number.isSafeInteger(length) ||
    length < 0 || length > ARCHIVE_LIMITS.bodyBytes || !Array.isArray(ids) ||
    ids.length !== Math.ceil(length / CHUNK_SIZE)) return invalid("body size/encoding");
  const parts: Buffer[] = [];
  let remaining = length;
  for (const id of ids) {
    if (!Number.isSafeInteger(id) || id < 0 || id >= chunkCount) return invalid("unknown body chunk");
    const bytes = store.get(id);
    if (!bytes || bytes.length !== Math.min(remaining, CHUNK_SIZE)) return invalid("body chunk size");
    parts.push(bytes);
    remaining -= bytes.length;
  }
  const body = Buffer.concat(parts, length);
  const text = body.toString(encoding);
  if (encoding !== "base64" && !Buffer.from(text, encoding).equals(body)) invalid("body text encoding");
  return text;
}

/** Validate every frame and final manifest. Caller must stage records until iteration completes. */
export async function* decodeArchive(source: AsyncIterable<Uint8Array>, store: ChunkStore): AsyncGenerator<PacketRecord> {
  const reader = new Reader(source);
  try {
    const magic = (await reader.read(3))!;
    if (!magic.equals(ARCHIVE_MAGIC)) {
      let data = await reader.rest(magic);
      const options = { maxOutputLength: ARCHIVE_LIMITS.legacyBytes };
      if (magic.equals(Buffer.from([0x54, 0x57, 0x02]))) data = await decompress(data.subarray(3), options);
      else if (magic[0] === 0x1f && magic[1] === 0x8b) data = await unzip(data, options);
      else if (magic[0] === 0x54 && magic[1] === 0x57) invalid("unsupported version");
      const packets = parseSession(JSON.parse(data.toString("utf8")));
      if (packets.length > ARCHIVE_LIMITS.packets) invalid("too many packets");
      yield* packets;
      return;
    }
    let chunkCount = 0;
    let packetCount = 0;
    let rawBytes = 0;
    let restoredBytes = 0;
    const archiveHash = createHash("sha256");
    for (;;) {
      const header = (await reader.read(FRAME_HEADER))!;
      const kind = header[0];
      const codec = header[1];
      const storedLength = header.readUInt32LE(2);
      const rawLength = header.readUInt32LE(6);
      if (![1, 2].includes(kind) || ![0, 1].includes(codec) || !storedLength || !rawLength ||
        storedLength > ARCHIVE_LIMITS.frameBytes || rawLength > ARCHIVE_LIMITS.frameBytes ||
        (codec === 0 && storedLength !== rawLength)) invalid("frame header");
      rawBytes += rawLength;
      if (rawBytes > ARCHIVE_LIMITS.restoredBytes) invalid("expanded file exceeds 8 GiB");
      const stored = (await reader.read(storedLength))!;
      const raw = codec === 0 ? stored : await decompress(stored, { maxOutputLength: rawLength });
      if (raw.length !== rawLength || !digest(raw).equals(header.subarray(10))) invalid("checksum mismatch");
      if (kind === 2) {
        const manifest = JSON.parse(raw.toString("utf8"));
        if (manifest.packets !== packetCount || manifest.chunks !== chunkCount ||
          !Number.isSafeInteger(manifest.exported) || manifest.sha256 !== archiveHash.digest("hex")) invalid("manifest mismatch");
        if (await reader.read(1, true)) invalid("trailing data");
        return;
      }
      archiveHash.update(header); archiveHash.update(stored);
      if (raw.length < 4) invalid("metadata length");
      const metaLength = raw.readUInt32LE(0);
      if (metaLength > raw.length - 4) invalid("metadata length");
      const block = JSON.parse(raw.subarray(4, 4 + metaLength).toString("utf8")) as Block;
      if (!block || !Array.isArray(block.dictionary) || !Array.isArray(block.rows) ||
        !Array.isArray(block.chunks) || (!block.rows.length && !block.chunks.length)) invalid("metadata");
      let offset = 4 + metaLength;
      for (const size of block.chunks) {
        if (!Number.isSafeInteger(size) || size < 1 || size > CHUNK_SIZE || offset + size > raw.length) invalid("chunk size");
        store.put(chunkCount++, raw.subarray(offset, offset + size));
        offset += size;
      }
      if (offset !== raw.length) invalid("unused chunk bytes");
      for (const row of block.rows) {
        if (!Array.isArray(row) || row.length !== 3 || !Array.isArray(row[0]) || row[0].length !== FIELDS.length) invalid("packet row");
        if (++packetCount > ARCHIVE_LIMITS.packets) invalid("too many packets");
        const packet: Record<string, unknown> = {};
        row[0].forEach((value, i) => {
          if (Array.isArray(value)) {
            if (value.length !== 1 || !Number.isSafeInteger(value[0]) || value[0] < 0 || value[0] >= block.dictionary.length) invalid("dictionary reference");
            packet[FIELDS[i]] = block.dictionary[value[0]];
          } else packet[FIELDS[i]] = value;
        });
        // At most one packet is expanded at a time; account for actual JSON size,
        // including base64 and control-character escaping, before staging it.
        const restored = structuredClone(packet);
        restored.reqBody = restoreBody(row[1], store, chunkCount);
        restored.resBody = restoreBody(row[2], store, chunkCount);
        validatePacket(restored, packetCount - 1);
        restoredBytes += Buffer.byteLength(JSON.stringify(restored));
        if (restoredBytes > ARCHIVE_LIMITS.restoredBytes) invalid("restored session exceeds 8 GiB");
        yield restored;
      }
    }
  } finally { await reader.close(); }
}
