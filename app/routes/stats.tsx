import { useEffect, useState } from "react";
import { IconStats } from "~/components/icons/index";

export function meta() {
  return [{ title: "Stats — Tapwire" }];
}

interface StatsData {
  totalRequests: number;
  activeConnections: number;
  requestsPerMinute: number;
  topHosts: Array<{ host: string; count: number }>;
}

export default function Stats() {
  const [data, setData] = useState<StatsData | null>(null);

  useEffect(() => {
    function load() {
      fetch("/api/stats")
        .then((r) => r.json())
        .then(setData)
        .catch(() => {});
    }
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <div className="page-container" style={{ color: "var(--text-dim)" }}>Loading...</div>;

  const maxCount = data.topHosts[0]?.count ?? 1;

  return (
    <div className="page-container">
      <h1 className="page-title">Stats</h1>
      <p className="page-desc">Live proxy statistics. Refreshes every 5 seconds.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20, maxWidth: 700 }}>
        {[
          { label: "Total Requests", value: data.totalRequests },
          { label: "Active Connections", value: data.activeConnections },
          { label: "Requests / min", value: data.requestsPerMinute },
        ].map(({ label, value }) => (
          <div key={label} className="sec" style={{ margin: 0, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: 8 }}>{label}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>{value}</div>
          </div>
        ))}
      </div>

      {data.topHosts.length > 0 && (
        <div className="sec" style={{ maxWidth: 600 }}>
          <div className="sec-head">
            <IconStats size={14} />
            <span className="sec-title">Top Hosts</span>
          </div>
          <div>
            {data.topHosts.map(({ host, count }) => (
              <div key={host} style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-1)" }}>{host}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>{count}</span>
                </div>
                <div style={{ height: 4, background: "var(--bg-elev)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(count / maxCount) * 100}%`, background: "var(--accent)", borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
