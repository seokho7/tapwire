import type { ProxyServer } from "./proxy/proxyServer.js";
import type { PacketRepository } from "./storage/repository.js";
import type { WsBroadcaster } from "./ws/broadcaster.js";
import type { PauseRegistry } from "./proxy/interceptor.js";

interface Registry {
  proxy: ProxyServer | null;
  repo: PacketRepository | null;
  broadcaster: WsBroadcaster | null;
  pauser: PauseRegistry | null;
}

// Use globalThis to share across ESM module contexts (server.ts vs built bundle)
const g = globalThis as typeof globalThis & { __tapwire_registry?: Registry };

if (!g.__tapwire_registry) {
  g.__tapwire_registry = { proxy: null, repo: null, broadcaster: null, pauser: null };
}

export const registry = g.__tapwire_registry;
