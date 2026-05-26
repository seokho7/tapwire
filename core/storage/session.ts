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
  return d.packets as PacketRecord[];
}
