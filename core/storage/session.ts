import type { PacketRecord } from "../proxy/types.js";

export interface WspySession {
  v: 1;
  exported: number;
  packets: PacketRecord[];
}

export function toSession(packets: PacketRecord[]): WspySession {
  return { v: 1, exported: Date.now(), packets };
}

export function parseSession(data: unknown): PacketRecord[] {
  if (typeof data !== "object" || data === null) throw new Error("invalid session");
  const d = data as Record<string, unknown>;
  if (d.v !== 1 || !Array.isArray(d.packets)) throw new Error("invalid wspy format");
  return d.packets.map((p: unknown, i: number) => {
    if (typeof p !== "object" || p === null) throw new Error(`packet[${i}] invalid`);
    const pk = p as Record<string, unknown>;
    if (typeof pk.id !== "string" || !pk.id) throw new Error(`packet[${i}].id missing`);
    if (typeof pk.url !== "string") throw new Error(`packet[${i}].url missing`);
    // Restore null defaults for fields stripped during compression
    const record = {
      ...pk,
      statusCode:   pk.statusCode   ?? null,
      statusMessage: pk.statusMessage ?? null,
      contentType:  pk.contentType  ?? null,
      duration:     pk.duration     ?? null,
      reqBody:      pk.reqBody      ?? null,
      reqBodyType:  pk.reqBodyType  ?? null,
      resBody:      pk.resBody      ?? null,
      resBodyType:  pk.resBodyType  ?? null,
      resHeaders:   pk.resHeaders   ?? null,
      clientIp:     pk.clientIp     ?? "",
      httpVersion:  pk.httpVersion  ?? "HTTP/1.1",
      tags:         Array.isArray(pk.tags) ? pk.tags : [],
      notes:        typeof pk.notes === "string" ? pk.notes : "",
      intercepted:  Boolean(pk.intercepted),
      replayed:     Boolean(pk.replayed),
    } as unknown as PacketRecord;
    validatePacket(record, i);
    return record;
  });
}

export function validatePacket(value: unknown, index = 0): asserts value is PacketRecord {
  const fail = () => { throw new Error(`packet[${index}] invalid`); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const p = value as Record<string, unknown>;
  for (const key of ["id", "clientIp", "method", "url", "host", "path", "httpVersion", "notes"]) {
    if (typeof p[key] !== "string") fail();
  }
  if (!p.id || !Number.isSafeInteger(p.timestamp)) fail();
  for (const key of ["statusCode", "duration"]) {
    if (p[key] !== null && (typeof p[key] !== "number" || !Number.isFinite(p[key]))) fail();
  }
  for (const key of ["statusMessage", "contentType", "reqBody", "resBody"]) {
    if (p[key] !== null && typeof p[key] !== "string") fail();
  }
  for (const key of ["reqBodyType", "resBodyType"]) {
    if (![null, "text", "json", "binary"].includes(p[key] as string | null)) fail();
  }
  for (const key of ["isHttps", "intercepted", "replayed"]) {
    if (typeof p[key] !== "boolean") fail();
  }
  if (!Array.isArray(p.tags) || !p.tags.every(t => typeof t === "string")) fail();
  for (const key of ["reqHeaders", "resHeaders"]) {
    const h = p[key];
    if (h === null && key === "resHeaders") continue;
    if (!h || typeof h !== "object" || Array.isArray(h)) return fail();
    if (!Object.values(h).every(v => typeof v === "string" ||
      (Array.isArray(v) && v.every(s => typeof s === "string")))) fail();
  }
}
