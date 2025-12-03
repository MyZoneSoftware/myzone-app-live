import React, { useState } from 'react';
export default function SearchBar({ onSearch }) {
  const [q, setQ] = useState('');
  const submit = (e) => { e.preventDefault(); if (!q.trim()) return; onSearch(q.trim()); };
  return (
    <form onSubmit={submit} style={{display:'flex',gap:8,alignItems:'center',maxWidth:720,margin:'0 auto'}}>
      <input aria-label="Search" placeholder="Ask a zoning or planning question..." value={q} onChange={(e)=>setQ(e.target.value)}
        style={{flex:1,padding:'14px 16px',border:'1px solid #e5e7eb',borderRadius:9999,outline:'none',fontSize:16}}/>
      <button type="submit" style={{padding:'12px 18px',border:'1px solid #111827',background:'#111827',color:'#fff',borderRadius:9999,cursor:'pointer'}}>Ask</button>
    </form>
  );
}
