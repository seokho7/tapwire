import { useEffect, useRef } from "react";
import { useStore } from "../store/index";
import type { PacketRecord } from "~/types";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const retryDelay = useRef(1000);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();

  const addPacket = useStore((s) => s.addPacket);
  const updatePacket = useStore((s) => s.updatePacket);
  const setWsConnected = useStore((s) => s.setWsConnected);
  const openIntercept = useStore((s) => s.openIntercept);

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        retryDelay.current = 1000;
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
        retryTimer.current = setTimeout(() => {
          retryDelay.current = Math.min(retryDelay.current * 2, 30000);
          connect();
        }, retryDelay.current);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          switch (msg.type) {
            case "packet:new":
              addPacket(msg.data);
              break;
            case "packet:updated":
              updatePacket(msg.data);
              break;
            case "intercept:paused": {
              const d = msg.data.packet;
              const packet: PacketRecord = {
                id: d.id,
                timestamp: Date.now(),
                clientIp: "",
                method: d.method,
                url: d.url,
                host: d.host,
                path: d.path,
                httpVersion: "1.1",
                isHttps: d.isHttps,
                reqHeaders: d.reqHeaders ?? {},
                reqBody: d.reqBody,
                reqBodyType: d.reqBodyType,
                statusCode: null,
                statusMessage: null,
                resHeaders: null,
                resBody: null,
                resBodyType: null,
                duration: null,
                contentType: d.contentType,
                tags: [],
                intercepted: true,
                replayed: false,
                notes: "",
              };
              openIntercept(packet, Date.now() + 30000);
              break;
            }
          }
        } catch {
          // ignore parse errors
        }
      };
    }

    connect();

    return () => {
      clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
  }, [addPacket, updatePacket, setWsConnected, openIntercept]);
}
