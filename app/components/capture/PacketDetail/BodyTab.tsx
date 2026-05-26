import { useState } from "react";
import type { PacketRecord } from "~/types";
import { Section } from "~/components/ui/Section";
import { highlightJson, isJson } from "~/utils/json";
import { IconCopy } from "~/components/icons/index";

interface Props {
  packet: PacketRecord;
}

function BodySection({
  title,
  body,
  bodyType,
  contentType,
}: {
  title: string;
  body: string | null;
  bodyType: string | null;
  contentType: string | null;
}) {
  const [copied, setCopied] = useState(false);

  if (!body) {
    return (
      <Section title={title}>
        <div style={{ padding: "12px 14px", color: "var(--text-dim)", fontSize: 12 }}>
          No body
        </div>
      </Section>
    );
  }

  const isImage = contentType?.startsWith("image/");

  // If bodyType=binary, the body is base64-encoded. Try to decode to text.
  let displayBody = body;
  let decodedFromBase64 = false;
  if (bodyType === "binary" && !isImage) {
    try {
      displayBody = atob(body);
      decodedFromBase64 = true;
    } catch {
      // keep raw base64
    }
  }

  const isJsonBody = isJson(contentType) || bodyType === "json" ||
    (decodedFromBase64 && (() => { try { JSON.parse(displayBody); return true; } catch { return false; } })());

  async function copy() {
    await navigator.clipboard.writeText(displayBody);
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
    <Section title={title} count={body.length + " B"} action={action}>
      {isImage ? (
        <div style={{ padding: 14 }}>
          <img
            src={`data:${contentType};base64,${body}`}
            alt="response"
            style={{ maxWidth: "100%", borderRadius: 8 }}
          />
        </div>
      ) : isJsonBody ? (
        <pre
          className="body-viewer"
          dangerouslySetInnerHTML={{ __html: highlightJson(displayBody) }}
        />
      ) : (
        <pre className="body-viewer">{displayBody}</pre>
      )}
    </Section>
  );
}

export function BodyTab({ packet }: Props) {
  return (
    <div>
      <BodySection
        title="Request Body"
        body={packet.reqBody}
        bodyType={packet.reqBodyType}
        contentType={
          packet.reqHeaders?.["content-type"]
            ? String(packet.reqHeaders["content-type"])
            : null
        }
      />
      <BodySection
        title="Response Body"
        body={packet.resBody}
        bodyType={packet.resBodyType}
        contentType={packet.contentType}
      />
    </div>
  );
}
