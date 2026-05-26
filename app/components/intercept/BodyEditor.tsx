import { useState } from "react";

interface Props {
  body: string;
  contentType: string | null;
  onChange: (body: string) => void;
}

export function BodyEditor({ body, contentType, onChange }: Props) {
  const [formatError, setFormatError] = useState("");

  function formatJson() {
    try {
      const parsed = JSON.parse(body);
      onChange(JSON.stringify(parsed, null, 2));
      setFormatError("");
    } catch {
      setFormatError("Invalid JSON");
    }
  }

  const lines = body.split("\n").length;

  return (
    <div>
      <div className="editor-toolbar">
        {contentType && (
          <span className="count-pill">{contentType.split(";")[0]}</span>
        )}
        <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{lines} lines</span>
        {formatError && (
          <span style={{ fontSize: 11.5, color: "var(--s-5xx)" }}>{formatError}</span>
        )}
        {contentType?.includes("json") && (
          <button className="btn ghost sm" onClick={formatJson} style={{ marginLeft: "auto" }}>
            Format JSON
          </button>
        )}
      </div>
      <textarea
        className="body-viewer"
        style={{
          width: "100%",
          minHeight: 200,
          resize: "vertical",
          border: "none",
          outline: "none",
          background: "var(--bg-card)",
          lineHeight: 1.6,
        }}
        value={body}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}
