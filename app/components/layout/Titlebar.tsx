import { useEffect, useRef, useState } from "react";
import { useStore } from "~/store/index";
import { IconSun, IconMoon, IconGlobe } from "~/components/icons/index";

const BROWSERS = [
  { id: "chrome", label: "Chrome" },
  { id: "whale", label: "Whale" },
  { id: "firefox", label: "Firefox" },
];

export function Titlebar() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const wsConnected = useStore((s) => s.wsConnected);
  const capturing = useStore((s) => s.capturing);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = typeof localStorage !== "undefined"
      ? localStorage.getItem("tapwire.theme") as "dark" | "light" | null
      : null;
    if (saved) setTheme(saved);
  }, [setTheme]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const dotClass = !wsConnected
    ? "live-dot reconnecting"
    : capturing
      ? "live-dot"
      : "live-dot inactive";

  const launchBrowser = async (browser: string) => {
    setPickerOpen(false);
    const r = await fetch("/api/launch-browser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ browser }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({ error: "Unknown error" })) as { error?: string };
      alert(`Failed to launch ${browser}: ${d.error ?? "Unknown error"}`);
    }
  };

  return (
    <div className="titlebar">
      <div className="titlebar-title">
        <span>Tapwire</span>
        <div className={dotClass} title={!wsConnected ? "Reconnecting..." : capturing ? "Live Capture" : "Paused"} />
        <span style={{ color: "var(--text-3)", fontWeight: 400 }}>
          {!wsConnected ? "— Reconnecting..." : capturing ? "— Live Capture" : "— Paused"}
        </span>
      </div>

      <div className="titlebar-spacer" />

      <button
        className="icon-btn"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
      >
        {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
      </button>

      <div ref={pickerRef} style={{ position: "relative" }}>
        <button
          className={`icon-btn${pickerOpen ? " active" : ""}`}
          title="Open browser with proxy"
          onClick={() => setPickerOpen((v) => !v)}
        >
          <IconGlobe size={16} />
        </button>
        {pickerOpen && (
          <div style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "var(--bg-card)",
            border: "1px solid var(--line-strong)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            padding: 4,
            zIndex: 1000,
            minWidth: 130,
          }}>
            {BROWSERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => launchBrowser(id)}
                className="context-menu-item"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
