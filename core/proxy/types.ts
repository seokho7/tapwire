export interface ProxyOptions {
  port: number;
  uiPort: number;
  certsDir: string;
  sslInsecure: boolean;
  maxBodySizeMb: number;
}

export interface RawRequest {
  id: string;
  timestamp: number;
  clientIp: string;
  method: string;
  url: string;
  host: string;
  path: string;
  httpVersion: string;
  headers: Record<string, string | string[]>;
  body: Buffer | null;
  isHttps: boolean;
}

export interface RawResponse {
  id: string;
  timestamp: number;
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string | string[]>;
  body: Buffer | null;
  duration: number;
  bodyEncoding: "gzip" | "br" | "deflate" | "identity";
}

export interface InterceptContext {
  request: RawRequest;
  response?: RawResponse;
  modified: boolean;
  dropped: boolean;
}

export type InterceptorFn = (ctx: InterceptContext) => Promise<void>;

export interface PacketSummary {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  host: string;
  path: string;
  statusCode: number | null;
  statusMessage: string | null;
  contentType: string | null;
  duration: number | null;
  isHttps: boolean;
  tags: string[];
  intercepted: boolean;
  replayed: boolean;
}

export interface PacketRecord extends PacketSummary {
  clientIp: string;
  httpVersion: string;
  reqHeaders: Record<string, string | string[]>;
  reqBody: string | null;
  reqBodyType: "json" | "text" | "binary" | null;
  resHeaders: Record<string, string | string[]> | null;
  resBody: string | null;
  resBodyType: "json" | "text" | "binary" | null;
  notes: string;
}

export interface PacketFilter {
  host?: string;
  method?: string;
  statusCode?: number;
  search?: string;
  deep?: boolean;
  fromTs?: number;
  toTs?: number;
  limit?: number;
  offset?: number;
}

export interface ProxyStats {
  totalRequests: number;
  activeConnections: number;
  requestsPerMinute: number;
  topHosts: Array<{ host: string; count: number }>;
}

export interface InterceptPausedPacket {
  id: string;
  method: string;
  url: string;
  host: string;
  path: string;
  isHttps: boolean;
  reqHeaders: Record<string, string | string[]>;
  reqBody: string | null;
  reqBodyType: "json" | "text" | "binary" | null;
  contentType: string | null;
}

export type WsEvent =
  | { type: "packet:new"; data: PacketSummary }
  | { type: "packet:updated"; data: PacketSummary }
  | { type: "intercept:paused"; data: { id: string; packet: InterceptPausedPacket } }
  | { type: "replay:progress"; data: { id: string; index: number; total: number } }
  | { type: "proxy:stats"; data: ProxyStats }
  | { type: "proxy:status"; data: { running: boolean } };
