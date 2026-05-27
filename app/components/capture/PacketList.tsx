import { useMemo, useRef, useEffect, useCallback, useState } from "react";
import { useStore, getFilteredPackets, type PacketSummary } from "~/store/index";
import { FilterChips } from "./FilterChips";
import { PacketRow } from "./PacketRow";
import { ContextMenu } from "./ContextMenu";
import { IconDownload, IconUpload, IconTrash, IconFilter, IconX, IconSearch, IconLightning } from "~/components/icons/index";

interface Props {
  style?: React.CSSProperties;
}

export function PacketList({ style }: Props) {
  const packets = useStore((s) => s.packets);
  const filter = useStore((s) => s.filter);
  const excludeRules = useStore((s) => s.excludeRules);
  const clearPackets = useStore((s) => s.clearPackets);
  const selectedIdsMap = useStore((s) => s.selectedIdsMap);
  const removePackets = useStore((s) => s.removePackets);
  const clearMultiSelect = useStore((s) => s.clearMultiSelect);
  const setVisibleIds = useStore((s) => s.setVisibleIds);
  const selectedId = useStore((s) => s.selectedId);
  const setFilter = useStore((s) => s.setFilter);

  const [search, setSearch] = useState("");
  const [deepMode, setDeepMode] = useState(false);
  const [deepResults, setDeepResults] = useState<PacketSummary[] | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ⌘K focuses search
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // deep search: debounced API fetch
  useEffect(() => {
    if (!deepMode) { setDeepResults(null); return; }
    if (!search.trim()) { setDeepResults(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setDeepLoading(true);
      try {
        const res = await fetch(`/api/packets?search=${encodeURIComponent(search)}&deep=true&limit=500`);
        const data = await res.json() as { items: PacketSummary[] };
        setDeepResults(data.items);
      } catch { setDeepResults([]); }
      finally { setDeepLoading(false); }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, deepMode]);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setSearch(v);
    if (!deepMode) setFilter({ search: v });
  }

  function handleClearSearch() {
    setSearch("");
    setFilter({ search: "" });
    setDeepResults(null);
  }

  function toggleDeep() {
    const next = !deepMode;
    setDeepMode(next);
    if (!next) {
      setDeepResults(null);
      setFilter({ search });
    }
  }

  const filtered = useMemo(
    () => getFilteredPackets(packets, filter, excludeRules),
    [packets, filter, excludeRules],
  );

  const displayList = deepMode && deepResults !== null ? deepResults : filtered;

  // Keep store's visibleIds in sync for range-select
  useEffect(() => {
    setVisibleIds(filtered.map((p) => p.id));
  }, [filtered, setVisibleIds]);

  const listBodyRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    const el = listBodyRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [filtered.length]);

  function handleScroll() {
    const el = listBodyRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  // Delete key: remove selected or multi-selected
  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;

      const multiIds = Object.keys(selectedIdsMap);
      if (multiIds.length > 0) {
        e.preventDefault();
        await Promise.all(multiIds.map((id) => fetch(`/api/packets/${id}`, { method: "DELETE" })));
        removePackets(multiIds);
      } else if (selectedId) {
        e.preventDefault();
        await fetch(`/api/packets/${selectedId}`, { method: "DELETE" });
        removePackets([selectedId]);
      }
    },
    [selectedId, selectedIdsMap, removePackets],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  async function handleExport() {
    const res = await fetch("/api/session");
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `webspy-${Date.now()}.wspy`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".wspy,.json";
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = async () => {
      const file = input.files?.[0];
      if (document.body.contains(input)) document.body.removeChild(input);
      if (!file) return;
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        // Detect binary formats: gzip (1f 8b) or TW brotli (54 57 02)
        const isBinary =
          (bytes[0] === 0x1f && bytes[1] === 0x8b) ||
          (bytes[0] === 0x54 && bytes[1] === 0x57 && bytes[2] === 0x02);
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": isBinary ? "application/octet-stream" : "application/json" },
          body: isBinary ? buffer : new TextDecoder().decode(bytes),
        });
        if (!res.ok) throw new Error(await res.text());
      } catch (err) {
        console.error("Import failed:", err);
      }
    };
    input.click();
  }

  async function handleClear() {
    await fetch("/api/packets", { method: "DELETE" });
    clearPackets();
  }

  async function deleteSelected() {
    const ids = Object.keys(selectedIdsMap);
    await Promise.all(ids.map((id) => fetch(`/api/packets/${id}`, { method: "DELETE" })));
    removePackets(ids);
  }

  const multiCount = Object.keys(selectedIdsMap).length;

  return (
    <div className="packet-list-panel" style={style}>
      <div className="list-header">
        <div className="list-header-row1">
          <span className="list-title">Packets</span>
          <span className="count-pill">{displayList.length}{!deepMode && ` / ${packets.length}`}</span>
          <div className="list-actions">
            <button className="btn ghost sm" onClick={handleExport} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <IconDownload size={12} /> Save
            </button>
            <button className="btn ghost sm" onClick={handleImport} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <IconUpload size={12} /> Load
            </button>
            <button className="icon-btn" onClick={handleClear} title="Clear all">
              <IconTrash size={15} />
            </button>
          </div>
        </div>

        <div className="list-search-row">
          <div className="list-search-wrap">
            <IconSearch size={12} className="list-search-icon" />
            <input
              ref={searchRef}
              type="text"
              className="list-search-input"
              placeholder="Search packets… (⌘K)"
              value={search}
              onChange={handleSearchChange}
            />
            {search && (
              <button className="list-search-clear" onClick={handleClearSearch} title="Clear">
                <IconX size={10} />
              </button>
            )}
          </div>
          <button
            className={`deep-toggle${deepMode ? " active" : ""}`}
            onClick={toggleDeep}
            title={deepMode ? "Deep search ON (headers + body)" : "Deep search OFF (URL/host only)"}
          >
            <IconLightning size={12} />
            Deep
          </button>
        </div>

        <FilterChips />
      </div>

      {multiCount > 0 && (
        <div className="multiselect-bar">
          <span><strong>{multiCount}</strong> selected</span>
          <button className="btn danger sm" onClick={deleteSelected} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <IconTrash size={11} /> Delete
          </button>
          <button className="icon-btn" onClick={clearMultiSelect} title="Clear selection" style={{ marginLeft: "auto" }}>
            <IconX size={12} />
          </button>
        </div>
      )}

      <div
        ref={listBodyRef}
        className="packet-list-body"
        onScroll={handleScroll}
      >
        {deepMode && deepLoading ? (
          <div className="empty-state">
            <div className="empty-state-title" style={{ fontSize: 13 }}>Searching…</div>
          </div>
        ) : displayList.length === 0 ? (
          <div className="empty-state">
            <IconFilter size={48} className="empty-state-icon" />
            <div className="empty-state-title">
              {packets.length === 0 ? "No packets captured" : "No packets match"}
            </div>
            <div className="empty-state-desc">
              {packets.length === 0
                ? "Configure your browser/device to use proxy\non port 8080 to start capturing."
                : deepMode
                  ? "No results in headers or body."
                  : "Try adjusting your filter criteria."}
            </div>
          </div>
        ) : (
          displayList.map((p) => <PacketRow key={p.id} packet={p} />)
        )}
      </div>

      <ContextMenu />
    </div>
  );
}
