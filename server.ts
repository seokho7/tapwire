import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { createServer } from "node:http";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import iconv from "iconv-lite";
import {
  gzip as gzipCb, gunzip as gunzipCb,
  brotliCompress as brotliCompressCb, brotliDecompress as brotliDecompressCb,
  constants as zlibConstants,
} from "node:zlib";
import compression from "compression";
import express from "express";
import { fileURLToPath } from "node:url";
import { v4 as uuidv4 } from "uuid";

import { ProxyServer } from "./core/proxy/proxyServer.js";
import { getDb } from "./core/storage/db.js";
import { PacketRepository } from "./core/storage/repository.js";
import { WsBroadcaster } from "./core/ws/broadcaster.js";
import { PauseRegistry } from "./core/proxy/interceptor.js";
import { registry } from "./core/registry.js";
import { toSession, parseSession } from "./core/storage/session.js";
import { toHar, parseHar } from "./core/storage/har.js";
import { replayOne, editAndSend } from "./core/replay/single.js";
import { getBodyType } from "./core/proxy/decoder.js";
import type { InterceptContext, RawRequest, RawResponse } from "./core/proxy/types.js";

const gzip = promisify(gzipCb);
const gunzip = promisify(gunzipCb);
const brotliCompress = promisify(brotliCompressCb);
const brotliDecompress = promisify(brotliDecompressCb);

// "TW\x02" magic prefix = tapwire brotli format
const TW_MAGIC = Buffer.from([0x54, 0x57, 0x02]);

async function compressSession(json: Buffer): Promise<Buffer> {
  const compressed = await brotliCompress(json, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
  });
  return Buffer.concat([TW_MAGIC, compressed]);
}

async function decompressSession(buf: Buffer): Promise<Buffer> {
  if (buf[0] === 0x54 && buf[1] === 0x57 && buf[2] === 0x02) {
    return brotliDecompress(buf.slice(3));
  }
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    return gunzip(buf);
  }
  return buf; // raw JSON fallback
}

interface BreakpointRule {
  id: string;
  pattern: string;
  method?: string;
  enabled: boolean;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== "production";

const PROXY_PORT = parseInt(process.env.PROXY_PORT ?? "8080");
const UI_PORT = parseInt(process.env.UI_PORT ?? "8081");
const CERTS_DIR = process.env.CERTS_DIR ?? "./certs";
const DATA_DIR = process.env.DATA_DIR ?? "./data";
const MAX_BODY_SIZE_MB = parseInt(process.env.MAX_BODY_SIZE_MB ?? "10");
const SSL_INSECURE = process.env.PROXY_SSL_INSECURE === "true";

function getContentType(headers: Record<string, string | string[]>): string | null {
  const ct = headers["content-type"];
  if (!ct) return null;
  return Array.isArray(ct) ? ct[0].split(";")[0] : ct.split(";")[0];
}

function packetSummary(req: RawRequest, res: RawResponse, intercepted: boolean, replayed: boolean) {
  return {
    id: req.id,
    timestamp: req.timestamp,
    method: req.method,
    url: req.url,
    host: req.host,
    path: req.path,
    statusCode: res.statusCode,
    statusMessage: res.statusMessage,
    contentType: getContentType(res.headers as Record<string, string | string[]>),
    duration: res.duration,
    isHttps: req.isHttps,
    tags: [] as string[],
    intercepted,
    replayed,
  };
}

async function main() {
  const proxy = new ProxyServer({
    port: PROXY_PORT,
    uiPort: UI_PORT,
    certsDir: CERTS_DIR,
    sslInsecure: SSL_INSECURE,
    maxBodySizeMb: MAX_BODY_SIZE_MB,
  });

  const db = getDb(DATA_DIR);
  const repo = new PacketRepository(db);
  const pauser = new PauseRegistry();
  const app = express();
  const httpServer = createServer(app);
  const broadcaster = new WsBroadcaster(httpServer);

  registry.proxy = proxy;
  registry.repo = repo;
  registry.broadcaster = broadcaster;
  registry.pauser = pauser;

  const breakpointRules: BreakpointRule[] = [];
  const interceptedRequestsMap = new Map<string, RawRequest>();

  proxy.interceptorChain.use(async (ctx) => {
    if (ctx.response) return;
    if (pauser.getIds().length > 0) return; // already intercepting one request

    const matchingRule = breakpointRules.find(r => {
      if (!r.enabled) return false;
      if (r.method && r.method !== ctx.request.method) return false;
      return ctx.request.url.includes(r.pattern) || (ctx.request.host + ctx.request.path).includes(r.pattern);
    });
    if (!matchingRule) return;

    interceptedRequestsMap.set(ctx.request.id, ctx.request);

    const reqCt = getContentType(ctx.request.headers as Record<string, string | string[]>);
    const reqBodyType = getBodyType(reqCt ?? undefined);
    const reqBodyStr = ctx.request.body
      ? (reqBodyType === "binary"
          ? ctx.request.body.toString("base64")
          : ctx.request.body.toString("utf8"))
      : null;

    broadcaster.broadcast({
      type: "intercept:paused",
      data: {
        id: ctx.request.id,
        packet: {
          id: ctx.request.id,
          method: ctx.request.method,
          url: ctx.request.url,
          host: ctx.request.host,
          path: ctx.request.path,
          isHttps: ctx.request.isHttps,
          reqHeaders: ctx.request.headers,
          reqBody: reqBodyStr,
          reqBodyType,
          contentType: reqCt,
        },
      },
    });

    try {
      const resumedCtx = await pauser.pause(ctx);
      ctx.request = resumedCtx.request;
      ctx.modified = resumedCtx.modified;
      if (resumedCtx.dropped) ctx.dropped = true;
    } catch {
      ctx.dropped = true;
    }

    interceptedRequestsMap.delete(ctx.request.id);
  });

  proxy.on("packet", (ctx: InterceptContext) => {
    if (!ctx.response) return;
    try { repo.insert(ctx.request, ctx.response); } catch (err) {
      console.error("[Storage] Insert error:", err);
    }
    broadcaster.broadcast({ type: "packet:new", data: packetSummary(ctx.request, ctx.response, ctx.modified, false) });
  });

  proxy.on("status", (data: { running: boolean }) => {
    broadcaster.broadcast({ type: "proxy:status", data });
  });

  app.use(compression());
  app.use(express.json({ limit: "100mb" }));
  app.use(express.raw({ type: "application/octet-stream", limit: "100mb" }));

  // ── API Routes ─────────────────────────────────────────────────────────────
  const api = express.Router();

  // Packets list
  api.get("/packets", (req, res) => {
    if (!repo) return void res.status(503).json({ error: "Not initialized" });
    const q = req.query as Record<string, string>;
    const filter = {
      host: q.host || undefined,
      method: q.method || undefined,
      search: q.search || undefined,
      deep: q.deep === "true",
      limit: parseInt(q.limit ?? "200"),
      offset: parseInt(q.offset ?? "0"),
    };
    const items = q.full === "true" ? repo.findAll(filter) : repo.findAllSummary(filter);
    const total = repo.count(filter);
    res.json({ total, items });
  });

  // Delete all packets
  api.delete("/packets", (req, res) => {
    if (!repo) return void res.status(503).json({ error: "Not initialized" });
    const host = req.query.host as string | undefined;
    const staticParam = req.query.static as string | undefined;
    if (host) repo.deleteByHost(host);
    else if (staticParam) {
      const cat = (["css", "js", "image", "font"].includes(staticParam) ? staticParam : "all") as "css" | "js" | "image" | "font" | "all";
      const n = repo.deleteStatic(cat);
      return void res.json({ ok: true, deleted: n });
    }
    else repo.deleteAll();
    res.json({ ok: true });
  });

  // Single packet
  api.get("/packets/:id", (req, res) => {
    if (!repo) return void res.status(503).json({ error: "Not initialized" });
    const packet = repo.findById(req.params.id);
    if (!packet) return void res.status(404).json({ error: "Not found" });
    res.json(packet);
  });

  api.delete("/packets/:id", (req, res) => {
    if (!repo) return void res.status(503).json({ error: "Not initialized" });
    repo.delete(req.params.id);
    res.json({ ok: true });
  });

  api.patch("/packets/:id", (req, res) => {
    if (!repo) return void res.status(503).json({ error: "Not initialized" });
    const body = req.body as { tags?: string[]; notes?: string };
    if (body.tags) repo.updateTags(req.params.id, body.tags);
    if (body.notes !== undefined) repo.updateNotes(req.params.id, body.notes);
    res.json({ ok: true });
  });

  // Stats
  api.get("/stats", (req, res) => {
    if (!proxy || !repo) return void res.status(503).json({ error: "Not initialized" });
    const stats = proxy.getStats();
    const topHosts = repo.getTopHosts(10);
    res.json({ ...stats, topHosts });
  });

  // Session export/import
  api.get("/session", async (req, res) => {
    if (!repo) return void res.status(503).json({ error: "Not initialized" });
    const limit = parseInt((req.query.limit as string) ?? "100000");
    const packets = repo.findAll({ limit, offset: 0 });
    const session = toSession(packets);
    // Strip nulls before compressing — reduces JSON size significantly
    const json = Buffer.from(JSON.stringify(session, (_, v) => (v === null ? undefined : v)));
    const compressed = await compressSession(json);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="tapwire-${Date.now()}.wspy"`);
    res.send(compressed);
  });

  api.post("/session", async (req, res) => {
    if (!repo) return void res.status(503).json({ error: "Not initialized" });
    let data: unknown = req.body;
    if (Buffer.isBuffer(data)) {
      try {
        const buf = await decompressSession(data);
        data = JSON.parse(buf.toString("utf8"));
      } catch {
        return void res.status(400).json({ error: "Invalid or corrupted .wspy file" });
      }
    }
    let packets;
    try {
      packets = parseSession(data);
    } catch {
      return void res.status(400).json({ error: "Invalid .wspy file" });
    }
    let imported = 0;
    for (const packet of packets) {
      try {
        repo.insertRecord(packet);
        broadcaster.broadcast({
          type: "packet:new",
          data: {
            id: packet.id,
            timestamp: packet.timestamp,
            method: packet.method,
            url: packet.url,
            host: packet.host,
            path: packet.path,
            statusCode: packet.statusCode,
            statusMessage: packet.statusMessage,
            contentType: packet.resHeaders
              ? getContentType(packet.resHeaders as Record<string, string | string[]>)
              : packet.contentType,
            duration: packet.duration,
            isHttps: packet.isHttps,
            tags: packet.tags ?? [],
            intercepted: packet.intercepted,
            replayed: packet.replayed,
          },
        });
        imported++;
      } catch { /* skip duplicates */ }
    }
    res.json({ imported });
  });

  // HAR export/import
  api.get("/har", (req, res) => {
    if (!repo) return void res.status(503).json({ error: "Not initialized" });
    const limit = parseInt((req.query.limit as string) ?? "10000");
    const packets = repo.findAll({ limit, offset: 0 });
    const har = toHar(packets);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="tapwire-${Date.now()}.har"`);
    res.send(JSON.stringify(har, null, 2));
  });

  api.post("/har", (req, res) => {
    if (!repo) return void res.status(503).json({ error: "Not initialized" });
    let pairs;
    try {
      pairs = parseHar(req.body);
    } catch {
      return void res.status(400).json({ error: "Invalid HAR file" });
    }
    let imported = 0;
    for (const { req: r, res: s } of pairs) {
      try {
        repo.insert(r, s);
        broadcaster.broadcast({ type: "packet:new", data: packetSummary(r, s, false, false) });
        imported++;
      } catch { /* skip */ }
    }
    res.json({ imported });
  });

  // Replay
  api.post("/replay/:id", async (req, res) => {
    if (!repo) return void res.status(503).json({ error: "Not initialized" });
    const packet = repo.findById(req.params.id);
    if (!packet) return void res.status(404).json({ error: "Not found" });
    try {
      const { req: newReq, res: newRes } = await replayOne(packet);
      repo.insert(newReq, newRes);
      broadcaster.broadcast({ type: "packet:new", data: packetSummary(newReq, newRes, false, true) });
      res.json({ replayId: newReq.id, statusCode: newRes.statusCode, duration: newRes.duration });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Intercept
  api.put("/intercept/:id", async (req, res) => {
    if (!pauser) return void res.status(503).json({ error: "Not initialized" });
    const id = req.params.id;
    const body = req.body as {
      request?: { method?: string; url?: string; headers?: Record<string, string>; body?: string | null };
    };

    if (pauser.has(id)) {
      const reqEdit = body.request ?? {};
      const original = interceptedRequestsMap.get(id);
      let mergedRequest: RawRequest;
      if (original) {
        const newUrl = reqEdit.url ?? original.url;
        let parsedUrl: URL;
        try { parsedUrl = new URL(newUrl); } catch { parsedUrl = new URL(original.url); }
        mergedRequest = {
          ...original,
          method: reqEdit.method ?? original.method,
          url: newUrl,
          host: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          headers: reqEdit.headers ?? original.headers,
          body: reqEdit.body != null ? Buffer.from(reqEdit.body) : original.body,
        };
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mergedRequest = reqEdit as any as RawRequest;
      }
      pauser.resume(id, { request: mergedRequest, modified: Object.keys(reqEdit).length > 0, dropped: false });
      return void res.json({ ok: true });
    }

    if (!repo) return void res.status(503).json({ error: "Not initialized" });
    const packet = repo.findById(id);
    if (!packet) return void res.status(404).json({ error: "Not found" });
    try {
      const { req: newReq, res: newRes } = await editAndSend(packet, body.request ?? {});
      repo.insert(newReq, newRes);
      broadcaster.broadcast({ type: "packet:new", data: packetSummary(newReq, newRes, true, false) });
      res.json({ ok: true, replayId: newReq.id });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  api.delete("/intercept/:id", (req, res) => {
    if (!pauser) return void res.status(503).json({ error: "Not initialized" });
    const ok = pauser.drop(req.params.id);
    res.json({ ok });
  });

  // Breakpoint rules
  api.get("/breakpoints", (_req, res) => {
    res.json(breakpointRules);
  });

  api.post("/breakpoints", (req, res) => {
    const { pattern, method } = req.body as { pattern?: string; method?: string };
    if (!pattern?.trim()) return void res.status(400).json({ error: "pattern required" });
    const rule: BreakpointRule = {
      id: uuidv4(),
      pattern: pattern.trim(),
      method: method?.toUpperCase() || undefined,
      enabled: true,
    };
    breakpointRules.push(rule);
    res.json(rule);
  });

  api.patch("/breakpoints/:id", (req, res) => {
    const rule = breakpointRules.find(r => r.id === req.params.id);
    if (!rule) return void res.status(404).json({ error: "not found" });
    const { enabled, pattern, method } = req.body as Partial<BreakpointRule>;
    if (enabled !== undefined) rule.enabled = enabled;
    if (pattern !== undefined) rule.pattern = pattern;
    if (method !== undefined) rule.method = method;
    res.json(rule);
  });

  api.delete("/breakpoints/:id", (req, res) => {
    const idx = breakpointRules.findIndex(r => r.id === req.params.id);
    if (idx === -1) return void res.status(404).json({ error: "not found" });
    breakpointRules.splice(idx, 1);
    res.json({ ok: true });
  });

  // Launch browser with proxy
  api.post("/launch-browser", (req: express.Request, res: express.Response) => {
    const browser = (req.body as { browser?: string })?.browser ?? "whale";

    if (browser === "firefox") {
      const profileDir = "/tmp/tapwire-ff-profile";
      const userJs = [
        `user_pref("network.proxy.type", 1);`,
        `user_pref("network.proxy.http", "localhost");`,
        `user_pref("network.proxy.http_port", ${PROXY_PORT});`,
        `user_pref("network.proxy.ssl", "localhost");`,
        `user_pref("network.proxy.ssl_port", ${PROXY_PORT});`,
        `user_pref("network.proxy.no_proxies_on", "");`,
      ].join("\n");
      try {
        fs.mkdirSync(profileDir, { recursive: true });
        fs.writeFileSync(path.join(profileDir, "user.js"), userJs, "utf8");
      } catch (e) {
        return void res.status(500).json({ error: `Failed to create Firefox profile: ${(e as Error).message}` });
      }
      exec(`open -a Firefox --args --profile "${profileDir}" --no-remote`, (err) => {
        if (err) return void res.status(500).json({ error: `Firefox not found: ${err.message}` });
        res.json({ ok: true });
      });
      return;
    }

    const cmds: Record<string, string> = {
      chrome: `open -a "Google Chrome" --args --proxy-server=localhost:${PROXY_PORT}`,
      whale: `open -a Whale --args --proxy-server=localhost:${PROXY_PORT}`,
    };
    const cmd = cmds[browser] ?? cmds.whale;
    exec(cmd, (err) => {
      if (err) return void res.status(500).json({ error: err.message });
      res.json({ ok: true });
    });
  });

  // EUC-KR conversion utility
  api.post("/utils/euckr", (req: express.Request, res: express.Response) => {
    const { text, direction } = req.body as { text: string; direction: "to" | "from" };
    if (!text || !direction) return void res.status(400).json({ error: "text and direction required" });
    try {
      if (direction === "to") {
        const buf = iconv.encode(text, "euc-kr");
        const urlEncoded = Array.from(buf).map((b) => `%${b.toString(16).toUpperCase().padStart(2, "0")}`).join("");
        res.json({ result: urlEncoded });
      } else {
        const cleaned = text.trim().replace(/\s+/g, "");
        const bytes: number[] = [];
        if (cleaned.includes("%")) {
          // percent-encoded: %B0%A1%B3%AA
          const parts = cleaned.split("%").filter(Boolean);
          for (const p of parts) bytes.push(parseInt(p.slice(0, 2), 16));
        } else {
          // raw hex pairs: B0A1B3AA
          for (let i = 0; i + 1 < cleaned.length; i += 2) {
            bytes.push(parseInt(cleaned.slice(i, i + 2), 16));
          }
        }
        const result = iconv.decode(Buffer.from(bytes), "euc-kr");
        res.json({ result });
      }
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // CA certificate
  api.get("/ca", (req, res) => {
    const certPem = proxy.getCertPem();
    if (!certPem) return void res.status(503).send("CA not initialized");
    res.setHeader("Content-Type", "application/x-x509-ca-cert");
    res.setHeader("Content-Disposition", 'attachment; filename="tapwire-ca.crt"');
    res.send(certPem);
  });

  // Setup info (local IP, ports)
  api.get("/setup", async (_req, res) => {
    const os = await import("node:os");
    const interfaces = os.networkInterfaces();
    let localIp = "127.0.0.1";
    for (const iface of Object.values(interfaces)) {
      for (const addr of iface ?? []) {
        if (addr.family === "IPv4" && !addr.internal) { localIp = addr.address; break; }
      }
    }
    res.json({ localIp, proxyPort: PROXY_PORT, uiPort: UI_PORT });
  });

  // Config (env vars read-only)
  api.get("/config", (_req, res) => {
    res.json({ proxyPort: PROXY_PORT, sslInsecure: SSL_INSECURE, maxBodyMb: MAX_BODY_SIZE_MB });
  });

  // 404 for unknown API routes
  api.use((_req, res) => res.status(404).json({ error: "Not found" }));

  app.use("/api", api);
  // ── End API Routes ──────────────────────────────────────────────────────────

  // Static / SPA serving
  if (isDev) {
    const vite = await import("vite");
    const viteServer = await vite.createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteServer.middlewares);
  } else {
    app.use(
      "/assets",
      express.static(path.join(__dirname, "build/client/assets"), {
        immutable: true,
        maxAge: "1y",
      }),
    );
    app.use(express.static(path.join(__dirname, "build/client")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "build/client/index.html"));
    });
  }

  await proxy.start();

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const timer = setTimeout(() => process.exit(0), 3000);
    timer.unref();
    try {
      httpServer.closeAllConnections?.();
      httpServer.close();
      await proxy.stop();
    } catch { /* ignore */ }
    clearTimeout(timer);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  httpServer.listen(UI_PORT, () => {
    console.log(`[Web] UI ready at http://localhost:${UI_PORT}`);
    console.log(`[WS] WebSocket at ws://localhost:${UI_PORT}/ws`);
  });
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
