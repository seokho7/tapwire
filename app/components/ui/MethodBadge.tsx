import { getMethodColor, getMethodBg } from "~/utils/format";

interface Props {
  method: string;
  size?: "sm" | "md";
}

export function MethodBadge({ method, size = "md" }: Props) {
  const color = getMethodColor(method);
  const bg = getMethodBg(method);

  return (
    <span
      className="method-badge"
      style={{
        color,
        background: bg,
        fontSize: size === "sm" ? "10px" : "10.5px",
      }}
    >
      {method}
    </span>
  );
}
