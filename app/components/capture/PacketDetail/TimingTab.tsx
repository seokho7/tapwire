import type { PacketRecord } from "~/types";

interface Props {
  packet: PacketRecord;
}

const SEGMENTS = [
  { label: "DNS Lookup", color: "#5B8DEF",  key: "dns" },
  { label: "TCP Connect", color: "#2DD4A7", key: "tcp" },
  { label: "TLS Handshake", color: "#B084EE", key: "tls" },
  { label: "Sending",  color: "#E0A24A",   key: "send" },
  { label: "Waiting (TTFB)", color: "#777E89", key: "wait" },
  { label: "Receiving", color: "#EF6E6E",  key: "recv" },
];

export function TimingTab({ packet }: Props) {
  const total = packet.duration ?? 0;

  // Approximate: most time in TTFB
  const times: Record<string, number> = {
    dns:  0,
    tcp:  0,
    tls:  packet.isHttps ? Math.round(total * 0.1) : 0,
    send: 0,
    wait: Math.round(total * (packet.isHttps ? 0.85 : 0.95)),
    recv: Math.round(total * 0.05),
  };

  return (
    <div className="sec" style={{ overflow: "visible" }}>
      <div className="sec-head">
        <span className="sec-title">Timing</span>
        <span className="sec-count">{total} ms total</span>
      </div>
      {SEGMENTS.map(({ label, color, key }) => {
        const ms = times[key] ?? 0;
        const pct = total > 0 ? (ms / total) * 100 : 0;
        return (
          <div key={key} className="timing-row">
            <span className="timing-label">{label}</span>
            <div className="timing-bar-wrap">
              <div
                className="timing-bar"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
            <span className="timing-ms">{ms} ms</span>
          </div>
        );
      })}
    </div>
  );
}
