import { useState } from "react";
import { IconX, IconPlus } from "~/components/icons/index";

interface Props {
  headers: Record<string, string>;
  original: Record<string, string>;
  onChange: (headers: Record<string, string>) => void;
}

export function HeaderEditor({ headers, original, onChange }: Props) {
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  function updateVal(key: string, val: string) {
    onChange({ ...headers, [key]: val });
  }

  function remove(key: string) {
    const next = { ...headers };
    delete next[key];
    onChange(next);
  }

  function addHeader() {
    if (!newKey.trim()) return;
    onChange({ ...headers, [newKey.trim()]: newVal });
    setNewKey("");
    setNewVal("");
  }

  const entries = Object.entries(headers);
  const addedKeys = Object.keys(headers).filter((k) => !(k in original));
  const modifiedKeys = Object.keys(headers).filter(
    (k) => k in original && headers[k] !== original[k],
  );

  return (
    <div>
      <div className="editor-toolbar">
        <span className="count-pill">{entries.length} headers</span>
        <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
          Click any value to edit
        </span>
      </div>

      {entries.map(([key, val]) => {
        const isAdded    = addedKeys.includes(key);
        const isModified = modifiedKeys.includes(key);
        return (
          <div
            key={key}
            className={`field-row ${isAdded ? "field-added" : isModified ? "field-modified" : ""}`}
          >
            <div className="field-key">
              {isAdded    && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--m-post)", flexShrink: 0, display: "inline-block" }} />}
              {isModified && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--m-put)",  flexShrink: 0, display: "inline-block" }} />}
              {key}
            </div>
            <input
              className="field-val-input"
              value={val}
              onChange={(e) => updateVal(key, e.target.value)}
            />
            <button className="icon-btn" onClick={() => remove(key)} style={{ width: 24, height: 24, flexShrink: 0 }}>
              <IconX size={11} />
            </button>
          </div>
        );
      })}

      <div className="add-header-row">
        <input
          className="add-header-key"
          placeholder="Header name"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addHeader()}
        />
        <input
          className="add-header-val"
          placeholder="Value"
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addHeader()}
        />
        <button className="btn sm" onClick={addHeader}>
          <IconPlus size={11} /> Add
        </button>
      </div>
    </div>
  );
}
