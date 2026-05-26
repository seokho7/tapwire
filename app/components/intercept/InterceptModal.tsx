import { useState, useEffect } from "react";
import type { PacketRecord } from "~/types";
import { MethodBadge } from "~/components/ui/MethodBadge";
import { HeaderEditor } from "./HeaderEditor";
import { BodyEditor } from "./BodyEditor";
import { UrlEditor } from "./UrlEditor";
import { QueryEditor } from "./QueryEditor";
import { IconX, IconLightning, IconCheck } from "~/components/icons/index";

type Section = "url" | "headers" | "body" | "query";

interface Props {
  packet: PacketRecord;
  onClose: () => void;
  isLive?: boolean;
}

function flattenHeaders(h: Record<string, string | string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    out[k] = Array.isArray(v) ? v.join(", ") : v;
  }
  return out;
}

export function InterceptModal({ packet, onClose, isLive = false }: Props) {
  const [section, setSection] = useState<Section>("url");
  const [method, setMethod] = useState(packet.method);
  const [url, setUrl] = useState(packet.url);
  const [headers, setHeaders] = useState(() => flattenHeaders(packet.reqHeaders ?? {}));
  const [body, setBody] = useState(packet.reqBody ?? "");

  const originalHeaders = flattenHeaders(packet.reqHeaders ?? {});
  const originalUrl = packet.url;
  const originalMethod = packet.method;

  // Countdown (live intercept only)
  const TIMEOUT = 30;
  const [countdown, setCountdown] = useState(TIMEOUT);

  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(t); handleForwardOriginal(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleForward(); }
      if (e.key === "Escape") { e.preventDefault(); isLive ? handleForwardOriginal() : onClose(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") { e.preventDefault(); handleDrop(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, method, url, headers, body]);

  const addedKeys    = Object.keys(headers).filter((k) => !(k in originalHeaders));
  const modifiedKeys = Object.keys(headers).filter((k) => k in originalHeaders && headers[k] !== originalHeaders[k]);
  const removedKeys  = Object.keys(originalHeaders).filter((k) => !(k in headers));
  const urlChanged = url !== originalUrl || method !== originalMethod;
  const bodyChanged = body !== (packet.reqBody ?? "");
  const totalChanges = addedKeys.length + modifiedKeys.length + removedKeys.length + (urlChanged ? 1 : 0) + (bodyChanged ? 1 : 0);

  async function handleForward() {
    await fetch(`/api/intercept/${packet.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request: { method, url, headers, body: body || null },
      }),
    });
    onClose();
  }

  async function handleForwardOriginal() {
    if (!isLive) { onClose(); return; }
    await fetch(`/api/intercept/${packet.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request: {} }),
    });
    onClose();
  }

  async function handleDrop() {
    if (!isLive) { onClose(); return; }
    await fetch(`/api/intercept/${packet.id}`, {
      method: "DELETE",
    });
    onClose();
  }

  const SECTIONS: Array<{ key: Section; label: string; badge?: number }> = [
    { key: "url", label: "URL & Method" },
    { key: "headers", label: "Headers", badge: Object.keys(headers).length },
    { key: "body", label: "Body" },
    { key: "query", label: "Query Params" },
  ];

  const contentType = headers["content-type"] ?? headers["Content-Type"] ?? packet.contentType ?? null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && (isLive ? handleForwardOriginal() : onClose())}>
      <div className="modal" role="dialog" aria-modal="true">
        {/* Head */}
        <div className="modal-head">
          <div className="modal-title-block">
            <div className="modal-title">
              <div className="intercept-dot" />
              {isLive ? "Intercepted Request" : "Edit & Send"}
            </div>
            <div className="modal-subtitle">
              <MethodBadge method={method} size="sm" />
              <span>{packet.host}{packet.path}</span>
            </div>
          </div>

          {isLive && (
            <div className="countdown-chip">
              <IconLightning size={12} />
              Auto-forward in{" "}
              <span className="countdown-num">{countdown}s</span>
            </div>
          )}

          <button className="icon-btn" onClick={isLive ? handleForwardOriginal : onClose}>
            <IconX size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Sidebar */}
          <div className="modal-side">
            <div className="modal-side-desc">
              {isLive ? <>Editing <strong>request</strong> before forwarding</> : <>Edit request and <strong>resend</strong></>}
            </div>

            {SECTIONS.map(({ key, label, badge }) => {
              const isActive = section === key;
              const hasChanges =
                (key === "headers" && (addedKeys.length + modifiedKeys.length + removedKeys.length) > 0) ||
                (key === "url" && urlChanged) ||
                (key === "body" && bodyChanged);
              return (
                <button
                  key={key}
                  className={`nav-item ${isActive ? "active" : ""}`}
                  style={{ width: "100%", cursor: "pointer", background: "none", border: isActive ? undefined : "1px solid transparent" }}
                  onClick={() => setSection(key)}
                >
                  {label}
                  {badge !== undefined && (
                    <span
                      className="nav-badge"
                      style={hasChanges ? { background: "var(--accent-soft)", color: "var(--m-put)" } : {}}
                    >
                      {badge}
                    </span>
                  )}
                  {hasChanges && badge === undefined && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--m-put)", marginLeft: "auto", flexShrink: 0 }} />
                  )}
                </button>
              );
            })}

            {/* Diff card */}
            <div className="diff-card">
              <div className="diff-title">Changes</div>
              <div className="diff-row">
                Modified
                <span className={`diff-count ${modifiedKeys.length > 0 ? "modified" : ""}`}>{modifiedKeys.length + (urlChanged ? 1 : 0)}</span>
              </div>
              <div className="diff-row">
                Added
                <span className={`diff-count ${addedKeys.length > 0 ? "added" : ""}`}>{addedKeys.length}</span>
              </div>
              <div className="diff-row">
                Removed
                <span className={`diff-count ${removedKeys.length > 0 ? "removed" : ""}`}>{removedKeys.length}</span>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="modal-main">
            {section === "url" && (
              <UrlEditor
                method={method}
                url={url}
                onMethodChange={setMethod}
                onPathChange={setUrl}
              />
            )}
            {section === "headers" && (
              <div className="modal-section" style={{ padding: 0 }}>
                <HeaderEditor
                  headers={headers}
                  original={originalHeaders}
                  onChange={setHeaders}
                />
              </div>
            )}
            {section === "body" && (
              <div className="modal-section" style={{ padding: 0 }}>
                <BodyEditor
                  body={body}
                  contentType={contentType}
                  onChange={setBody}
                />
              </div>
            )}
            {section === "query" && (
              <QueryEditor url={url} onChange={setUrl} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-foot">
          {isLive ? (
            <>
              <button className="btn danger" onClick={handleDrop}>Drop Request</button>
              <button className="btn" onClick={handleForwardOriginal}>Forward Original</button>
            </>
          ) : (
            <button className="btn" onClick={onClose}>Cancel</button>
          )}
          <div className="modal-foot-spacer" />
          <span className="kbd-hint">⌘ ↵ to send</span>
          <button className="btn primary" onClick={handleForward}>
            <IconCheck size={13} />
            {isLive ? "Forward" : "Send"}{totalChanges > 0 ? ` (${totalChanges} change${totalChanges > 1 ? "s" : ""})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
