import type Database from "better-sqlite3";
import type { Statement } from "better-sqlite3";
import type { PacketRecord, PacketFilter, PacketSummary, RawRequest, RawResponse } from "../proxy/types.js";
import { getBodyType } from "../proxy/decoder.js";

function getCharset(ct: string | undefined): string {
  if (!ct) return "utf8";
  const m = ct.match(/charset=["']?([^"';\s]+)/i);
  if (!m) return "utf8";
  return m[1].toLowerCase().replace("-", "");
}

function isEuckr(ct: string | undefined): boolean {
  const charset = getCharset(ct);
  return charset === "euckr" || charset === "euc-kr" || charset === "ksc5601" || charset === "ks_c_5601-1987";
}

function effectiveBodyType(ct: string | undefined, body: Buffer | null): "json" | "text" | "binary" {
  if (isEuckr(ct)) return "binary";
  const baseType = getBodyType(ct);
  if (baseType !== "binary" && body && body.length > 0) {
    if (body.toString("utf8").includes("\uFFFD")) return "binary";
  }
  return baseType;
}

function bodyToText(body: Buffer | null, ct: string | undefined): string | null {
  if (!body || body.length === 0) return null;
  const type = getBodyType(ct);
  if (type === "binary" || isEuckr(ct)) return body.toString("base64");
  const text = body.toString("utf8");
  if (text.includes("\uFFFD")) return body.toString("base64");
  return text;
}

function getContentType(headers: Record<string, string | string[]>): string | null {
  const ct = headers["content-type"];
  if (!ct) return null;
  return Array.isArray(ct) ? ct[0] : ct;
}

function headersToJson(h: Record<string, string | string[]> | null): string {
  return JSON.stringify(h ?? {});
}

const INSERT_SQL = `
  INSERT INTO packets (
    id, timestamp, client_ip, method, url, host, path, http_version, is_https,
    req_headers, req_body, req_body_type,
    status_code, status_msg, res_headers, res_body, res_body_type,
    duration, tags, notes, intercepted, replayed, content_type
  ) VALUES (
    @id, @timestamp, @clientIp, @method, @url, @host, @path, @httpVersion, @isHttps,
    @reqHeaders, @reqBody, @reqBodyType,
    @statusCode, @statusMsg, @resHeaders, @resBody, @resBodyType,
    @duration, @tags, @notes, @intercepted, @replayed, @contentType
  )
`;

const INSERT_OR_IGNORE_SQL = INSERT_SQL.replace("INSERT INTO", "INSERT OR IGNORE INTO");

export class PacketRepository {
  private stmtInsert: Statement;
  private stmtInsertOrIgnore: Statement;
  private stmtFindById: Statement;
  private stmtDelete: Statement;
  private stmtDeleteAll: Statement;
  private stmtDeleteByHost: Statement;
  private stmtUpdateTags: Statement;
  private stmtUpdateNotes: Statement;
  private stmtMarkIntercepted: Statement;
  private stmtTopHosts: Statement;

  constructor(private db: Database.Database) {
    this.stmtInsert = db.prepare(INSERT_SQL);
    this.stmtInsertOrIgnore = db.prepare(INSERT_OR_IGNORE_SQL);
    this.stmtFindById = db.prepare("SELECT * FROM packets WHERE id = ?");
    this.stmtDelete = db.prepare("DELETE FROM packets WHERE id = ?");
    this.stmtDeleteAll = db.prepare("DELETE FROM packets");
    this.stmtDeleteByHost = db.prepare("DELETE FROM packets WHERE host = ?");
    this.stmtUpdateTags = db.prepare("UPDATE packets SET tags = ? WHERE id = ?");
    this.stmtUpdateNotes = db.prepare("UPDATE packets SET notes = ? WHERE id = ?");
    this.stmtMarkIntercepted = db.prepare("UPDATE packets SET intercepted = 1 WHERE id = ?");
    this.stmtTopHosts = db.prepare(
      "SELECT host, COUNT(*) as count FROM packets GROUP BY host ORDER BY count DESC LIMIT ?"
    );
  }

  insert(req: RawRequest, res: RawResponse): string {
    const reqCt = getContentType(req.headers);
    const resCt = res.headers ? getContentType(res.headers as Record<string, string | string[]>) : null;

    this.stmtInsert.run({
      id: req.id,
      timestamp: req.timestamp,
      clientIp: req.clientIp,
      method: req.method,
      url: req.url,
      host: req.host,
      path: req.path,
      httpVersion: req.httpVersion,
      isHttps: req.isHttps ? 1 : 0,
      reqHeaders: headersToJson(req.headers),
      reqBody: bodyToText(req.body, reqCt ?? undefined),
      reqBodyType: effectiveBodyType(reqCt ?? undefined, req.body),
      statusCode: res.statusCode,
      statusMsg: res.statusMessage,
      resHeaders: headersToJson(res.headers as Record<string, string | string[]>),
      resBody: bodyToText(res.body, resCt ?? undefined),
      resBodyType: effectiveBodyType(resCt ?? undefined, res.body),
      duration: res.duration,
      tags: "[]",
      notes: "",
      intercepted: 0,
      replayed: 0,
      contentType: resCt ?? reqCt,
    });

    return req.id;
  }

  findById(id: string): PacketRecord | undefined {
    const row = this.stmtFindById.get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.toRecord(row);
  }

  private buildWhere(filter: PacketFilter): { clause: string; params: unknown[] } {
    let clause = " WHERE 1=1";
    const params: unknown[] = [];
    if (filter.host) { clause += " AND host LIKE ?"; params.push(`%${filter.host}%`); }
    if (filter.method) { clause += " AND method = ?"; params.push(filter.method.toUpperCase()); }
    if (filter.statusCode) { clause += " AND status_code = ?"; params.push(filter.statusCode); }
    if (filter.search) {
      const s = `%${filter.search}%`;
      if (filter.deep) {
        clause += " AND (url LIKE ? OR host LIKE ? OR req_headers LIKE ? OR res_headers LIKE ? OR req_body LIKE ? OR res_body LIKE ?)";
        params.push(s, s, s, s, s, s);
      } else {
        clause += " AND (url LIKE ? OR host LIKE ?)";
        params.push(s, s);
      }
    }
    if (filter.fromTs) { clause += " AND timestamp >= ?"; params.push(filter.fromTs); }
    if (filter.toTs) { clause += " AND timestamp <= ?"; params.push(filter.toTs); }
    return { clause, params };
  }

  findAllSummary(filter: PacketFilter = {}): PacketSummary[] {
    const { clause, params } = this.buildWhere(filter);
    const sql = `SELECT id, timestamp, method, url, host, path, status_code, status_msg,
      content_type, duration, is_https, tags, intercepted, replayed
      FROM packets${clause}
      ORDER BY timestamp DESC
      LIMIT ${filter.limit ?? 100} OFFSET ${filter.offset ?? 0}`;
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(r => ({
      id: r.id as string,
      timestamp: r.timestamp as number,
      method: r.method as string,
      url: r.url as string,
      host: r.host as string,
      path: r.path as string,
      statusCode: r.status_code as number | null,
      statusMessage: r.status_msg as string | null,
      contentType: r.content_type as string | null,
      duration: r.duration as number | null,
      isHttps: (r.is_https as number) === 1,
      tags: JSON.parse(r.tags as string || "[]"),
      intercepted: (r.intercepted as number) === 1,
      replayed: (r.replayed as number) === 1,
    }));
  }

  findAll(filter: PacketFilter = {}): PacketRecord[] {
    const { clause, params } = this.buildWhere(filter);
    const sql = `SELECT * FROM packets${clause}
      ORDER BY timestamp DESC
      LIMIT ${filter.limit ?? 100} OFFSET ${filter.offset ?? 0}`;
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(r => this.toRecord(r));
  }

  count(filter: PacketFilter = {}): number {
    const { clause, params } = this.buildWhere(filter);
    const sql = `SELECT COUNT(*) as n FROM packets${clause}`;
    const row = this.db.prepare(sql).get(...params) as { n: number };
    return row.n;
  }

  updateTags(id: string, tags: string[]): void {
    this.stmtUpdateTags.run(JSON.stringify(tags), id);
  }

  updateNotes(id: string, notes: string): void {
    this.stmtUpdateNotes.run(notes, id);
  }

  markIntercepted(id: string): void {
    this.stmtMarkIntercepted.run(id);
  }

  insertRecord(r: PacketRecord): void {
    this.stmtInsertOrIgnore.run({
      id: r.id,
      timestamp: r.timestamp,
      clientIp: r.clientIp,
      method: r.method,
      url: r.url,
      host: r.host,
      path: r.path,
      httpVersion: r.httpVersion,
      isHttps: r.isHttps ? 1 : 0,
      reqHeaders: JSON.stringify(r.reqHeaders ?? {}),
      reqBody: r.reqBody,
      reqBodyType: r.reqBodyType,
      statusCode: r.statusCode,
      statusMsg: r.statusMessage,
      resHeaders: r.resHeaders ? JSON.stringify(r.resHeaders) : null,
      resBody: r.resBody,
      resBodyType: r.resBodyType,
      duration: r.duration,
      tags: JSON.stringify(r.tags ?? []),
      notes: r.notes ?? "",
      intercepted: r.intercepted ? 1 : 0,
      replayed: r.replayed ? 1 : 0,
      contentType: r.contentType,
    });
  }

  delete(id: string): void {
    this.stmtDelete.run(id);
  }

  deleteAll(): void {
    this.stmtDeleteAll.run();
  }

  deleteByHost(host: string): void {
    this.stmtDeleteByHost.run(host);
  }

  deleteStatic(category: "css" | "js" | "image" | "font" | "all" = "all"): number {
    const PATTERNS: Record<string, string[]> = {
      css: ["text/css"],
      js: ["application/javascript", "text/javascript"],
      image: ["image/"],
      font: ["font/", "application/font", "application/x-font"],
      all: ["text/css", "application/javascript", "text/javascript", "image/", "font/", "application/font", "application/x-font"],
    };
    const patterns = PATTERNS[category];
    const conditions = patterns.map(() => "content_type LIKE ?").join(" OR ");
    const result = this.db.prepare(`DELETE FROM packets WHERE ${conditions}`).run(
      ...patterns.map((p) => `%${p}%`)
    );
    return result.changes;
  }

  getTopHosts(limit = 10): Array<{ host: string; count: number }> {
    return this.stmtTopHosts.all(limit) as Array<{ host: string; count: number }>;
  }

  private toRecord(row: Record<string, unknown>): PacketRecord {
    return {
      id: row.id as string,
      timestamp: row.timestamp as number,
      clientIp: row.client_ip as string,
      method: row.method as string,
      url: row.url as string,
      host: row.host as string,
      path: row.path as string,
      httpVersion: row.http_version as string,
      isHttps: (row.is_https as number) === 1,
      reqHeaders: JSON.parse(row.req_headers as string || "{}"),
      reqBody: row.req_body as string | null,
      reqBodyType: row.req_body_type as "json" | "text" | "binary" | null,
      statusCode: row.status_code as number | null,
      statusMessage: row.status_msg as string | null,
      resHeaders: row.res_headers ? JSON.parse(row.res_headers as string) : null,
      resBody: row.res_body as string | null,
      resBodyType: row.res_body_type as "json" | "text" | "binary" | null,
      duration: row.duration as number | null,
      tags: JSON.parse(row.tags as string || "[]"),
      notes: row.notes as string,
      intercepted: (row.intercepted as number) === 1,
      replayed: (row.replayed as number) === 1,
      contentType: row.content_type as string | null,
    } as unknown as PacketRecord;
  }
}
