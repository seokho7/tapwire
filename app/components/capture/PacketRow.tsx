import { memo, useCallback } from "react";
import { useStore, type PacketSummary } from "~/store/index";
import { MethodBadge } from "~/components/ui/MethodBadge";
import { getStatusColor, fmtDur, fmtTime } from "~/utils/format";

interface Props {
  packet: PacketSummary;
}

export const PacketRow = memo(function PacketRow({ packet }: Props) {
  const isSelected = useStore((s) => s.selectedId === packet.id);
  const isMultiSelected = useStore((s) => !!s.selectedIdsMap[packet.id]);
  const rowColor = useStore((s) => s.packetColors[packet.id] ?? null);
  const selectPacket = useStore((s) => s.selectPacket);
  const toggleSelectId = useStore((s) => s.toggleSelectId);
  const rangeSelectIds = useStore((s) => s.rangeSelectIds);
  const openContextMenu = useStore((s) => s.openContextMenu);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        rangeSelectIds(packet.id);
      } else if (e.metaKey || e.ctrlKey) {
        toggleSelectId(packet.id);
      } else {
        selectPacket(packet.id);
      }
    },
    [packet.id, selectPacket, toggleSelectId, rangeSelectIds],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!isSelected && !isMultiSelected) selectPacket(packet.id);
      openContextMenu(packet.id, e.clientX, e.clientY);
    },
    [packet.id, isSelected, isMultiSelected, selectPacket, openContextMenu],
  );

  return (
    <div
      className={`packet-row${isSelected ? " selected" : ""}${isMultiSelected ? " multi-selected" : ""}${packet.intercepted ? " intercepted-row" : ""}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {rowColor && <span className="packet-color-bar" style={{ background: rowColor }} />}
      <MethodBadge method={packet.method} />

      <span
        className="status-code"
        style={{ color: getStatusColor(packet.statusCode), textAlign: "center" }}
      >
        {packet.statusCode ?? "—"}
      </span>

      <div className="packet-main">
        <div className="packet-path">{packet.path}</div>
        <div className="packet-host">
          {packet.isHttps ? "🔒 " : ""}{packet.host}
        </div>
      </div>

      <div className="packet-meta">
        <div>{fmtDur(packet.duration)}</div>
        <div>{fmtTime(packet.timestamp)}</div>
      </div>
    </div>
  );
});
