import { v4 as uuidv4 } from "uuid";
import type { PacketRecord, RawRequest, RawResponse } from "../proxy/types.js";
import { forward } from "../proxy/forwarder.js";
import { decodeBody } from "../proxy/decoder.js";

export interface ReplayResult {
  req: RawRequest;
  res: RawResponse;
}

export interface ReplayOptions {
  modifyRequest?: Partial<RawRequest>;
  followRedirects?: boolean;
  timeout?: number;
}

async function decodeIfNeeded(res: RawResponse): Promise<RawResponse> {
  if (!res.body || res.bodyEncoding === "identity") return res;
  const decoded = await decodeBody(res.body, res.bodyEncoding).catch(() => res.body!);
  return { ...res, body: decoded, bodyEncoding: "identity" };
}

function reqBodyFromRecord(packet: PacketRecord): Buffer | null {
  if (!packet.reqBody) return null;
  return packet.reqBodyType === "binary"
    ? Buffer.from(packet.reqBody, "base64")
    : Buffer.from(packet.reqBody, "utf8");
}

export async function replayOne(
  packet: PacketRecord,
  options: ReplayOptions = {},
): Promise<ReplayResult> {
  const headers: Record<string, string | string[]> = { ...packet.reqHeaders };
  delete headers["content-encoding"];
  delete headers["Content-Encoding"];

  const body = reqBodyFromRecord(packet);
  if (body) headers["content-length"] = String(body.byteLength);

  const req: RawRequest = {
    id: uuidv4(),
    timestamp: Date.now(),
    clientIp: "replay",
    method: packet.method,
    url: packet.url,
    host: packet.host,
    path: packet.path,
    httpVersion: packet.httpVersion,
    headers,
    body,
    isHttps: packet.isHttps,
    ...options.modifyRequest,
  };

  const raw = await forward(req, false);
  return { req, res: await decodeIfNeeded(raw) };
}

export async function editAndSend(
  packet: PacketRecord,
  mods: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: string | null;
  },
): Promise<ReplayResult> {
  const newUrl = mods.url ?? packet.url;
  const parsedUrl = new URL(newUrl);

  const reqBody =
    mods.body != null
      ? Buffer.from(mods.body, "utf8")
      : reqBodyFromRecord(packet);

  const headers: Record<string, string | string[]> = { ...(mods.headers ?? packet.reqHeaders) };
  delete headers["content-encoding"];
  delete headers["Content-Encoding"];
  if (reqBody) headers["content-length"] = String(reqBody.byteLength);

  const req: RawRequest = {
    id: uuidv4(),
    timestamp: Date.now(),
    clientIp: "edit-send",
    method: mods.method ?? packet.method,
    url: newUrl,
    host: parsedUrl.hostname,
    path: parsedUrl.pathname + parsedUrl.search,
    httpVersion: packet.httpVersion,
    headers,
    body: reqBody,
    isHttps: parsedUrl.protocol === "https:",
  };

  const raw = await forward(req, false);
  return { req, res: await decodeIfNeeded(raw) };
}
