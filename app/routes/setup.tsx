import { useEffect, useState } from "react";
import { IconPhone, IconQr } from "~/components/icons/index";

interface SetupInfo {
  localIp: string;
  proxyPort: number;
  uiPort: number;
}

export default function Setup() {
  const [info, setInfo] = useState<SetupInfo | null>(null);

  useEffect(() => {
    fetch("/api/setup").then((r) => r.json()).then(setInfo);
  }, []);

  if (!info) {
    return <div className="page-container" style={{ color: "var(--text-dim)" }}>Loading...</div>;
  }

  const { localIp, proxyPort, uiPort } = info;
  const certUrl = `http://${localIp}:${uiPort}/api/ca`;

  return (
    <div className="page-container">
      <h1 className="page-title">Mobile Setup</h1>
      <p className="page-desc">Connect your iOS/Android device to the Tapwire proxy.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 860 }}>
        {/* Steps */}
        <div className="sec">
          <div className="sec-head">
            <IconPhone size={14} />
            <span className="sec-title">WiFi Proxy Configuration</span>
          </div>
          <div style={{ padding: "14px 16px" }}>
            <ol style={{ paddingLeft: 18, lineHeight: 2.2 }}>
              <li style={{ fontSize: 13, color: "var(--text-2)" }}>
                Make sure your mobile device and PC are on the <strong>same WiFi network</strong>.
              </li>
              <li style={{ fontSize: 13, color: "var(--text-2)" }}>
                Go to <strong>WiFi Settings → Proxy → Manual</strong>.
              </li>
              <li>
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "10px 14px", marginTop: 4 }}>
                  <div className="header-row" style={{ padding: "4px 0" }}>
                    <span className="header-key">Server</span>
                    <code className="header-val">{localIp}</code>
                  </div>
                  <div className="header-row" style={{ padding: "4px 0" }}>
                    <span className="header-key">Port</span>
                    <code className="header-val">{proxyPort}</code>
                  </div>
                </div>
              </li>
              <li style={{ fontSize: 13, color: "var(--text-2)" }}>
                Open <a href={certUrl} style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{certUrl}</a> in the device browser.
              </li>
              <li style={{ fontSize: 13, color: "var(--text-2)" }}>
                Install and trust the CA certificate:
                <ul style={{ marginTop: 4, paddingLeft: 16 }}>
                  <li><strong>iOS:</strong> Settings → General → VPN & Device Management → Trust</li>
                  <li><strong>Android:</strong> Settings → Security → Install Certificate</li>
                </ul>
              </li>
            </ol>
          </div>
        </div>

        {/* Info card */}
        <div className="sec">
          <div className="sec-head">
            <IconQr size={14} />
            <span className="sec-title">Quick Info</span>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 14 }}>
              <div className="field-label" style={{ marginBottom: 8 }}>Proxy Address</div>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>
                {localIp}:{proxyPort}
              </code>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 14 }}>
              <div className="field-label" style={{ marginBottom: 8 }}>CA Certificate URL</div>
              <a href={certUrl} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", wordBreak: "break-all" }}>
                {certUrl}
              </a>
            </div>
            <div className="tip">
              💡 Once your device is configured, traffic will appear in Live Capture.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
