import { useState, useEffect } from "react";
import { useStore } from "~/store/index";

interface ServerConfig {
  proxyPort: number;
  sslInsecure: boolean;
  maxBodyMb: number;
}

export default function Settings() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const excludeRules = useStore((s) => s.excludeRules);
  const setExcludeRules = useStore((s) => s.setExcludeRules);

  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [rulesText, setRulesText] = useState(excludeRules.join("\n"));

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setConfig);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("tapwire.excludeRules");
    if (saved) {
      try {
        const rules = JSON.parse(saved) as string[];
        setExcludeRules(rules);
        setRulesText(rules.join("\n"));
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRulesChange(val: string) {
    setRulesText(val);
    const rules = val.split("\n").map((r) => r.trim()).filter(Boolean);
    setExcludeRules(rules);
  }

  const proxyPort = config ? String(config.proxyPort) : "…";
  const maxBodyMb = config ? String(config.maxBodyMb) : "…";
  const sslInsecure = config?.sslInsecure ?? false;

  return (
    <div className="page-container">
      <h1 className="page-title">설정</h1>
      <p className="page-desc">프록시 및 UI 동작을 설정합니다.</p>

      <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Appearance */}
        <div className="sec">
          <div className="sec-head"><span className="sec-title">테마</span></div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div className="field-label" style={{ marginBottom: 8 }}>테마 선택</div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["dark", "light"] as const).map((t) => (
                  <button
                    key={t}
                    className={`btn ${theme === t ? "primary" : ""}`}
                    onClick={() => setTheme(t)}
                  >
                    {t === "dark" ? "🌙 다크" : "☀️ 라이트"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Proxy */}
        <div className="sec">
          <div className="sec-head"><span className="sec-title">프록시</span></div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="tip" style={{ marginBottom: 4 }}>
              ⚠️ 읽기 전용입니다. 변경하려면 <code style={{ fontFamily: "var(--font-mono)", background: "var(--bg-hover)", padding: "1px 4px", borderRadius: 3 }}>.env</code> 파일에서 환경 변수를 수정 후 서버를 재시작하세요.
            </div>
            <div>
              <div className="field-label" style={{ marginBottom: 6 }}>프록시 포트 <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(PROXY_PORT)</span></div>
              <input className="field-input" value={proxyPort} readOnly style={{ width: 120, opacity: 0.6, cursor: "not-allowed" }} />
            </div>
            <div>
              <div className="field-label" style={{ marginBottom: 6 }}>최대 바디 크기 (MB) <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(MAX_BODY_SIZE_MB)</span></div>
              <input className="field-input" value={maxBodyMb} readOnly style={{ width: 120, opacity: 0.6, cursor: "not-allowed" }} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "not-allowed", opacity: 0.6 }}>
              <input type="checkbox" checked={sslInsecure} readOnly />
              <span style={{ fontSize: 13, color: "var(--text-2)" }}>업스트림 TLS 검증 비활성화 — PROXY_SSL_INSECURE=true</span>
            </label>
          </div>
        </div>

        {/* Exclude Rules */}
        <div className="sec">
          <div className="sec-head">
            <span className="sec-title">제외 규칙</span>
            <span className="sec-count">{excludeRules.length}</span>
          </div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>
              한 줄에 하나씩 입력하세요. 일치하는 패킷은 실시간 캡처 화면에서 숨겨집니다.
              와일드카드를 지원합니다 (<code style={{ fontFamily: "var(--font-mono)", background: "var(--bg-hover)", padding: "1px 4px", borderRadius: 3 }}>*</code>, <code style={{ fontFamily: "var(--font-mono)", background: "var(--bg-hover)", padding: "1px 4px", borderRadius: 3 }}>?</code>).
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
              예시: <span style={{ color: "var(--accent)" }}>*.png</span> &nbsp;·&nbsp;
              <span style={{ color: "var(--accent)" }}>/api/health</span> &nbsp;·&nbsp;
              <span style={{ color: "var(--accent)" }}>analytics.example.com</span> &nbsp;·&nbsp;
              <span style={{ color: "var(--accent)" }}>*.js</span>
            </div>
            <textarea
              className="field-input"
              value={rulesText}
              onChange={(e) => handleRulesChange(e.target.value)}
              placeholder={"*.png\n/api/health\nanalytics.example.com"}
              style={{
                width: "100%",
                height: 140,
                resize: "vertical",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            />
          </div>
        </div>

        <div className="tip">
          ⚠️ 프록시 설정 변경은 서버 재시작 후 적용됩니다.
        </div>
      </div>
    </div>
  );
}
