import { create } from "zustand";
import type { PacketRecord } from "~/types";

function globMatchUrl(pattern: string, url: string): boolean {
  const re = new RegExp(pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, "."));
  return re.test(url);
}

function matchesExcludeRule(packet: PacketSummary, rule: string): boolean {
  const p = rule.trim().toLowerCase();
  if (!p) return false;
  const url = packet.url.toLowerCase();
  if (!p.includes("*") && !p.includes("?")) return url.includes(p);
  return globMatchUrl(p, url);
}

export interface PacketSummary {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  host: string;
  path: string;
  statusCode: number | null;
  statusMessage: string | null;
  contentType: string | null;
  duration: number | null;
  isHttps: boolean;
  tags: string[];
  intercepted: boolean;
  replayed: boolean;
}

export interface PacketFilter {
  method: "all" | string;
  status: Set<string>;
  search: string;
  host: string;
}

interface InterceptState {
  packet: PacketRecord | null;
  deadlineMs: number;
}

interface AppStore {
  // Packets
  packets: PacketSummary[];
  selectedId: string | null;
  filter: PacketFilter;
  capturing: boolean;

  // Packet colors
  packetColors: Record<string, string>;

  // Multi-select
  selectedIdsMap: Record<string, true>;
  anchorId: string | null;
  visibleIds: string[];

  // Context menu
  contextMenu: { packetId: string; x: number; y: number } | null;
  pendingOpenIntercept: string | null;

  // WebSocket state
  wsConnected: boolean;

  // Intercept
  intercept: InterceptState;

  // UI
  theme: "dark" | "light";
  activeNav: string;
  excludeRules: string[];

  // Actions
  setPacketColor: (id: string, color: string | null) => void;
  addPacket: (p: PacketSummary) => void;
  updatePacket: (p: PacketSummary) => void;
  selectPacket: (id: string | null) => void;
  toggleSelectId: (id: string) => void;
  rangeSelectIds: (toId: string) => void;
  clearMultiSelect: () => void;
  removePackets: (ids: string[]) => void;
  setVisibleIds: (ids: string[]) => void;
  openContextMenu: (packetId: string, x: number, y: number) => void;
  closeContextMenu: () => void;
  setPendingOpenIntercept: (id: string | null) => void;
  setFilter: (f: Partial<PacketFilter>) => void;
  toggleCapture: () => void;
  clearPackets: () => void;
  setWsConnected: (connected: boolean) => void;
  openIntercept: (packet: PacketRecord, deadlineMs: number) => void;
  closeIntercept: () => void;
  setTheme: (t: "dark" | "light") => void;
  setActiveNav: (nav: string) => void;
  setExcludeRules: (rules: string[]) => void;
}

function loadPacketColors(): Record<string, string> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("tapwire.packetColors") : null;
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export const useStore = create<AppStore>((set, get) => ({
  packets: [],
  selectedId: null,
  filter: { method: "all", status: new Set(), search: "", host: "" },
  capturing: true,
  wsConnected: false,
  intercept: { packet: null, deadlineMs: 0 },
  theme: "dark",
  activeNav: "live",
  excludeRules: [],
  selectedIdsMap: {},
  anchorId: null,
  visibleIds: [],
  contextMenu: null,
  pendingOpenIntercept: null,
  packetColors: loadPacketColors(),

  setPacketColor: (id, color) =>
    set((s) => {
      const next = { ...s.packetColors };
      if (color) next[id] = color; else delete next[id];
      if (typeof localStorage !== "undefined") localStorage.setItem("tapwire.packetColors", JSON.stringify(next));
      return { packetColors: next };
    }),

  addPacket: (p) =>
    set((s) => {
      if (!s.capturing || s.packets.some((x) => x.id === p.id)) return s;
      return { packets: [...s.packets, p].slice(-5000) };
    }),

  updatePacket: (p) =>
    set((s) => ({
      packets: s.packets.map((x) => (x.id === p.id ? p : x)),
    })),

  selectPacket: (id) =>
    set({ selectedId: id, selectedIdsMap: {}, anchorId: id ?? null }),

  toggleSelectId: (id) =>
    set((s) => {
      const next = { ...s.selectedIdsMap };
      if (next[id]) delete next[id]; else next[id] = true;
      return { selectedIdsMap: next, anchorId: id };
    }),

  rangeSelectIds: (toId) =>
    set((s) => {
      const ids = s.visibleIds;
      const anchor = s.anchorId;
      if (!anchor) return { selectedIdsMap: { [toId]: true }, anchorId: toId };
      const ai = ids.indexOf(anchor);
      const bi = ids.indexOf(toId);
      if (ai === -1 || bi === -1) return s;
      const [lo, hi] = [Math.min(ai, bi), Math.max(ai, bi)];
      const next: Record<string, true> = {};
      for (let i = lo; i <= hi; i++) next[ids[i]] = true;
      return { selectedIdsMap: next };
    }),

  clearMultiSelect: () => set({ selectedIdsMap: {}, anchorId: null }),

  removePackets: (ids) =>
    set((s) => {
      const set2 = new Set(ids);
      const next = { ...s.selectedIdsMap };
      ids.forEach((id) => delete next[id]);
      return {
        packets: s.packets.filter((p) => !set2.has(p.id)),
        selectedId: s.selectedId && set2.has(s.selectedId) ? null : s.selectedId,
        selectedIdsMap: next,
      };
    }),

  setVisibleIds: (visibleIds) => set({ visibleIds }),

  openContextMenu: (packetId, x, y) => set({ contextMenu: { packetId, x, y } }),

  closeContextMenu: () => set({ contextMenu: null }),

  setPendingOpenIntercept: (id) => set({ pendingOpenIntercept: id }),

  setFilter: (f) =>
    set((s) => ({ filter: { ...s.filter, ...f } })),

  toggleCapture: () => set((s) => ({ capturing: !s.capturing })),

  clearPackets: () => set({ packets: [], selectedId: null, selectedIdsMap: {}, anchorId: null }),

  setWsConnected: (connected) => set({ wsConnected: connected }),

  openIntercept: (packet: PacketRecord, deadlineMs: number) =>
    set({ intercept: { packet, deadlineMs } }),

  closeIntercept: () =>
    set({ intercept: { packet: null, deadlineMs: 0 } }),

  setTheme: (theme) => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("tapwire.theme", theme);
    }
    set({ theme });
  },

  setActiveNav: (activeNav) => set({ activeNav }),

  setExcludeRules: (excludeRules) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("tapwire.excludeRules", JSON.stringify(excludeRules));
    }
    set({ excludeRules });
  },
}));

export function getFilteredPackets(packets: PacketSummary[], filter: PacketFilter, excludeRules: string[] = []): PacketSummary[] {
  return packets.filter((p) => {
    if (excludeRules.length > 0 && excludeRules.some((r) => matchesExcludeRule(p, r))) return false;
    if (filter.method !== "all" && p.method !== filter.method) return false;
    if (filter.status.size > 0) {
      const bucket = p.statusCode ? Math.floor(p.statusCode / 100) + "xx" : null;
      if (!bucket || !filter.status.has(bucket)) return false;
    }
    if (filter.host && !p.host.includes(filter.host)) return false;
    if (filter.search) {
      const s = filter.search.toLowerCase();
      if (!p.url.toLowerCase().includes(s) && !p.host.toLowerCase().includes(s)) return false;
    }
    return true;
  });
}
