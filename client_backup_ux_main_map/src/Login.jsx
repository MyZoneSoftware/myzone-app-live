import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { setToken } from "./lib/auth";

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e){
    e.preventDefault();
    setErr(""); setLoading(true);
    try{
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");
      setToken(String(data.token || ""));
      const dest = (loc.state && loc.state.from) ? String(loc.state.from) : "/projects";
      nav(dest, { replace: true });
    }catch(ex){
      setErr(String(ex.message || ex));
    }finally{
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: "24px auto" }}>
      <h2 style={{ marginTop: 0 }}>Log in</h2>
      <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0 }}>
        Public search stays open. Applications/Analysis/Reports require login.
      </p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Email</span>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
            style={{padding:"10px",border:"1px solid var(--border)",borderRadius:"10px"}} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Password</span>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} required
            style={{padding:"10px",border:"1px solid var(--border)",borderRadius:"10px"}} />
        </label>
        {err && <div style={{ color:"crimson", fontSize:13 }}>{err}</div>}
        <button type="submit" className="btn-primary" disabled={loading} style={{ textAlign: "center" }}>
          {loading ? "Signing in…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
