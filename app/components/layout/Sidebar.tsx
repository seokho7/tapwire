import { useMemo } from "react";
import { useStore } from "~/store/index";
import { NavItem } from "./NavItem";
import {
  IconActivity, IconGlobe,
  IconPhone, IconCert, IconSettings,
  IconPlay, IconPause, IconX,
  IconRules, IconWrench, IconBroom,
} from "~/components/icons/index";

export function Sidebar() {
  const packets = useStore((s) => s.packets);
  const capturing = useStore((s) => s.capturing);
  const toggleCapture = useStore((s) => s.toggleCapture);
  const filterHost = useStore((s) => s.filter.host);
  const setFilter = useStore((s) => s.setFilter);

  const uniqueHostsList = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of packets) map.set(p.host, (map.get(p.host) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([host, count]) => ({ host, count }));
  }, [packets]);

  return (
    <div className="sidebar">
      {/* Brand */}
      <div className="brand-row">
        <div className="brand-logo" style={{ background: "none", border: "1.5px solid var(--line-strong)", overflow: "hidden", padding: 0 }}>
          <img src="https://seokhoweb.com/commons/og-image.png" width="26" height="26" style={{ objectFit: "cover", objectPosition: "center", display: "block" }} alt="" />
        </div>
        <span className="brand-name">Tapwire</span>
        <span className="brand-version">v1.0.0</span>
      </div>

      {/* Capture Card */}
      <div className="capture-card">
        <div className="capture-status-row">
          <div className={`capture-status-label ${capturing ? "" : "paused"}`}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: capturing ? "var(--m-post)" : "var(--text-dim)",
              }}
            />
            {capturing ? "Capturing" : "Paused"}
          </div>
          <span className="capture-port">:8080</span>
        </div>
        <div className="capture-stats">
          <strong>{packets.length}</strong> packets,{" "}
          <strong>{uniqueHostsList.length}</strong> hosts
        </div>
        <div className="capture-toggle">
          <button className="capture-toggle-btn active" onClick={toggleCapture}>
            {capturing ? <><IconPause size={11} /> Pause</> : <><IconPlay size={11} /> Start</>}
          </button>
        </div>
      </div>

      {/* Main nav */}
      <div className="nav-section">
        <NavItem
          to="/"
          icon={<IconActivity size={14} />}
          label="Live Capture"
          badge={packets.length || undefined}
          nav="live"
        />
      </div>

      {/* Hosts */}
      {uniqueHostsList.length > 0 && (
        <div className="nav-section">
          <div className="nav-title">Hosts</div>
          <div style={{ maxHeight: uniqueHostsList.length > 10 ? 220 : "none", overflowY: uniqueHostsList.length > 10 ? "auto" : "visible" }}>
          {filterHost && (
            <button
              className="nav-item"
              style={{ width: "100%", background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 11, padding: "4px 14px", textAlign: "left" }}
              onClick={() => setFilter({ host: "" })}
            >
              ✕ Clear filter
            </button>
          )}
          {uniqueHostsList.map(({ host, count }) => (
            <div key={host} style={{ display: "flex", alignItems: "center" }}>
              <button
                className={`nav-item${filterHost === host ? " active" : ""}`}
                style={{ width: 0, flex: 1, background: "none", border: "none", cursor: "pointer", overflow: "hidden" }}
                onClick={() => setFilter({ host: filterHost === host ? "" : host })}
              >
                <span className="nav-item-icon"><IconGlobe size={13} /></span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>
                  {host}
                </span>
                <span className="nav-badge">{count}</span>
              </button>
              <button
                onClick={async () => {
                  await fetch(`/api/packets?host=${encodeURIComponent(host)}`, { method: "DELETE" });
                  useStore.getState().removePackets(
                    useStore.getState().packets.filter((p) => p.host === host).map((p) => p.id)
                  );
                  if (filterHost === host) setFilter({ host: "" });
                }}
                title={`Delete all packets from ${host}`}
                style={{ flexShrink: 0, padding: "2px 4px", background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", alignItems: "center", borderRadius: 4 }}
                className="host-delete-btn"
              >
                <IconX size={11} />
              </button>
            </div>
          ))}
          </div>
        </div>
      )}

      {/* Tools */}
      <div className="nav-section">
        <div className="nav-title">Tools</div>
        <NavItem to="/rules" icon={<IconRules size={14} />} label="Breakpoints" nav="rules" />
        <NavItem to="/setup" icon={<IconPhone size={14} />} label="Mobile Setup" nav="mobile" />
        <NavItem to="/cert" icon={<IconCert size={14} />} label="CA Certificate" nav="cert" />
      </div>

      {/* Utilities */}
      <div style={{ height: 1, background: "var(--line)", margin: "4px 4px 8px" }} />
      <div className="nav-section">
        <div className="nav-title">Utilities</div>
        <NavItem to="/utils" icon={<IconWrench size={14} />} label="Text Utils" nav="utils" />
        <div style={{ height: 1, background: "var(--line)", margin: "6px 4px" }} />
        <div style={{ padding: "4px 10px 6px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <IconBroom size={11} /> Delete Static
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {([
              { key: "all",   label: "All",   patterns: ["text/css", "application/javascript", "text/javascript", "image/", "font/", "application/font", "application/x-font"] },
              { key: "css",   label: "CSS",   patterns: ["text/css"] },
              { key: "js",    label: "JS",    patterns: ["application/javascript", "text/javascript"] },
              { key: "image", label: "Image", patterns: ["image/"] },
              { key: "font",  label: "Font",  patterns: ["font/", "application/font", "application/x-font"] },
            ] as const).map(({ key, label, patterns }) => (
              <button
                key={key}
                className="btn sm danger"
                title={`Delete all ${label} packets`}
                onClick={async () => {
                  await fetch(`/api/packets?static=${key}`, { method: "DELETE" });
                  const store = useStore.getState();
                  const toRemove = store.packets
                    .filter((p) => p.contentType && patterns.some((t) => p.contentType!.includes(t)))
                    .map((p) => p.id);
                  store.removePackets(toRemove);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="sidebar-bottom">
        <NavItem to="/settings" icon={<IconSettings size={14} />} label="Settings" nav="settings" />
      </div>
    </div>
  );
}
