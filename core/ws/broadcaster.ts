import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import type { WsEvent } from "../proxy/types.js";

export class WsBroadcaster {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
      this.clients.add(ws);

      ws.on("close", () => this.clients.delete(ws));
      ws.on("error", () => this.clients.delete(ws));

      // Send initial status
      this.send(ws, { type: "proxy:status", data: { running: true } });
    });
  }

  broadcast(event: WsEvent): void {
    const msg = JSON.stringify(event);
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }

  send(ws: WebSocket, event: WsEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
