import { useState } from "react";
import type { PacketRecord } from "~/types";
import { Section } from "~/components/ui/Section";
import { highlightJson, isJson } from "~/utils/json";
import { fmtTime, fmtDur, fmtSize } from "~/utils/format";
import { IconCopy } from "~/components/icons/index";

function decodeBody(body: string, bodyType: string | null): string {
  if (bodyType === "binary") {
    try { return atob(body); } catch { return body; }
  }
  return body;
}

interface Props {
  packet: PacketRecord;
}

export function OverviewTab({ packet }: Props) {
  const [copied, setCopied] = useState(false);

  const rows = [
    { key: "Request URL", val: packet.url },
    { key: "Method", val: packet.method },
    { key: "Status", val: packet.statusCode ? `${packet.statusCode} ${packet.statusMessage ?? ""}` : "—" },
    { key: "Protocol", val: packet.isHttps ? "HTTPS" : "HTTP" },
    { key: "Content-Type", val: packet.contentType ?? "—" },
    { key: "Duration", val: fmtDur(packet.duration) },
    { key: "Size", val: fmtSize(packet.resBody ? packet.resBody.length : 0) },
    { key: "Started", val: fmtTime(packet.timestamp) },
    { key: "Client", val: packet.clientIp || "—" },
  ];

  async function copyGeneral() {
    const text = rows.map(({ key, val }) => `${key}: ${val}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const copyAction = (
    <button className="btn ghost sm" onClick={copyGeneral} style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <IconCopy size={12} />
      {copied ? "Copied!" : "Copy"}
    </button>
  );

  const previewBody = packet.resBody;
  const showResJson = previewBody && isJson(packet.contentType);

  const hasReqBody = packet.reqBody && ["POST", "PUT", "PATCH"].includes(packet.method);
  const reqCt = packet.reqHeaders?.["content-type"]
    ? String(packet.reqHeaders["content-type"]).split(";")[0]
    : null;
  const reqBodyDecoded = hasReqBody ? decodeBody(packet.reqBody!, packet.reqBodyType) : null;
  const showReqJson = isJson(reqCt) || packet.reqBodyType === "json" ||
    (reqBodyDecoded !== null && (() => { try { JSON.parse(reqBodyDecoded); return true; } catch { return false; } })());

  return (
    <div>
      <Section title="General" count={rows.length} action={copyAction}>
        <div className="headers-table">
          {rows.map(({ key, val }) => (
            <div key={key} className="header-row">
              <span className="header-key">{key}</span>
              <span className="header-val">{val}</span>
            </div>
          ))}
        </div>
      </Section>

      {hasReqBody && reqBodyDecoded && (
        <Section title="Request Body">
          <pre
            className="body-viewer"
            style={{ maxHeight: 200, overflow: "auto" }}
            dangerouslySetInnerHTML={showReqJson
              ? { __html: highlightJson(reqBodyDecoded) }
              : undefined
            }
          >
            {!showReqJson ? reqBodyDecoded : undefined}
          </pre>
        </Section>
      )}

      {previewBody && (
        <Section title="Response Preview">
          <div
            className="body-viewer"
            style={{ maxHeight: 260, overflow: "auto" }}
            dangerouslySetInnerHTML={{
              __html: showResJson
                ? highlightJson(previewBody)
                : previewBody.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
            }}
          />
        </Section>
      )}
    </div>
  );
}
