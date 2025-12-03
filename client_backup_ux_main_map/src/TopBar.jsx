import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SearchBar from "./SearchBar.jsx";
import MobileMenu from "./MobileMenu.jsx";
import { isAuthed, clearToken } from "./lib/auth";

export default function TopBar() {
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(isAuthed());
  const nav = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setAuthed(isAuthed()), 800);
    return () => clearInterval(t);
  }, []);

  function logout(){
    clearToken();
    setAuthed(false);
    nav("/", { replace: true });
  }

  return (
    <>
      <header className="topbar" role="banner">
        <Link to="/" className="brand" style={{ textDecoration:"none", color:"inherit" }}>MyZone</Link>
        <div className="search-wrap" style={{ flex:1 }}>
          <SearchBar />
        </div>
        {authed ? (
          <button className="link-ghost" onClick={logout} aria-label="Log out">Log out</button>
        ) : (
          <Link to="/login" className="link-ghost" aria-label="Log in">Log in</Link>
        )}
        <button className="icon-btn" aria-label="Open menu" onClick={() => setOpen(true)} style={{ marginLeft:8 }}>☰</button>
      </header>
      <MobileMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}
