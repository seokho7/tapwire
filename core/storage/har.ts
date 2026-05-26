import { v4 as uuidv4 } from "uuid";
import type { PacketRecord, RawRequest, RawResponse } from "../proxy/types.js";

interface HarEntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    cookies: unknown[];
    headers: Array<{ name: string; value: string }>;
    queryString: Array<{ name: string; value: string }>;
    postData?: { mimeType: string; text: string };
    headersSize: number;
    bodySize: number;
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    cookies: unknown[];
    headers: Array<{ name: string; value: string }>;
    content: { size: number; mimeType: string; text?: string; encoding?: string };
    redirectURL: string;
    headersSize: number;
    bodySize: number;
  };
  timings: { send: number; wait: number; receive: number };
}

interface HarFile {
  log: {
    version: "1.2";
    creator: { name: string; version: string };
    entries: HarEntry[];
  };
}

function headersToHar(h: Record<string, string | string[]> | null): Array<{ name: string; value: string }> {
  if (!h) return [];
  return Object.entries(h).map(([name, value]) => ({
    name,
    value: Array.isArray(value) ? value.join(", ") : value,
  }));
}

function parseQuery(url: string): Array<{ name: string; value: string }> {
  try {
    return [...new URL(url).searchParams.entries()].map(([name, value]) => ({ name, value }));
  } catch {
    return [];
  }
}

export function toHar(packets: PacketRecord[]): HarFile {
  const entries: HarEntry[] = packets.map(p => ({
    startedDateTime: new Date(p.timestamp).toISOString(),
    time: p.duration ?? 0,
    request: {
      method: p.method,
      url: p.url,
      httpVersion: `HTTP/${p.httpVersion ?? "1.1"}`,
      cookies: [],
      headers: headersToHar(p.reqHeaders),
      queryString: parseQuery(p.url),
      ...(p.reqBody
        ? {
            postData: {
              mimeType: getContentType(p.reqHeaders) ?? "application/octet-stream",
              text: p.reqBody,
            },
          }
        : {}),
      headersSize: -1,
      bodySize: p.reqBody ? p.reqBody.length : 0,
    },
    response: {
      status: p.statusCode ?? 0,
      statusText: p.statusMessage ?? "",
      httpVersion: `HTTP/${p.httpVersion ?? "1.1"}`,
      cookies: [],
      headers: headersToHar(p.resHeaders),
      content: {
        size: p.resBody ? p.resBody.length : 0,
        mimeType: p.contentType ?? "application/octet-stream",
        ...(p.resBody ? { text: p.resBody } : {}),
      },
      redirectURL: "",
      headersSize: -1,
      bodySize: p.resBody ? p.resBody.length : 0,
    },
    timings: { send: 0, wait: p.duration ?? 0, receive: 0 },
  }));

  return {
    log: {
      version: "1.2",
      creator: { name: "Tapwire", version: "1.0.0" },
      entries,
    },
  };
}

function getContentType(headers: Record<string, string | string[]> | null): string | null {
  if (!headers) return null;
  const ct = headers["content-type"];
  return ct ? (Array.isArray(ct) ? ct[0] : ct) : null;
}

export function parseHar(data: unknown): Array<{ req: RawRequest; res: RawResponse }> {
  const har = data as HarFile;
  if (!har?.log?.entries) return [];

  const results: Array<{ req: RawRequest; res: RawResponse }> = [];

  for (const entry of har.log.entries) {
    const url = entry.request?.url;
    if (!url) continue;

    let parsedUrl: URL;
    try { parsedUrl = new URL(url); } catch { continue; }

    const reqHeaders: Record<string, string> = {};
    for (const { name, value } of (entry.request.headers ?? [])) {
      reqHeaders[name.toLowerCase()] = value;
    }

    const resHeaders: Record<string, string> = {};
    for (const { name, value } of (entry.response?.headers ?? [])) {
      resHeaders[name.toLowerCase()] = value;
    }

    const httpVer = (entry.request.httpVersion ?? "HTTP/1.1").replace("HTTP/", "");

    const req: RawRequest = {
      id: uuidv4(),
      timestamp: new Date(entry.startedDateTime).getTime() || Date.now(),
      clientIp: "imported",
      method: entry.request.method ?? "GET",
      url,
      host: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      httpVersion: httpVer,
      headers: reqHeaders,
      body: entry.request.postData?.text
        ? Buffer.from(entry.request.postData.text, "utf8")
        : null,
      isHttps: parsedUrl.protocol === "https:",
    };

    const content = entry.response?.content;
    let resBody: Buffer | null = null;
    if (content?.text) {
      resBody = content.encoding === "base64"
        ? Buffer.from(content.text, "base64")
        : Buffer.from(content.text, "utf8");
    }

    const res: RawResponse = {
      id: req.id,
      timestamp: req.timestamp + (entry.time ?? 0),
      statusCode: entry.response?.status ?? 200,
      statusMessage: entry.response?.statusText ?? "OK",
      headers: resHeaders,
      body: resBody,
      duration: entry.time ?? 0,
      bodyEncoding: "identity",
    };

    results.push({ req, res });
  }

  return results;
}
