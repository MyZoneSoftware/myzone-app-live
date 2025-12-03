// scripts/patch_mapview_pending.mjs
import fs from 'node:fs';

const file = 'src/MapView.jsx';
let s = fs.readFileSync(file, 'utf8');

// Ensure mapReady state exists
if (!s.includes('const [mapReady, setMapReady] = useState(false);')) {
  s = s.replace(
    /const bufferLayerRef = useRef\(L.layerGroup\(\)\);\n/,
    `$&
  const [mapReady, setMapReady] = useState(false);
`
  );
}

// Set mapReady in whenCreated
s = s.replace(
  /whenCreated=\{\(map\)=>\{\s*mapRef\.current = map;\s*\}\}\s*\>/,
  `whenCreated={(map)=>{ mapRef.current = map; setMapReady(true); }}>`
);

// Add an effect to draw queued buffer after map is ready
if (!s.includes('window.__myzonePendingBuffer')) {
  s = s.replace(
    /useEffect\(\(\) => \{\n\s*function onDrawBuffer\(e\) \{/,
`useEffect(() => {
    // If a buffer was queued before Map mounted, draw it now
    if (mapReady && window.__myzonePendingBuffer && mapRef.current) {
      const d = window.__myzonePendingBuffer;
      window.__myzonePendingBuffer = null;
      window.dispatchEvent(new CustomEvent('myzone:draw-buffer', { detail: d }));
    }
  }, [mapReady]);

  $&`
  );
}

fs.writeFileSync(file, s);
console.log('✅ MapView will draw queued buffer once ready');
