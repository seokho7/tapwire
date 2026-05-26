import { NavLink } from "react-router";
import { useStore } from "~/store/index";

interface Props {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number | string;
  nav?: string;
}

export function NavItem({ to, icon, label, badge, nav }: Props) {
  const setActiveNav = useStore((s) => s.setActiveNav);

  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
      onClick={() => nav && setActiveNav(nav)}
    >
      <span className="nav-item-icon">{icon}</span>
      <span>{label}</span>
      {badge !== undefined && (
        <span className="nav-badge">{badge}</span>
      )}
    </NavLink>
  );
}
