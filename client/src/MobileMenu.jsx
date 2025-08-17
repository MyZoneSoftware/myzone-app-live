import { Link } from "react-router-dom";
import { isAuthed } from "./lib/auth";

export default function MobileMenu({ open, onClose }) {
  const authed = isAuthed();
  return (
    <>
      <div className={`menu-overlay ${open ? "show" : ""}`} onClick={onClose} />
      <aside className={`menu-panel ${open ? "show" : ""}`} role="dialog" aria-modal="true" aria-label="Navigation">
        <div className="menu-header">
          <div className="brand-min">MyZone</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close menu">✕</button>
        </div>
        <div className="menu-body">
          <Link to="/explore" className="menu-link" onClick={onClose}>Map View</Link>
          <Link to="/districts" className="menu-link" onClick={onClose}>Zoning Districts</Link>
          <Link to="/regulations" className="menu-link" onClick={onClose}>Regulations</Link>
          {authed ? (
            <Link to="/projects" className="menu-link" onClick={onClose}>Projects</Link>
          ) : (
            <Link to="/login" className="menu-link" onClick={onClose}>Projects (login)</Link>
          )}
          {authed ? (
            <span className="menu-link" onClick={onClose} style={{ opacity:.6 }}>You are logged in</span>
          ) : (
            <Link to="/login" className="menu-link" onClick={onClose}>Log in</Link>
          )}
        </div>
      </aside>
    </>
  );
}
