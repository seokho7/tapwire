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

function parseHexBytes(text: string): Uint8Array {
  const cleaned = text.trim().replace(/\s+/g, "");
  const bytes: number[] = [];
  if (cleaned.includes("%")) {
    const parts = cleaned.split("%").filter(Boolean);
    for (const p of parts) bytes.push(parseInt(p.slice(0, 2), 16));
  } else {
    for (let i = 0; i + 1 < cleaned.length; i += 2) {
      bytes.push(parseInt(cleaned.slice(i, i + 2), 16));
    }
  }
  return new Uint8Array(bytes);
}

function HexConverter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"euckr" | "utf8">("euckr");

  const convert = async () => {
    if (!input.trim()) return;
    setError("");
    setOutput("");

    if (mode === "utf8") {
      try {
        const bytes = parseHexBytes(input);
        const result = new TextDecoder("utf-8").decode(bytes);
        setOutput(result);
      } catch (e) {
        setError((e as Error).message);
      }
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/utils/euckr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, direction: "from" }),
      });
      const data = await r.json() as { result?: string; error?: string };
      if (data.error) setError(data.error);
      else setOutput(data.result ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section title="HEX → Text">
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>Encoding:</span>
        <button
          className="btn sm"
          style={mode === "euckr" ? { background: "var(--accent-soft)", borderColor: "var(--accent-line)", color: "var(--accent)" } : {}}
          onClick={() => setMode("euckr")}
        >
          EUC-KR
        </button>
        <button
          className="btn sm"
          style={mode === "utf8" ? { background: "var(--accent-soft)", borderColor: "var(--accent-line)", color: "var(--accent)" } : {}}
          onClick={() => setMode("utf8")}
        >
          UTF-8
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
        <TextArea
          value={input}
          onChange={setInput}
          placeholder="Hex bytes: B0A1B3AA or %B0%A1%B3%AA or B0 A1 B3 AA..."
        />
        <button className="btn" onClick={convert} disabled={loading}>
          {loading ? "..." : "Decode →"}
        </button>
        <TextArea value={output} readOnly placeholder={mode === "euckr" ? "Korean text (EUC-KR decoded)" : "Text (UTF-8 decoded)"} />
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
        <HexConverter />
        <UrlConverter />
        <SplitConverter />
      </div>
    </div>
  );
}
