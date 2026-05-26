import { useState, useEffect } from "react";
import type { PacketSummary } from "~/store/index";
import { MethodBadge } from "~/components/ui/MethodBadge";
import { IconReplay, IconPlus, IconX } from "~/components/icons/index";
import { fmtDur } from "~/utils/format";

export function meta() {
  return [{ title: "Replay — Tapwire" }];
}

interface ReplayResult {
  id: string;
  url: string;
  statusCode: number;
  duration: number;
}

export default function Replay() {
  const [packets, setPackets] = useState<PacketSummary[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [results, setResults] = useState<ReplayResult[]>([]);
  const [replaying, setReplaying] = useState(false);

  useEffect(() => {
    fetch("/api/packets?limit=200")
      .then((r) => r.json())
      .then((d) => setPackets(d.items ?? []));
  }, []);

  function addToQueue(id: string) {
    if (!queue.includes(id)) setQueue([...queue, id]);
  }

  function removeFromQueue(id: string) {
    setQueue(queue.filter((q) => q !== id));
  }

  async function runReplay() {
    setReplaying(true);
    setResults([]);
    for (const id of queue) {
      try {
        const r = await fetch(`/api/replay/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const data = await r.json() as { replayId: string; statusCode: number; duration: number };
        const pkt = packets.find((p) => p.id === id);
        setResults((prev) => [...prev, { id, url: pkt?.url ?? id, statusCode: data.statusCode, duration: data.duration }]);
      } catch {
        setResults((prev) => [...prev, { id, url: id, statusCode: 0, duration: 0 }]);
      }
    }
    setReplaying(false);
  }

  return (
    <div className="page-container">
      <h1 className="page-title">Replay</h1>
      <p className="page-desc">Build a sequence and re-send packets in order.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Packet picker */}
        <div className="sec">
          <div className="sec-head">
            <span className="sec-title">Select Packets</span>
            <span className="sec-count">{packets.length}</span>
          </div>
          {packets.length > 100 && (
            <div style={{ padding: "6px 14px", fontSize: 11, color: "var(--text-dim)", borderBottom: "1px solid var(--line)" }}>
              Showing 100 of {packets.length} packets
            </div>
          )}
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {packets.slice(0, 100).map((p) => (
              <div key={p.id} className="packet-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: "1px solid var(--line)", cursor: "pointer" }}
                onClick={() => addToQueue(p.id)}>
                <MethodBadge method={p.method} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.host}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.path}</div>
                </div>
                <button className="icon-btn" style={{ flexShrink: 0 }}>
                  <IconPlus size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Queue */}
        <div className="sec">
          <div className="sec-head">
            <span className="sec-title">Replay Queue</span>
            <span className="sec-count">{queue.length}</span>
            <button
              className="btn primary sm"
              style={{ marginLeft: "auto" }}
              onClick={runReplay}
              disabled={queue.length === 0 || replaying}
            >
              <IconReplay size={12} /> {replaying ? "Running..." : "Run Sequence"}
            </button>
          </div>
          <div>
            {queue.length === 0 ? (
              <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 12, textAlign: "center" }}>
                Click packets to add to queue
              </div>
            ) : (
              queue.map((id, idx) => {
                const p = packets.find((x) => x.id === id);
                const result = results.find((r) => r.id === id);
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: "1px solid var(--line)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", width: 20 }}>{idx + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p?.host ?? id}</div>
                      {result && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--s-2xx)" }}>
                          → {result.statusCode} · {fmtDur(result.duration)}
                        </div>
                      )}
                    </div>
                    <button className="icon-btn" onClick={() => removeFromQueue(id)}>
                      <IconX size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
