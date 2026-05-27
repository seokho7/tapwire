import { useState } from "react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sec" style={{ marginBottom: 16 }}>
      <div className="sec-head">
        <span className="sec-title">{title}</span>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function TextArea({ value, onChange, placeholder, readOnly }: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{
        width: "100%",
        height: 140,
        padding: "8px 10px",
        background: "var(--bg-elev)",
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--r-md)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "var(--text-1)",
        outline: "none",
        resize: "none",
        boxSizing: "border-box",
      }}
    />
  );
}

function EuckrConverter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [direction, setDirection] = useState<"to" | "from">("to");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const convert = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/utils/euckr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, direction }),
      });
      const data = await r.json() as { result?: string; error?: string };
      if (data.error) { setError(data.error); setOutput(""); }
      else setOutput(data.result ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section title="UTF-8 ↔ EUC-KR">
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <button
          className={`btn sm${direction === "to" ? " active" : ""}`}
          style={direction === "to" ? { background: "var(--accent-soft)", borderColor: "var(--accent-line)", color: "var(--accent)" } : {}}
          onClick={() => setDirection("to")}
        >
          UTF-8 → EUC-KR
        </button>
        <button
          className={`btn sm${direction === "from" ? " active" : ""}`}
          style={direction === "from" ? { background: "var(--accent-soft)", borderColor: "var(--accent-line)", color: "var(--accent)" } : {}}
          onClick={() => setDirection("from")}
        >
          EUC-KR → UTF-8
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
        <TextArea
          value={input}
          onChange={setInput}
          placeholder={direction === "to" ? "Korean UTF-8 text..." : "%B0%A1%B3%AA%B4%D9 (percent-encoded EUC-KR)..."}
        />
        <button className="btn" onClick={convert} disabled={loading} style={{  }}>
          {loading ? "..." : "Convert"}
        </button>
        <TextArea value={output} readOnly placeholder="Result" />
      </div>
      {error && <div style={{ color: "var(--m-delete)", fontSize: 12, marginTop: 6 }}>{error}</div>}
    </Section>
  );
}

function UrlConverter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");

  const convert = () => {
    try {
      setOutput(mode === "encode" ? encodeURIComponent(input) : decodeURIComponent(input));
    } catch {
      setOutput("Error: invalid input");
    }
  };

  return (
    <Section title="URL Encode / Decode">
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <button
          className="btn sm"
          style={mode === "encode" ? { background: "var(--accent-soft)", borderColor: "var(--accent-line)", color: "var(--accent)" } : {}}
          onClick={() => setMode("encode")}
        >
          Encode
        </button>
        <button
          className="btn sm"
          style={mode === "decode" ? { background: "var(--accent-soft)", borderColor: "var(--accent-line)", color: "var(--accent)" } : {}}
          onClick={() => setMode("decode")}
        >
          Decode
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
        <TextArea value={input} onChange={setInput} placeholder="Input text..." />
        <button className="btn" onClick={convert} style={{  }}>
          {mode === "encode" ? "Encode →" : "Decode →"}
        </button>
        <TextArea value={output} readOnly placeholder="Result" />
      </div>
    </Section>
  );
}

function SplitConverter() {
  const [input, setInput] = useState("");
  const [delimiter, setDelimiter] = useState("&");
  const [output, setOutput] = useState("");

  const convert = () => {
    if (!delimiter) return;
    setOutput(input.split(delimiter).join("\n" + delimiter));
  };

  return (
    <Section title="Split & Newline">
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>Delimiter:</span>
        <input
          value={delimiter}
          onChange={(e) => setDelimiter(e.target.value)}
          style={{
            width: 120,
            padding: "4px 8px",
            background: "var(--bg-elev)",
            border: "1px solid var(--line-strong)",
            borderRadius: "var(--r-sm)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-1)",
            outline: "none",
          }}
          placeholder=","
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
        <TextArea value={input} onChange={setInput} placeholder="Text to split..." />
        <button className="btn" onClick={convert} style={{  }}>Split →</button>
        <TextArea value={output} readOnly placeholder="Result (one per line)" />
      </div>
    </Section>
  );
}

export default function Utils() {
  return (
    <div className="page-container">
      <h1 className="page-title">Text Utils</h1>
      <p className="page-desc">Encoding conversion and string manipulation tools.</p>
      <div style={{ maxWidth: 860 }}>
        <EuckrConverter />
        <UrlConverter />
        <SplitConverter />
      </div>
    </div>
  );
}
