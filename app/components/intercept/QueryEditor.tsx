import { IconX } from "~/components/icons/index";

interface Props {
  url: string;
  onChange: (url: string) => void;
}

export function QueryEditor({ url, onChange }: Props) {
  let parsed: URL | null = null;
  try { parsed = new URL(url); } catch { /* ignore */ }
  const params = parsed ? [...parsed.searchParams.entries()] : [];

  function updateParam(idx: number, key: string, val: string) {
    if (!parsed) return;
    const arr = [...parsed.searchParams.entries()];
    arr[idx] = [key, val];
    const sp = new URLSearchParams(arr);
    parsed.search = sp.toString();
    onChange(parsed.toString());
  }

  function removeParam(idx: number) {
    if (!parsed) return;
    const arr = [...parsed.searchParams.entries()];
    arr.splice(idx, 1);
    const sp = new URLSearchParams(arr);
    parsed.search = sp.toString();
    onChange(parsed.toString());
  }

  if (params.length === 0) {
    return (
      <div className="modal-section">
        <div style={{ color: "var(--text-dim)", fontSize: 12, textAlign: "center", padding: "20px 0" }}>
          No query parameters
        </div>
      </div>
    );
  }

  return (
    <div>
      {params.map(([key, val], idx) => (
        <div key={idx} className="field-row">
          <input
            className="field-val-input"
            style={{ width: 160, minWidth: 160, flex: "none" }}
            value={key}
            onChange={(e) => updateParam(idx, e.target.value, val)}
          />
          <input
            className="field-val-input"
            value={val}
            onChange={(e) => updateParam(idx, key, e.target.value)}
          />
          <button className="icon-btn" onClick={() => removeParam(idx)} style={{ width: 24, height: 24 }}>
            <IconX size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}
