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
    return <div className="page-container" style={{ color: "var(--text-dim)" }}>로딩 중...</div>;
  }

  const { localIp, proxyPort, uiPort } = info;
  const certUrl = `http://${localIp}:${uiPort}/api/ca`;

  return (
    <div className="page-container">
      <h1 className="page-title">모바일 설정</h1>
      <p className="page-desc">iOS/Android 기기를 Tapwire 프록시에 연결하는 방법을 안내합니다.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 860 }}>
        {/* Steps */}
        <div className="sec">
          <div className="sec-head">
            <IconPhone size={14} />
            <span className="sec-title">WiFi 프록시 설정</span>
          </div>
          <div style={{ padding: "14px 16px" }}>
            <ol style={{ paddingLeft: 18, lineHeight: 2.2 }}>
              <li style={{ fontSize: 13, color: "var(--text-2)" }}>
                모바일 기기와 PC가 <strong>같은 WiFi 네트워크</strong>에 연결되어 있는지 확인하세요.
              </li>
              <li style={{ fontSize: 13, color: "var(--text-2)" }}>
                <strong>WiFi 설정 → 프록시 → 수동</strong>으로 이동하세요.
              </li>
              <li>
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "10px 14px", marginTop: 4 }}>
                  <div className="header-row" style={{ padding: "4px 0" }}>
                    <span className="header-key">서버</span>
                    <code className="header-val">{localIp}</code>
                  </div>
                  <div className="header-row" style={{ padding: "4px 0" }}>
                    <span className="header-key">포트</span>
                    <code className="header-val">{proxyPort}</code>
                  </div>
                </div>
              </li>
              <li style={{ fontSize: 13, color: "var(--text-2)" }}>
                브라우저에서 <a href={certUrl} style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{certUrl}</a> 에 접속하세요.
              </li>
              <li style={{ fontSize: 13, color: "var(--text-2)" }}>
                CA 인증서를 설치하고 신뢰하세요:
                <ul style={{ marginTop: 4, paddingLeft: 16 }}>
                  <li><strong>iOS:</strong> 설정 → 일반 → VPN 및 기기 관리 → 신뢰</li>
                  <li><strong>Android:</strong> 설정 → 보안 → 인증서 설치</li>
                </ul>
              </li>
            </ol>
          </div>
        </div>

        {/* Info card */}
        <div className="sec">
          <div className="sec-head">
            <IconQr size={14} />
            <span className="sec-title">빠른 정보</span>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 14 }}>
              <div className="field-label" style={{ marginBottom: 8 }}>프록시 주소</div>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>
                {localIp}:{proxyPort}
              </code>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 14 }}>
              <div className="field-label" style={{ marginBottom: 8 }}>CA 인증서 URL</div>
              <a href={certUrl} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", wordBreak: "break-all" }}>
                {certUrl}
              </a>
            </div>
            <div className="tip">
              💡 기기 설정이 완료되면 Live Capture에 트래픽이 표시됩니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
