const express = require('express');
const router = express.Router();

const districts = [
  { code: 'RM', name: 'Multi-Family Residential', purpose: 'Medium/high density residential.' },
  { code: 'CN', name: 'Neighborhood Commercial', purpose: 'Neighborhood-scale retail and services.' }
];

const regulations = [
  { title: 'Rear Setback (RM)', summary: 'Rear setback is 20 ft, can reduce to 15 ft with alley.' },
  { title: 'Max Height (CN)', summary: 'Max building height 35 ft; corner lots 40 ft.' }
];

const projects = [
  { name: 'Bethesda Tabernacle Site Plan', jurisdiction: 'Greenacres', status: 'In Review' },
  { name: 'Downtown Mixed-Use', jurisdiction: 'Lake Worth Beach', status: 'Draft' }
];

function includes(v, q) {
  return String(v || '').toLowerCase().includes(q);
}

router.get('/', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  console.log('[search] q =', q);
  if (!q) return res.json({ results: [] });

  const results = [];

  // Districts
  for (const d of districts) {
    if (includes(d.code, q) || includes(d.name, q) || includes(d.purpose, q)) {
      results.push({ type: 'district', title: `${d.code} — ${d.name}`, snippet: d.purpose });
    }
  }

  // Regulations
  for (const r of regulations) {
    if (includes(r.title, q) || includes(r.summary, q)) {
      results.push({ type: 'regulation', title: r.title, snippet: r.summary });
    }
  }

  // Projects
  for (const p of projects) {
    if (includes(p.name, q) || includes(p.jurisdiction, q) || includes(p.status, q)) {
      results.push({ type: 'project', title: p.name, snippet: `Jurisdiction: ${p.jurisdiction} • Status: ${p.status}` });
    }
  }

  res.json({ results: results.slice(0, 10) });
});

module.exports = router;
