import { useState } from "react";
import type { PacketRecord } from "~/types";
import { IconCopy } from "~/components/icons/index";

interface Props {
  packet: PacketRecord;
}

function buildRaw(packet: PacketRecord): string {
  const lines: string[] = [];

  // Request
  lines.push(`${packet.method} ${packet.path} HTTP/${packet.httpVersion ?? "1.1"}`);
  if (packet.reqHeaders) {
    for (const [k, v] of Object.entries(packet.reqHeaders)) {
      lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
    }
  }
  lines.push("");
  if (packet.reqBody) lines.push(packet.reqBody);

  lines.push("");
  lines.push("─".repeat(60));
  lines.push("");

  // Response
  lines.push(`HTTP/${packet.httpVersion ?? "1.1"} ${packet.statusCode ?? "?"} ${packet.statusMessage ?? ""}`);
  if (packet.resHeaders) {
    for (const [k, v] of Object.entries(packet.resHeaders)) {
      lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
    }
  }
  lines.push("");
  if (packet.resBody) lines.push(packet.resBody);

  return lines.join("\n");
}

export function RawTab({ packet }: Props) {
  const [copied, setCopied] = useState(false);
  const raw = buildRaw(packet);

  async function copy() {
    await navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button className="btn ghost sm" onClick={copy}>
          <IconCopy size={12} /> {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="body-viewer" style={{ background: "var(--bg-card)", borderRadius: "var(--r-lg)", border: "1px solid var(--line)" }}>
        {raw}
      </pre>
    </div>
  );
}
