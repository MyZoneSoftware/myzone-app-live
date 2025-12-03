import React, { useEffect, useMemo, useState } from 'react';

/**
 * CitySelector (Florida)
 * - Tries multiple U.S. Census datasets for ALL Florida counties & places.
 * - If Census returns HTTP_400 (or any failure), we:
 *    • fall back to a complete static list of FL counties (67),
 *    • keep a search box with a "Use typed city" action so the user can still select a city.
 * - Caches successful results in localStorage.
 * - onSelect({ id, name, type })
 */

const STATE_FIPS = '12'; // Florida

// --- Static fallback: all Florida counties (complete set of 67) ---
const FALLBACK_COUNTIES = [
  "Alachua","Baker","Bay","Bradford","Brevard","Broward","Calhoun","Charlotte","Citrus","Clay",
  "Collier","Columbia","DeSoto","Dixie","Duval","Escambia","Flagler","Franklin","Gadsden","Gilchrist",
  "Glades","Gulf","Hamilton","Hardee","Hendry","Hernando","Highlands","Hillsborough","Holmes","Indian River",
  "Jackson","Jefferson","Lafayette","Lake","Lee","Leon","Levy","Liberty","Madison","Manatee",
  "Marion","Martin","Miami-Dade","Monroe","Nassau","Okaloosa","Okeechobee","Orange","Osceola","Palm Beach",
  "Pasco","Pinellas","Polk","Putnam","St. Johns","St. Lucie","Santa Rosa","Sarasota","Seminole","Sumter",
  "Suwannee","Taylor","Union","Volusia","Wakulla","Walton","Washington"
].map((name, i) => ({ id: `county:${STATE_FIPS}${String(i).padStart(3,'0')}`, name, type: 'county' })); // id will be re-mapped if Census succeeds

// We will re-write IDs to the correct county FIPS if we do get Census data.

// --- Census endpoints to try (most recent first) ---
const PLACE_URLS = [
  `https://api.census.gov/data/2023/pep/population?get=NAME&for=place:*&in=state:${STATE_FIPS}`,
  `https://api.census.gov/data/2022/pep/population?get=NAME&for=place:*&in=state:${STATE_FIPS}`,
  `https://api.census.gov/data/2021/pep/population?get=NAME&for=place:*&in=state:${STATE_FIPS}`,
  // older fallback
  `https://api.census.gov/data/2020/pep/population?get=NAME&for=place:*&in=state:${STATE_FIPS}`
];

const COUNTY_URLS = [
  `https://api.census.gov/data/2023/pep/population?get=NAME&for=county:*&in=state:${STATE_FIPS}`,
  `https://api.census.gov/data/2022/pep/population?get=NAME&for=county:*&in=state:${STATE_FIPS}`,
  `https://api.census.gov/data/2021/pep/population?get=NAME&for=county:*&in=state:${STATE_FIPS}`,
  // older fallback
  `https://api.census.gov/data/2020/pep/population?get=NAME&for=county:*&in=state:${STATE_FIPS}`
];

async function fetchJSON(url) {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return res.json();
}

async function getFirstWorking(urls) {
  let lastErr = null;
  for (const u of urls) {
    try {
      return await fetchJSON(u);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All sources failed');
}

function normalizeCounties(rows) {
  // rows: [ ["NAME","state","county"], ["Alachua County, Florida","12","001"], ... ]
  if (!rows || rows.length < 2) return [];
  const [, ...rest] = rows;
  return rest.map(([name, state, county]) => ({
    id: `county:${STATE_FIPS}${county}`, // county is already 3-digit code
    name: name.replace(/, Florida$/i, '').replace(/ County$/i, '').trim(),
    type: 'county'
  })).sort((a,b)=>a.name.localeCompare(b.name));
}

function normalizePlaces(rows) {
  // rows: [ ["NAME","state","place"], ["Miami city, Florida","12","45000"], ... ]
  if (!rows || rows.length < 2) return [];
  const [, ...rest] = rows;
  return rest.map(([name, state, place]) => ({
    id: `place:${STATE_FIPS}${place}`,   // place is 5-digit code
    name: name.replace(/, Florida$/i, '').trim(), // keep "city/town/village" suffix if present
    type: 'place'
  })).sort((a,b)=>a.name.localeCompare(b.name));
}

export default function CitySelector({ open, onClose, onSelect }) {
  const [tab, setTab] = useState('counties'); // 'counties' | 'cities'
  const [query, setQuery] = useState('');
  const [counties, setCounties] = useState([]);
  const [cities, setCities] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | partial | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    const cached = localStorage.getItem('fl_geo_index_v2');
    if (cached) {
      try {
        const { counties, cities } = JSON.parse(cached);
        if ((counties?.length || 0) + (cities?.length || 0) > 0) {
          setCounties(counties || []);
          setCities(cities || []);
          setStatus('ready');
          return;
        }
      } catch {}
    }

    (async () => {
      setStatus('loading');
      setErrorMsg('');
      try {
        const [countyRows, placeRows] = await Promise.all([
          getFirstWorking(COUNTY_URLS),
          getFirstWorking(PLACE_URLS)
        ]);
        const cc = normalizeCounties(countyRows);
        const pp = normalizePlaces(placeRows);
        setCounties(cc);
        setCities(pp);
        localStorage.setItem('fl_geo_index_v2', JSON.stringify({ counties: cc, cities: pp }));
        setStatus('ready');
      } catch (e) {
        // Hard fallback: static counties + allow custom city entry
        setCounties(FALLBACK_COUNTIES);
        setCities([]); // we'll allow custom entry instead
        setStatus('partial'); // show message but still usable
        setErrorMsg('Live list unavailable (Census HTTP_400). Using offline counties; enter any city manually below.');
      }
    })();
  }, [open]);

  const filterText = query.trim().toLowerCase();
  const filteredCounties = useMemo(() => {
    if (!filterText) return counties;
    return counties.filter(c => c.name.toLowerCase().includes(filterText));
  }, [counties, filterText]);

  const filteredCities = useMemo(() => {
    if (!filterText) return cities;
    return cities.filter(c => c.name.toLowerCase().includes(filterText));
  }, [cities, filterText]);

  if (!open) return null;

  return (
    <div className="mz-drawer" role="dialog" aria-modal="true">
      <div className="mz-dim" onClick={onClose} />
      <aside className="mz-drawer-panel">
        <div className="mz-drawer-head">
          <div className="mz-drawer-title">Select a City / County (Florida)</div>
          <button className="mz-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="mz-drawer-toolbar">
          <div className="mz-tabs tight">
            <button className={tab==='counties'?'active':''} onClick={()=>setTab('counties')}>Counties</button>
            <button className={tab==='cities'?'active':''} onClick={()=>setTab('cities')}>Cities</button>
          </div>
          <input
            className="mz-filter"
            placeholder="Search Florida…"
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
            aria-label="Filter"
          />
        </div>

        {status === 'loading' && <div className="mz-empty">Loading full Florida list…</div>}
        {status === 'partial' && (
          <div className="mz-empty">
            {errorMsg}
          </div>
        )}
        {status === 'error' && <div className="mz-empty">Error: {errorMsg}</div>}

        {(status === 'ready' || status === 'partial') && tab === 'counties' && (
          <ul className="mz-drawer-list scroll">
            {filteredCounties.map(c => (
              <li key={c.id} onClick={() => onSelect?.(c)}>{c.name} County</li>
            ))}
          </ul>
        )}

        {(status === 'ready') && tab === 'cities' && (
          <ul className="mz-drawer-list scroll">
            {filteredCities.map(c => (
              <li key={c.id} onClick={() => onSelect?.(c)}>{c.name}</li>
            ))}
          </ul>
        )}

        {(status === 'partial') && tab === 'cities' && (
          <div style={{padding:12, display:'grid', gap:8}}>
            <div className="mz-empty" style={{textAlign:'left'}}>
              Live cities list unavailable. Type a city and click “Use typed city”.
            </div>
            <InlineCityAdder onSelect={onSelect} />
          </div>
        )}
      </aside>
    </div>
  );
}

function InlineCityAdder({ onSelect }) {
  const [val, setVal] = useState('');
  const disabled = !val.trim();
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:8}}>
      <input
        className="mz-filter"
        placeholder="Type a Florida city (e.g., Miami, Orlando, etc.)"
        value={val}
        onChange={(e)=>setVal(e.target.value)}
      />
      <button
        className="mz-btn"
        disabled={disabled}
        onClick={() => {
          if (!val.trim()) return;
          onSelect?.({ id: `custom:${val.trim().toLowerCase()}`, name: val.trim(), type: 'place' });
        }}
      >Use typed city</button>
    </div>
  );
}
