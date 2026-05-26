export function fmtSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtDur(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("ko-KR");
}

export function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":    return "var(--m-get)";
    case "POST":   return "var(--m-post)";
    case "PUT":    return "var(--m-put)";
    case "DELETE": return "var(--m-delete)";
    case "PATCH":  return "var(--m-patch)";
    default:       return "var(--m-default)";
  }
}

export function getMethodBg(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":    return "rgba(91,141,239,0.12)";
    case "POST":   return "rgba(45,212,167,0.12)";
    case "PUT":    return "rgba(224,162,74,0.12)";
    case "DELETE": return "rgba(239,110,110,0.12)";
    case "PATCH":  return "rgba(176,132,238,0.12)";
    default:       return "rgba(119,126,137,0.12)";
  }
}

export function getStatusColor(code: number | null): string {
  if (!code) return "var(--text-dim)";
  if (code < 300) return "var(--s-2xx)";
  if (code < 400) return "var(--s-3xx)";
  if (code < 500) return "var(--s-4xx)";
  return "var(--s-5xx)";
}

export function getStatusBg(code: number | null): string {
  if (!code) return "transparent";
  if (code < 300) return "rgba(45,212,167,0.10)";
  if (code < 400) return "rgba(91,141,239,0.10)";
  if (code < 500) return "rgba(224,162,74,0.10)";
  return "rgba(239,110,110,0.10)";
}
