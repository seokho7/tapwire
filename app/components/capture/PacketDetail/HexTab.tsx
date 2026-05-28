import { useState } from "react";
import type { PacketRecord } from "~/types";
import { Section } from "~/components/ui/Section";
import { IconCopy } from "~/components/icons/index";

interface Props {
  packet: PacketRecord;
}

function toBytes(body: string, bodyType: string | null): Uint8Array {
  if (bodyType === "binary") {
    try {
      const bin = atob(body);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch {
      // fallthrough to text encoding
    }
  }
  return new TextEncoder().encode(body);
}

function toHexString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ");
}

function HexSection({
  title,
  body,
  bodyType,
}: {
  title: string;
  body: string | null;
  bodyType: string | null;
}) {
  const [copied, setCopied] = useState(false);

  if (!body) {
    return (
      <Section title={title}>
        <div style={{ padding: "12px 14px", color: "var(--text-dim)", fontSize: 12 }}>No data</div>
      </Section>
    );
  }

  const bytes = toBytes(body, bodyType);
  const hex = toHexString(bytes);

  async function copy() {
    await navigator.clipboard.writeText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const action = (
    <button className="btn ghost sm" onClick={copy} style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <IconCopy size={12} />
      {copied ? "Copied!" : "Copy"}
    </button>
  );

  return (
    <Section title={title} count={bytes.length + " B"} action={action}>
      <pre
        className="body-viewer"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          wordBreak: "break-all",
          whiteSpace: "pre-wrap",
          letterSpacing: "0.04em",
        }}
      >
        {hex}
      </pre>
    </Section>
  );
}

export function HexTab({ packet }: Props) {
  return (
    <div>
      <HexSection title="Request Hex" body={packet.reqBody} bodyType={packet.reqBodyType} />
      <HexSection title="Response Hex" body={packet.resBody} bodyType={packet.resBodyType} />
    </div>
  );
}
