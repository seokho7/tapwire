import http from "node:http";
import net from "node:net";
import tls from "node:tls";
import { EventEmitter } from "node:events";
import { v4 as uuidv4 } from "uuid";
import type { ProxyOptions, RawRequest, InterceptContext } from "./types.js";
import { loadOrCreateCA, type CA } from "./ca.js";
import { CertCache } from "./certCache.js";
import { collectBody, decodeBody, getEncoding } from "./decoder.js";
import { forward } from "./forwarder.js";
import { InterceptorChain } from "./interceptor.js";

function parseHeaders(raw: http.IncomingHttpHeaders): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export class ProxyServer extends EventEmitter {
  private server: http.Server;
  private httpsHandler: http.Server;
  private ca!: CA;
  private certCache = new CertCache();
  private activeConnections = 0;
  private requestCount = 0;
  private recentTimestamps: number[] = [];
  private _running = false;
  public interceptorChain = new InterceptorChain();

  constructor(private options: ProxyOptions) {
    super();
    this.server = http.createServer();
    this.httpsHandler = http.createServer();

    this.server.on("request", (req, res) => this.handleRequest(req, res, false));
    this.server.on("connect", (req, socket, head) => this.handleConnect(req, socket as net.Socket, head));
    this.httpsHandler.on("request", (req, res) => this.handleRequest(req, res, true));

    this.server.on("error", (err) => console.error("[Proxy] Server error:", err));
    this.httpsHandler.on("error", () => {});
  }

  async start(): Promise<void> {
    this.ca = await loadOrCreateCA(this.options.certsDir);

    await new Promise<void>((resolve, reject) => {
      this.server.listen(this.options.port, this.options.port ? undefined : "127.0.0.1", () => {
        console.log(`[Proxy] Listening on port ${this.options.port}`);
        resolve();
      });
      this.server.on("error", reject);
    });

    this._running = true;
    this.emit("status", { running: true });
  }

  async stop(): Promise<void> {
    this._running = false;
    this.server.closeAllConnections?.();
    this.httpsHandler.closeAllConnections?.();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
    this.emit("status", { running: false });
    console.log("[Proxy] Stopped");
  }

  isRunning(): boolean {
    return this._running;
  }

  getCertPem(): string | null {
    return this.ca?.certPem ?? null;
  }

  getStats() {
    const now = Date.now();
    this.recentTimestamps = this.recentTimestamps.filter(t => now - t < 60000);
    return {
      totalRequests: this.requestCount,
      activeConnections: this.activeConnections,
      requestsPerMinute: this.recentTimestamps.length,
      topHosts: [] as Array<{ host: string; count: number }>,
    };
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    isHttps: boolean,
  ): Promise<void> {
    this.activeConnections++;
    this.requestCount++;
    const now = Date.now();
    this.recentTimestamps.push(now);
    if (this.recentTimestamps.length > 6000) {
      this.recentTimestamps = this.recentTimestamps.filter(t => now - t < 60000);
    }

    const id = uuidv4();
    const clientIp = req.socket.remoteAddress ?? "";

    let url = req.url ?? "/";
    if (!url.startsWith("http") && isHttps) {
      const host = req.headers.host ?? "unknown";
      url = `https://${host}${url}`;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      res.writeHead(400);
      res.end("Bad Request");
      this.activeConnections--;
      return;
    }

    const maxBytes = this.options.maxBodySizeMb * 1024 * 1024;
    const rawBody = await collectBody(req, maxBytes).catch(() => null);
    const headers = parseHeaders(req.headers);
    const encoding = getEncoding(headers);
    let body: Buffer | null = rawBody;
    if (rawBody && encoding !== "identity") {
      body = await decodeBody(rawBody, encoding).catch(() => rawBody);
      delete headers["content-encoding"];
      delete headers["Content-Encoding"];
      if (body) headers["content-length"] = String(body.byteLength);
    }

    const rawReq: RawRequest = {
      id,
      timestamp: Date.now(),
      clientIp,
      method: req.method ?? "GET",
      url,
      host: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      httpVersion: req.httpVersion,
      headers,
      body,
      isHttps,
    };

    const ctx: InterceptContext = {
      request: rawReq,
      modified: false,
      dropped: false,
    };

    await this.interceptorChain.run(ctx);

    if (ctx.dropped) {
      res.writeHead(502);
      res.end("Request dropped by interceptor");
      this.activeConnections--;
      return;
    }

    let rawResponse;
    try {
      rawResponse = await forward(ctx.request, this.options.sslInsecure);
    } catch (err) {
      res.writeHead(502);
      res.end(`Bad Gateway: ${(err as Error).message}`);
      this.activeConnections--;
      return;
    }

    ctx.response = rawResponse;
    await this.interceptorChain.run(ctx);

    const { response } = ctx;
    if (!response) {
      res.writeHead(502);
      res.end();
      this.activeConnections--;
      return;
    }

    // Send response to client
    const resHeaders: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(response.headers)) {
      const kl = k.toLowerCase();
      if (kl !== "transfer-encoding") resHeaders[k] = v;
    }

    res.writeHead(response.statusCode, response.statusMessage, resHeaders);

    if (response.body) {
      res.write(response.body);
    }
    res.end();

    // Decode response body for storage; client already received raw encoded bytes
    if (response.body && response.bodyEncoding !== "identity") {
      const decoded = await decodeBody(response.body, response.bodyEncoding).catch(() => response.body!);
      ctx.response = { ...response, body: decoded, bodyEncoding: "identity" };
    }

    this.emit("packet", ctx);
    this.activeConnections--;
  }

  private async handleConnect(
    req: http.IncomingMessage,
    socket: net.Socket,
    _head: Buffer,
  ): Promise<void> {
    const hostPort = req.url ?? "";
    const colonIdx = hostPort.lastIndexOf(":");
    const hostname = hostPort.slice(0, colonIdx);
    const port = parseInt(hostPort.slice(colonIdx + 1)) || 443;

    socket.on("error", () => {});

    try {
      const { cert, key } = await this.certCache.getOrCreate(hostname, this.ca);

      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");

      const tlsSocket = new tls.TLSSocket(socket, {
        isServer: true,
        key,
        cert,
        SNICallback: async (servername, cb) => {
          try {
            const { cert: c, key: k } = await this.certCache.getOrCreate(servername, this.ca);
            const ctx = tls.createSecureContext({ key: k, cert: c });
            cb(null, ctx);
          } catch (err) {
            cb(err as Error);
          }
        },
      });

      tlsSocket.on("error", () => {});

      // Feed decrypted traffic to our HTTPS handler
      this.httpsHandler.emit("connection", tlsSocket);

      // Also set up a real upstream connection for passthrough if needed
      void port;
    } catch (err) {
      console.error(`[Proxy] CONNECT error for ${hostname}:`, err);
      socket.destroy();
    }
  }
}
