import { useRef, useState } from "react";
import { useWebSocket } from "~/hooks/useWebSocket";
import { PacketList } from "~/components/capture/PacketList";
import { PacketDetail } from "~/components/capture/PacketDetail/index";

export function meta() {
  return [{ title: "Live Capture — Tapwire" }];
}

export default function Index() {
  useWebSocket();

  const [listWidth, setListWidth] = useState(460);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(460);

  function onResizeStart(e: React.MouseEvent) {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = listWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: MouseEvent) {
      if (!dragging.current) return;
      const delta = ev.clientX - startX.current;
      setListWidth(Math.max(280, Math.min(900, startW.current + delta)));
    }

    function onUp() {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <>
      <PacketList style={{ width: listWidth, minWidth: listWidth, maxWidth: listWidth }} />
      <div className="resize-handle" onMouseDown={onResizeStart} />
      <PacketDetail />
    </>
  );
}
