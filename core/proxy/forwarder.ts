import http from "node:http";
import https from "node:https";
import type { RawRequest, RawResponse } from "./types.js";
import { collectBody, getEncoding } from "./decoder.js";

const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailers", "transfer-encoding", "upgrade", "proxy-connection",
]);

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 128, maxFreeSockets: 32 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 128, maxFreeSockets: 32 });

function normalizeHeaders(headers: Record<string, string | string[]>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) {
      out[k] = v;
    }
  }
  return out;
}

export async function forward(req: RawRequest, sslInsecure = false): Promise<RawResponse> {
  const start = Date.now();
  const url = new URL(req.url);
  const isHttps = url.protocol === "https:";

  const headers = normalizeHeaders(req.headers);
  const flatHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    flatHeaders[k] = Array.isArray(v) ? v.join(", ") : v;
  }
  flatHeaders["host"] = url.host;

  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: req.method,
      headers: flatHeaders,
      timeout: 30000,
      agent: isHttps ? httpsAgent : httpAgent,
    };

    if (isHttps) {
      (options as https.RequestOptions).rejectUnauthorized = !sslInsecure;
      (options as https.RequestOptions).servername = url.hostname;
    }

    const transport = isHttps ? https : http;
    const proxyReq = transport.request(options, async (res) => {
      const resHeaders: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(res.headers)) {
        if (v !== undefined) resHeaders[k] = v;
      }

      let body: Buffer | null = null;
      try {
        body = await collectBody(res);
      } catch {
        // ignore body collection errors
      }

      resolve({
        id: req.id,
        timestamp: Date.now(),
        statusCode: res.statusCode ?? 200,
        statusMessage: res.statusMessage ?? "OK",
        headers: resHeaders,
        body,
        duration: Date.now() - start,
        bodyEncoding: getEncoding(resHeaders),
      });
    });

    proxyReq.on("timeout", () => {
      proxyReq.destroy(new Error("Request timeout"));
    });

    proxyReq.on("error", reject);

    if (req.body) {
      proxyReq.write(req.body);
    }
    proxyReq.end();
  });
}
