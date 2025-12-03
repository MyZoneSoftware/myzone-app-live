import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

const HISTORY_KEY = "mz_history";
const MAX_HISTORY = 7;

function loadHistory(){
  try{
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  }catch{ return []; }
}
function saveHistory(q){
  const cur = loadHistory().filter(x => x && x !== q);
  cur.unshift(q);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(cur.slice(0, MAX_HISTORY)));
}

export default function SearchBar() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [answer, setAnswer] = useState("");  // top answer text
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(loadHistory());
  const [showHistory, setShowHistory] = useState(false);

  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const resultsRoot = document.getElementById("results-root");

  useEffect(() => {
    function onDocClick(e) {
      if (!boxRef.current) return;
      const clickedInsideSearch = boxRef.current.contains(e.target);
      const clickedInsideResults = resultsRoot?.contains(e.target);
      if (!clickedInsideSearch && !clickedInsideResults) {
        setOpen(false); 
        setShowHistory(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [resultsRoot]);

  function onFocus(){
    setHistory(loadHistory());
    setShowHistory(true);
    setOpen(true);
  }

  async function localParcelSearch(query) {
    const res = await fetch("/data/parcels.geojson");
    const geo = await res.json();
    const needle = query.toLowerCase();
    const matches = (geo.features || []).filter(f => {
      const pid = String(f.properties?.parcel_id || "").toLowerCase();
      const addr = String(f.properties?.address || "").toLowerCase();
      return pid.includes(needle) || addr.includes(needle);
    });
    return matches.map(f => ({
      type: "parcel",
      id: String(f.properties?.parcel_id || ""),
      title: f.properties?.parcel_id + " — " + (f.properties?.address || ""),
      snippet: "Zoning: " + (f.properties?.zoning || "N/A")
    }));
  }

  async function backendSearch(query){
    try{
      const r = await fetch(API_BASE + "/api/search?q=" + encodeURIComponent(query));
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data.results) ? data.results : [];
    }catch{ return []; }
  }

  async function aiSearch(query){
    try{
      const r = await fetch(API_BASE + "/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ q: query })
      });
      if (!r.ok) return "";
      const data = await r.json();
      return String(data?.answer || "");
    }catch{ return ""; }
  }

  function dedupe(cards){
    const seen = new Set();
    const out = [];
    for (const c of cards){
      const key = (c.type||"") + "|" + (c.title||"");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }

  async function runSearch(query){
    setLoading(true);
    setError("");
    setResults([]);
    setAnswer("");
    setShowHistory(false);
    try{
      const [local, back, ai] = await Promise.all([
        localParcelSearch(query),
        backendSearch(query),
        aiSearch(query)
      ]);

      if (ai) setAnswer(ai);
      const merged = dedupe([ ...local, ...back ]);
      setResults(merged);
      setOpen(true);

      const ids = local.map(x => x.id).filter(Boolean);
      if (ids.length) {
        window.dispatchEvent(new CustomEvent("myzone:selectParcels", { detail: { ids } }));
      }

      saveHistory(query);
      setHistory(loadHistory());
    }catch(e){
      setError(String(e.message || e));
      setOpen(true);
    }finally{
      setLoading(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    await runSearch(query);
  }

  function useHistory(item){
    setQ(item);
    inputRef.current?.focus();
    runSearch(item);
  }

  const Results = () => {
    if (!open) return null;
    return (
      <div className="results">
        {showHistory && history.length > 0 && (
          <>
            <div className="section">Recent searches</div>
            {history.map((h, i) => (
              <div key={"h-"+i} className="row" onClick={() => useHistory(h)} style={{ cursor:"pointer" }}>
                <div className="title">{h}</div>
                <div className="meta">recent</div>
              </div>
            ))}
          </>
        )}

        {error && <div className="row"><div className="title" style={{ color:"crimson" }}>Error: {error}</div></div>}

        {!error && !showHistory && !!answer && (
          <div className="answer">{answer}</div>
        )}

        {!error && results.length > 0 && (
          <>
            {results.map((r, i) => (
              <div key={i} className="row">
                <div className="title">{r.title}</div>
                {r.snippet && <div className="snippet">{r.snippet}</div>}
                {r.type && <div className="meta">{r.type}</div>}
              </div>
            ))}
          </>
        )}

        {!error && !showHistory && !answer && results.length === 0 && (
          <div className="row"><div className="title" style={{ color:"#6b7280" }}>No results</div></div>
        )}
      </div>
    );
  };

  return (
    <div ref={boxRef} className="search">
      <form onSubmit={onSubmit} style={{ display:"flex", width:"100%" }}>
        <input
          ref={inputRef}
          aria-label="Search parcel ID, address, or zoning question"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={onFocus}
          placeholder="Search address or Parcel ID — or ask a zoning question…"
        />
        <button type="submit">{loading ? "Searching…" : "Search"}</button>
      </form>

      {/* Render results BELOW the header via portal so the header doesn't grow */}
      {resultsRoot && createPortal(<Results />, resultsRoot)}
    </div>
  );
}
