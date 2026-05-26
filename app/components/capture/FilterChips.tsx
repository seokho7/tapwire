import { useStore } from "~/store/index";
import { getMethodColor } from "~/utils/format";

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];
const STATUSES = ["2xx", "3xx", "4xx", "5xx"];

export function FilterChips() {
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);

  function toggleMethod(m: string) {
    setFilter({ method: filter.method === m ? "all" : m });
  }

  function toggleStatus(s: string) {
    const next = new Set(filter.status);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setFilter({ status: next });
  }

  return (
    <div className="filter-chips">
      <button
        className={`chip ${filter.method === "all" ? "active" : ""}`}
        onClick={() => setFilter({ method: "all" })}
      >
        All
      </button>
      {METHODS.map((m) => (
        <button
          key={m}
          className={`chip ${filter.method === m ? "active" : ""}`}
          onClick={() => toggleMethod(m)}
        >
          <span className="chip-dot" style={{ background: getMethodColor(m) }} />
          {m}
        </button>
      ))}

      <div className="filter-divider" />

      {STATUSES.map((s) => (
        <button
          key={s}
          className={`chip ${filter.status.has(s) ? "active" : ""}`}
          onClick={() => toggleStatus(s)}
        >
          <span
            className="chip-dot"
            style={{
              background: s === "2xx" ? "var(--s-2xx)" : s === "3xx" ? "var(--s-3xx)" : s === "4xx" ? "var(--s-4xx)" : "var(--s-5xx)",
            }}
          />
          {s}
        </button>
      ))}
    </div>
  );
}
