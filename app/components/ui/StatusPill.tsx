import { getStatusColor, getStatusBg } from "~/utils/format";

interface Props {
  code: number | null;
  message?: string | null;
  showMessage?: boolean;
}

export function StatusPill({ code, message, showMessage = false }: Props) {
  if (!code) return <span className="status-code" style={{ color: "var(--text-dim)" }}>—</span>;

  return (
    <span
      className="status-pill"
      style={{
        color: getStatusColor(code),
        background: getStatusBg(code),
      }}
    >
      {code}
      {showMessage && message ? ` ${message}` : ""}
    </span>
  );
}
