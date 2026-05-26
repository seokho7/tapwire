interface Props {
  title: string;
  count?: number | string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function Section({ title, count, action, children }: Props) {
  return (
    <div className="sec">
      <div className="sec-head">
        <span className="sec-title">{title}</span>
        {count !== undefined && <span className="sec-count">{count}</span>}
        {action && <span style={{ marginLeft: "auto" }}>{action}</span>}
      </div>
      {children}
    </div>
  );
}
