import type { PacketRecord } from "../core/proxy/types.js";

export function packet(overrides: Partial<PacketRecord> = {}): PacketRecord {
  return {
    id: "packet-1", timestamp: 1700000000000, clientIp: "127.0.0.1", method: "GET",
    url: "https://example.test/api?q=한글", host: "example.test", path: "/api?q=한글",
    httpVersion: "1.1", isHttps: true, reqHeaders: { accept: "application/json" },
    reqBody: null, reqBodyType: "text", statusCode: 200, statusMessage: "OK",
    resHeaders: { "content-type": "application/json", "set-cookie": ["a=1", "b=2"] },
    resBody: '{"message":"한글 😀","spaces":  true}', resBodyType: "json",
    duration: 1.25, contentType: "application/json", tags: ["test", "한글"],
    intercepted: false, replayed: true, notes: "", ...overrides,
  };
}
