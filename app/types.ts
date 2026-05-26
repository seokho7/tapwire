// Client-side types for PacketRecord (same shape as server, but all fields serialized)
export interface PacketRecord {
  id: string;
  timestamp: number;
  clientIp: string;
  method: string;
  url: string;
  host: string;
  path: string;
  httpVersion: string;
  isHttps: boolean;
  reqHeaders: Record<string, string | string[]>;
  reqBody: string | null;
  reqBodyType: "json" | "text" | "binary" | null;
  statusCode: number | null;
  statusMessage: string | null;
  resHeaders: Record<string, string | string[]> | null;
  resBody: string | null;
  resBodyType: "json" | "text" | "binary" | null;
  duration: number | null;
  contentType: string | null;
  tags: string[];
  intercepted: boolean;
  replayed: boolean;
  notes: string;
}
