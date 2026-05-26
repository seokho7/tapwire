import { useEffect, useRef, useState } from "react";
import { useStore } from "~/store/index";
import { IconRefresh, IconEdit, IconTrash, IconX, IconPause } from "~/components/icons/index";
import type { PacketSummary } from "~/store/index";

interface BreakpointRule { id: string; pattern: string; method?: string; enabled: boolean; }

const COLOR_SWATCHES = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#a855f7", "#ec4899",
];

export function ContextMenu() {
  const [matchingBpId, setMatchingBpId] = useState<string | null>(null);
  const contextMenu = useStore((s) => s.contextMenu);
  const closeContextMenu = useStore((s) => s.closeContextMenu);
  const selectPacket = useStore((s) => s.selectPacket);
  const removePackets = useStore((s) => s.removePackets);
  const setPendingOpenIntercept = useStore((s) => s.setPendingOpenIntercept);
  const setPacketColor = useStore((s) => s.setPacketColor);
  const packetColors = useStore((s) => s.packetColors);
  const packets = useStore((s) => s.packets);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) { setMatchingBpId(null); return; }
    const p = packets.find((x: PacketSummary) => x.id === contextMenu.packetId);
    if (!p) { setMatchingBpId(null); return; }
    const target = p.host + p.path.split("?")[0];
    fetch("/api/breakpoints")
      .then(r => r.json())
      .then((rules: BreakpointRule[]) => {
        const match = rules.find(r => target.includes(r.pattern) || r.pattern.includes(target));
        setMatchingBpId(match?.id ?? null);
      })
      .catch(() => setMatchingBpId(null));
  }, [contextMenu, packets]);

  useEffect(() => {
    if (!contextMenu) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeContextMenu();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [contextMenu, closeContextMenu]);

  if (!contextMenu) return null;

  const { packetId, x, y } = contextMenu;
  const packet = packets.find((p: PacketSummary) => p.id === packetId);

  async function handleReplay() {
    closeContextMenu();
    await fetch(`/api/replay/${packetId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  }

  function handleEditSend() {
    closeContextMenu();
    selectPacket(packetId);
    setPendingOpenIntercept(packetId);
  }

  async function handleRemove() {
    closeContextMenu();
    await fetch(`/api/packets/${packetId}`, { method: "DELETE" });
    removePackets([packetId]);
  }

  async function handleToggleBreakpoint() {
    closeContextMenu();
    if (!packet) return;
    if (matchingBpId) {
      await fetch(`/api/breakpoints/${matchingBpId}`, { method: "DELETE" });
    } else {
      const pattern = packet.host + packet.path.split("?")[0];
      await fetch("/api/breakpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern }),
      });
    }
  }

  const currentColor = packetColors[packetId] ?? null;

  // Clamp to viewport
  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;
  const menuW = 172;
  const menuH = 176;
  const cx = x + menuW > vw ? vw - menuW - 8 : x;
  const cy = y + menuH > vh ? vh - menuH - 8 : y;

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: cx, top: cy }}
    >
      <button className="context-menu-item" onClick={handleReplay}>
        <IconRefresh size={13} /> Replay
      </button>
      <button className="context-menu-item" onClick={handleEditSend}>
        <IconEdit size={13} /> Edit &amp; Send
      </button>
      <button className="context-menu-item" onClick={handleToggleBreakpoint} style={matchingBpId ? { color: "var(--m-put, #f97316)" } : {}}>
        <IconPause size={13} /> {matchingBpId ? "Remove Breakpoint" : "Set Breakpoint"}
      </button>
      <div className="context-menu-sep" />
      <div className="context-menu-color-row">
        {COLOR_SWATCHES.map((color) => (
          <button
            key={color}
            className={`color-swatch${currentColor === color ? " active" : ""}`}
            style={{ background: color }}
            onClick={() => { setPacketColor(packetId, currentColor === color ? null : color); closeContextMenu(); }}
            title={color}
          />
        ))}
        <button
          className={`color-swatch clear${!currentColor ? " active" : ""}`}
          onClick={() => { setPacketColor(packetId, null); closeContextMenu(); }}
          title="색상 제거"
        >
          <IconX size={9} />
        </button>
      </div>
      <div className="context-menu-sep" />
      <button className="context-menu-item danger" onClick={handleRemove}>
        <IconTrash size={13} /> Remove
      </button>
    </div>
  );
}
