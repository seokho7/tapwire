import { useState } from "react";
import type { PacketRecord } from "~/types";
import { Section } from "~/components/ui/Section";
import { IconCopy } from "~/components/icons/index";

interface Props {
  packet: PacketRecord;
}

function HeadersTable({ headers }: { headers: Record<string, string | string[]> | null }) {
  if (!headers) return <div style={{ padding: "12px 14px", color: "var(--text-dim)", fontSize: 12 }}>No headers</div>;
  const entries = Object.entries(headers);
  return (
    <div className="headers-table">
      {entries.map(([key, val]) => (
        <div key={key} className="header-row">
          <span className="header-key">{key}</span>
          <span className="header-val">{Array.isArray(val) ? val.join(", ") : val}</span>
        </div>
      ))}
    </div>
  );
}

function HeadersSection({ title, headers }: { title: string; headers: Record<string, string | string[]> | null }) {
  const [copied, setCopied] = useState(false);

  async function copyHeaders() {
    if (!headers) return;
    const text = Object.entries(headers)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const count = headers ? Object.keys(headers).length : 0;
  const copyAction = headers && count > 0 ? (
    <button className="btn ghost sm" onClick={copyHeaders} style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <IconCopy size={12} />
      {copied ? "Copied!" : "Copy"}
    </button>
  ) : undefined;

  return (
    <Section title={title} count={count} action={copyAction}>
      <HeadersTable headers={headers} />
    </Section>
  );
}

export function HeadersTab({ packet }: Props) {
  return (
    <div>
      <HeadersSection title="Request Headers" headers={packet.reqHeaders} />
      <HeadersSection title="Response Headers" headers={packet.resHeaders} />
    </div>
  );
}
