import { getMethodColor, getMethodBg } from "~/utils/format";

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"];

interface Props {
  method: string;
  url: string;
  onMethodChange: (m: string) => void;
  onPathChange: (p: string) => void;
}

export function UrlEditor({ method, url, onMethodChange, onPathChange }: Props) {
  let parsed: URL | null = null;
  try { parsed = new URL(url); } catch { /* ignore */ }

  return (
    <div className="modal-section">
      <div className="field-label" style={{ marginBottom: 12 }}>Method</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {METHODS.map((m) => (
          <button
            key={m}
            className={`chip ${method === m ? "active" : ""}`}
            style={method === m ? { color: getMethodColor(m), background: getMethodBg(m), borderColor: getMethodColor(m) + "40" } : {}}
            onClick={() => onMethodChange(m)}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="field-label">Scheme &amp; Host</div>
      <input
        className="field-input"
        style={{ marginBottom: 12 }}
        value={parsed ? `${parsed.protocol}//${parsed.host}` : url}
        readOnly
      />

      <div className="field-label">Path</div>
      <input
        className="field-input"
        value={parsed ? parsed.pathname + parsed.search : ""}
        onChange={(e) => {
          if (!parsed) return;
          const newUrl = `${parsed.protocol}//${parsed.host}${e.target.value}`;
          onPathChange(newUrl);
        }}
      />

      <div className="tip">
        💡 Host is read-only. Modify path and query string here.
      </div>
    </div>
  );
}
