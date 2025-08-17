import { NavLink } from "react-router-dom";

export default function Sidebar({ onNavigate }) {
  const Item = ({ to, label }) => (
    <NavLink
      to={to}
      className={({ isActive }) => isActive ? "active" : ""}
      onClick={onNavigate}
    >
      {label}
    </NavLink>
  );

  return (
    <div>
      <div className="nav">
        <div className="group-label">Navigation</div>
        <nav style={{ display:"grid", gap:6 }}>
          <Item to="/" label="Home" />
          <Item to="/districts" label="Zoning Districts" />
          <Item to="/regulations" label="Regulations" />
          <Item to="/projects" label="Projects" />
        </nav>
      </div>
    </div>
  );
}
