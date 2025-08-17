import { useEffect, useState } from "react";

export default function ToastHost(){
  const [items, setItems] = useState([]);

  useEffect(() => {
    function onToast(e){
      const { message = "", ms = 2200 } = e.detail || {};
      const id = Math.random().toString(36).slice(2);
      setItems(prev => [...prev, { id, message }]);
      setTimeout(() => setItems(prev => prev.filter(x => x.id !== id)), ms);
    }
    window.addEventListener("myzone:toast", onToast);
    return () => window.removeEventListener("myzone:toast", onToast);
  }, []);

  if (!items.length) return null;
  return (
    <div style={{
      position:"fixed", bottom:16, left:0, right:0,
      display:"flex", justifyContent:"center", zIndex:9999, pointerEvents:"none"
    }}>
      <div style={{ display:"grid", gap:8 }}>
        {items.map(t => (
          <div key={t.id} style={{
            background:"#111827", color:"#fff", padding:"10px 14px",
            borderRadius:10, boxShadow:"0 10px 24px rgba(0,0,0,.25)", pointerEvents:"auto",
            textAlign:"center", fontSize:14, minWidth:240
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
