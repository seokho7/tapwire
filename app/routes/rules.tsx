import { useState, useEffect } from "react";
import { IconPlus, IconX } from "~/components/icons/index";

interface Rule {
  id: string;
  pattern: string;
  method?: string;
  enabled: boolean;
}

export function meta() {
  return [{ title: "Intercept Rules — Tapwire" }];
}

export default function Rules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [pattern, setPattern] = useState("");
  const [method, setMethod] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/breakpoints")
      .then(r => r.json())
      .then((data: Rule[]) => { setRules(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function addRule() {
    if (!pattern.trim()) return;
    const res = await fetch("/api/breakpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pattern: pattern.trim(), method: method || undefined }),
    });
    if (!res.ok) return;
    const rule = await res.json() as Rule;
    setRules(prev => [...prev, rule]);
    setPattern("");
    setMethod("");
  }

  async function removeRule(id: string) {
    await fetch(`/api/breakpoints/${id}`, { method: "DELETE" });
    setRules(prev => prev.filter(r => r.id !== id));
  }

  async function toggleRule(id: string) {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    const res = await fetch(`/api/breakpoints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    if (!res.ok) return;
    const updated = await res.json() as Rule;
    setRules(prev => prev.map(r => r.id === id ? updated : r));
  }

  return (
    <div className="page-container">
      <h1 className="page-title">Intercept Rules</h1>
      <p className="page-desc">Pause matching requests for editing before forwarding.</p>

      <div className="tip" style={{ marginBottom: 16 }}>
        ⚠️ Rules are stored in server memory and reset on server restart.
      </div>

      <div className="sec" style={{ marginBottom: 16 }}>
        <div className="sec-head">
          <span className="sec-title">Add Rule</span>
        </div>
        <div style={{ padding: "12px 14px", display: "flex", gap: 8 }}>
          <select
            className="field-input"
            style={{ width: 100, flexShrink: 0 }}
            value={method}
            onChange={e => setMethod(e.target.value)}
          >
            <option value="">Any</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
          <input
            className="field-input"
            style={{ flex: 1 }}
            placeholder="Pattern (e.g. api.example.com/v1/payments)"
            value={pattern}
            onChange={e => setPattern(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addRule()}
          />
          <button className="btn primary" onClick={addRule}>
            <IconPlus size={13} /> Add
          </button>
        </div>
        <div className="tip" style={{ margin: "0 14px 12px" }}>
          💡 Pattern matches URL substring. Matching requests pause — edit headers/body/URL, then forward or drop.
        </div>
      </div>

      {loading ? (
        <div style={{ color: "var(--text-dim)" }}>Loading…</div>
      ) : rules.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No rules configured</div>
          <div className="empty-state-desc">Add a pattern above to intercept matching requests.</div>
        </div>
      ) : (
        <div className="sec">
          <div className="sec-head">
            <span className="sec-title">Rules</span>
            <span className="sec-count">{rules.length}</span>
          </div>
          {rules.map(rule => (
            <div key={rule.id} className="field-row">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={() => toggleRule(rule.id)}
                style={{ cursor: "pointer", flexShrink: 0 }}
              />
              {rule.method && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: `var(--m-${rule.method.toLowerCase()})`, flexShrink: 0 }}>
                  {rule.method}
                </span>
              )}
              <code style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12, color: rule.enabled ? "var(--text-1)" : "var(--text-dim)" }}>
                {rule.pattern}
              </code>
              <button className="icon-btn" onClick={() => removeRule(rule.id)}>
                <IconX size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
