import { useState, useEffect, useCallback } from "react";
import { useStore } from "~/store/index";
import type { PacketRecord } from "~/types";
import { MethodBadge } from "~/components/ui/MethodBadge";
import { StatusPill } from "~/components/ui/StatusPill";
import { OverviewTab } from "./OverviewTab";
import { HeadersTab } from "./HeadersTab";
import { BodyTab } from "./BodyTab";
import { RawTab } from "./RawTab";
import { TimingTab } from "./TimingTab";
import { InterceptModal } from "~/components/intercept/InterceptModal";
import { fmtTime, fmtDur, fmtSize } from "~/utils/format";
import { IconGlobe, IconEdit, IconRefresh, IconCopy, IconTrash, IconX } from "~/components/icons/index";

type Tab = "overview" | "headers" | "body" | "raw" | "timing";

export function PacketDetail() {
  const selectedId = useStore((s) => s.selectedId);
  const removePackets = useStore((s) => s.removePackets);
  const pendingOpenIntercept = useStore((s) => s.pendingOpenIntercept);
  const setPendingOpenIntercept = useStore((s) => s.setPendingOpenIntercept);

  const [packet, setPacket] = useState<PacketRecord | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [interceptOpen, setInterceptOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const [fetchCopied, setFetchCopied] = useState(false);

  useEffect(() => {
    if (!selectedId) { setPacket(null); setNotes(""); return; }
    setLoading(true);
    fetch(`/api/packets/${selectedId}`)
      .then((r) => r.json())
      .then((data: PacketRecord) => {
        setPacket(data);
        setNotes(data.notes ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedId]);

  // Open intercept modal when triggered from context menu
  useEffect(() => {
    if (pendingOpenIntercept && packet && pendingOpenIntercept === packet.id) {
      setInterceptOpen(true);
      setPendingOpenIntercept(null);
    }
  }, [pendingOpenIntercept, packet, setPendingOpenIntercept]);

  if (!selectedId) {
    return (
      <div className="packet-detail">
        <div className="no-selection">
          <IconGlobe size={64} style={{ color: "var(--text-dim)" }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-3)" }}>No packet selected</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Click a packet in the list to inspect it</div>
        </div>
      </div>
    );
  }

  if (loading || !packet) {
    return (
      <div className="packet-detail">
        <div className="no-selection" style={{ color: "var(--text-dim)" }}>Loading...</div>
      </div>
    );
  }

  let url: URL;
  try {
    url = new URL(packet.url);
  } catch {
    url = new URL("http://invalid");
  }
  const reqHeaderCount = Object.keys(packet.reqHeaders ?? {}).length;
  const resHeaderCount = packet.resHeaders ? Object.keys(packet.resHeaders).length : 0;

  async function handleReplay() {
    await fetch(`/api/replay/${packet!.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  }

  async function handleDelete() {
    await fetch(`/api/packets/${packet!.id}`, { method: "DELETE" });
    removePackets([packet!.id]);
  }

  async function copyAsCurl() {
    try {
      const headers = Object.entries(packet!.reqHeaders ?? {})
        .filter(([k]) => !k.startsWith(":"))
        .map(([k, v]) => {
          const val = (Array.isArray(v) ? v[0] : v).replace(/"/g, '\\"');
          return `-H "${k}: ${val}"`;
        })
        .join(" \\\n  ");
      const body = packet!.reqBody
        ? ` \\\n  --data-raw ${JSON.stringify(packet!.reqBody)}`
        : "";
      const cmd = `curl -X ${packet!.method} "${packet!.url}" \\\n  ${headers}${body}`;
      await navigator.clipboard.writeText(cmd);
      setCurlCopied(true);
      setTimeout(() => setCurlCopied(false), 1500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = `curl -X ${packet!.method} "${packet!.url}"`;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCurlCopied(true);
      setTimeout(() => setCurlCopied(false), 1500);
    }
  }

  async function copyAsFetch() {
    try {
      const flatHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(packet!.reqHeaders ?? {})) {
        if (!k.startsWith(":")) flatHeaders[k] = Array.isArray(v) ? v[0] : v;
      }
      const opts: Record<string, unknown> = {
        method: packet!.method,
        headers: flatHeaders,
      };
      if (packet!.reqBody) opts.body = packet!.reqBody;
      const code = `const res = await fetch(${JSON.stringify(packet!.url)}, ${JSON.stringify(opts, null, 2)});\nconst data = await res.json();\nconsole.log(data);`;
      await navigator.clipboard.writeText(code);
      setFetchCopied(true);
      setTimeout(() => setFetchCopied(false), 1500);
    } catch { /* ignore */ }
  }

  async function saveNote() {
    await fetch(`/api/packets/${packet!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
  }

  return (
    <div className="packet-detail">
      <div className="detail-header">
        <div className="detail-url-row">
          <span
            className="detail-method-big method-badge"
            style={{
              color: `var(--m-${packet.method.toLowerCase()})`,
              background: `rgba(var(--m-${packet.method.toLowerCase()}-rgb, 91,141,239), 0.12)`,
              fontSize: "11.5px",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 6,
            }}
          >
            {packet.method}
          </span>

          <span className="detail-url">
            <span className="url-host">{url.protocol}//{url.host}</span>
            {url.pathname}{url.search}
          </span>

          <StatusPill code={packet.statusCode} message={packet.statusMessage} showMessage />
        </div>

        <div className="detail-actions">
          <button className="btn primary" onClick={() => setInterceptOpen(true)}>
            <IconEdit size={13} /> Edit &amp; Send
          </button>
          <button className="btn" onClick={handleReplay}>
            <IconRefresh size={13} /> Replay
          </button>
          <button className="btn ghost" onClick={copyAsCurl} title="Copy as cURL">
            <IconCopy size={13} /> {curlCopied ? "Copied!" : "cURL"}
          </button>
          <button className="btn ghost" onClick={copyAsFetch} title="Copy as fetch">
            <IconCopy size={13} /> {fetchCopied ? "Copied!" : "fetch"}
          </button>
          <button
            className={`btn ghost${noteOpen ? " active" : ""}`}
            onClick={() => setNoteOpen((v) => !v)}
            title="Note"
          >
            📝 Note
          </button>
          {notes.trim() && !noteOpen && (
            <span className="note-pill" title={notes}>{notes.length > 40 ? notes.slice(0, 40) + "…" : notes}</span>
          )}
          <button className="btn ghost" onClick={handleDelete} style={{ marginLeft: "auto" }}>
            <IconTrash size={13} />
          </button>
        </div>

        {noteOpen && (
          <div className="note-area">
            <textarea
              className="note-editor"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNote}
              placeholder="Add a note about this packet…"
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
              <button className="btn ghost sm" onClick={() => setNoteOpen(false)}>
                <IconX size={11} /> Close
              </button>
              <button className="btn sm" onClick={async () => { await saveNote(); setNoteOpen(false); }}>
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="detail-meta">
        <span className="meta-item">Started <strong>{fmtTime(packet.timestamp)}</strong></span>
        <span className="meta-item">Duration <strong>{fmtDur(packet.duration)}</strong></span>
        <span className="meta-item">Size <strong>{fmtSize(packet.resBody?.length ?? 0)}</strong></span>
        {packet.contentType && (
          <span className="meta-item">Type <strong>{packet.contentType.split(";")[0]}</strong></span>
        )}
        <span className="meta-item">Client <strong>{packet.clientIp || "—"}</strong></span>
      </div>

      <div className="tabs">
        {(["overview", "headers", "body", "raw", "timing"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "headers"
              ? <>Headers <span className="tab-badge">{reqHeaderCount + resHeaderCount}</span></>
              : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === "overview" && <OverviewTab packet={packet} />}
        {tab === "headers"  && <HeadersTab packet={packet} />}
        {tab === "body"     && <BodyTab packet={packet} />}
        {tab === "raw"      && <RawTab packet={packet} />}
        {tab === "timing"   && <TimingTab packet={packet} />}
      </div>

      {interceptOpen && (
        <InterceptModal
          packet={packet}
          onClose={() => setInterceptOpen(false)}
        />
      )}
    </div>
  );
}
