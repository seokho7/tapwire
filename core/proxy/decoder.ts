import zlib from "node:zlib";
import { promisify } from "node:util";
import type { IncomingMessage } from "node:http";

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);
const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);
const brotliCompress = promisify(zlib.brotliCompress);

export function getBodyType(contentType: string | undefined): "json" | "text" | "binary" {
  if (!contentType) return "binary";
  const ct = contentType.split(";")[0].trim().toLowerCase();
  if (ct === "application/json" || ct.endsWith("+json")) return "json";
  if (
    ct.startsWith("text/") ||
    ct === "application/xml" ||
    ct === "application/x-www-form-urlencoded" ||
    ct === "application/javascript" ||
    ct === "application/x-javascript" ||
    ct === "application/ecmascript" ||
    ct === "application/typescript" ||
    ct.includes("javascript") ||
    ct.endsWith("+xml") ||
    ct === "application/graphql" ||
    ct === "application/x-sh"
  ) return "text";
  return "binary";
}

export async function collectBody(stream: IncomingMessage, maxBytes = 10 * 1024 * 1024): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let truncated = false;

    stream.on("data", (chunk: Buffer) => {
      if (truncated) return;
      size += chunk.length;
      if (size > maxBytes) {
        truncated = true;
        return;
      }
      chunks.push(chunk);
    });

    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function decodeBody(buf: Buffer, encoding: string): Promise<Buffer> {
  try {
    const enc = encoding.toLowerCase();
    if (enc === "gzip" || enc === "x-gzip") return await gunzip(buf) as Buffer;
    if (enc === "deflate") return await inflate(buf) as Buffer;
    if (enc === "br") return await brotliDecompress(buf) as Buffer;
  } catch {
    // Return original if decode fails
  }
  return buf;
}

export async function encodeBody(buf: Buffer, encoding: string): Promise<Buffer> {
  const enc = encoding.toLowerCase();
  if (enc === "gzip" || enc === "x-gzip") return await gzip(buf) as Buffer;
  if (enc === "deflate") return await deflate(buf) as Buffer;
  if (enc === "br") return await brotliCompress(buf) as Buffer;
  return buf;
}

export function getEncoding(headers: Record<string, string | string[]>): "gzip" | "br" | "deflate" | "identity" {
  const ce = Array.isArray(headers["content-encoding"])
    ? headers["content-encoding"][0]
    : headers["content-encoding"] || "";
  const enc = ce.toLowerCase();
  if (enc.includes("gzip")) return "gzip";
  if (enc.includes("br")) return "br";
  if (enc.includes("deflate")) return "deflate";
  return "identity";
}
