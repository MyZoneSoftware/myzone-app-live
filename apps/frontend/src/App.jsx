import React, { useState } from 'react';
import SearchBar from './components/SearchBar.jsx';
export default function App() {
  const [s, setS] = useState({ loading: false, answer: '', error: '' });
  const onSearch = async (q) => {
    setS({ loading: true, answer: '', error: '' });
    try {
      const r = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt: q }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Request failed');
      setS({ loading: false, answer: d.answer, error: '' });
    } catch (e) {
      setS({ loading: false, answer: '', error: e.message });
    }
  };
  return (
    <div style={{padding:'32px 16px'}}>
      <header style={{maxWidth:960,margin:'0 auto 24px'}}>
        <h1 style={{fontSize:28,margin:'0 0 8px'}}>MyZone</h1>
        <p style={{color:'#6b7280'}}>Minimalist search powered by OpenAI.</p>
      </header>
      <SearchBar onSearch={onSearch}/>
      <section style={{maxWidth:960,margin:'24px auto'}}>
        {s.loading && <p>Thinking…</p>}
        {s.error && <p style={{color:'#b91c1c'}}>{s.error}</p>}
        {s.answer && <div style={{whiteSpace:'pre-wrap',background:'#f9fafb',padding:16,borderRadius:12,border:'1px solid #e5e7eb'}}>{s.answer}</div>}
      </section>
    </div>
  );
}
