import { IconCert, IconDownload } from "~/components/icons/index";

export function meta() {
  return [{ title: "CA Certificate — Tapwire" }];
}

export default function Cert() {
  return (
    <div className="page-container">
      <h1 className="page-title">CA Certificate</h1>
      <p className="page-desc">Install this certificate to inspect HTTPS traffic.</p>

      <div style={{ maxWidth: 600 }}>
        <div className="sec">
          <div className="sec-head">
            <IconCert size={14} />
            <span className="sec-title">Tapwire CA Certificate</span>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
              Tapwire generates a local CA certificate to decrypt HTTPS traffic.
              This certificate is stored on your machine only and is never shared.
            </p>
            <a href="/api/ca" download="tapwire-ca.crt" className="btn primary" style={{ display: "inline-flex", width: "fit-content", textDecoration: "none" }}>
              <IconDownload size={14} /> Download CA Certificate
            </a>
          </div>
        </div>

        <div className="sec">
          <div className="sec-head">
            <span className="sec-title">Installation Guide</span>
          </div>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              {
                os: "macOS",
                steps: ["Open Keychain Access", "Drag the .crt file into System keychain", "Double-click → Trust → Always Trust"],
              },
              {
                os: "Windows",
                steps: ["Double-click the .crt file", "Install Certificate → Local Machine", "Place in Trusted Root Certification Authorities"],
              },
              {
                os: "Firefox",
                steps: ["Settings → Privacy & Security → Certificates", "View Certificates → Authorities → Import", "Select .crt and trust for websites"],
              },
              {
                os: "iOS",
                steps: ["Open the .crt URL on device", "Install in Settings", "Settings → General → VPN & Device Management → Trust"],
              },
              {
                os: "Android",
                steps: ["Download the .crt file", "Settings → Security → Install certificate", "Choose CA certificate"],
              },
            ].map(({ os, steps }) => (
              <div key={os}>
                <div className="field-label" style={{ marginBottom: 6 }}>{os}</div>
                <ol style={{ paddingLeft: 16, lineHeight: 1.8 }}>
                  {steps.map((s) => (
                    <li key={s} style={{ fontSize: 12.5, color: "var(--text-2)" }}>{s}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
