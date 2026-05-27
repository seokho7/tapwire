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
    return {
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
  });
}
