import { useEffect } from "react";
import { useStore } from "~/store/index";
import { IconSun, IconMoon, IconGlobe } from "~/components/icons/index";

export function Titlebar() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const wsConnected = useStore((s) => s.wsConnected);
  const capturing = useStore((s) => s.capturing);

  useEffect(() => {
    const saved = typeof localStorage !== "undefined"
      ? localStorage.getItem("tapwire.theme") as "dark" | "light" | null
      : null;
    if (saved) setTheme(saved);
  }, [setTheme]);

  const dotClass = !wsConnected
    ? "live-dot reconnecting"
    : capturing
      ? "live-dot"
      : "live-dot inactive";

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

      <button
        className="icon-btn"
        title="Whale로 열기 (프록시 적용)"
        onClick={() => fetch("/api/launch-browser", { method: "POST" })}
      >
        <IconGlobe size={16} />
      </button>
    </div>
  );
}
