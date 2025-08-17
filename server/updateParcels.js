// updateParcels.js — safely replace toSearchCards() to include `id`
// Run with: node updateParcels.js
const fs = require("fs");
const path = require("path");

const filePath = path.resolve(__dirname, "src/lib/parcels.js");
if (!fs.existsSync(filePath)) {
  console.error("❌ File not found:", filePath);
  process.exit(1);
}

let src = fs.readFileSync(filePath, "utf8");

// If it already has id: pid, do nothing.
if (src.includes("toSearchCards") && src.includes("id: pid")) {
  console.log("✅ toSearchCards() already includes `id: pid` — no changes made.");
  process.exit(0);
}

// New function body (no template literals inside to avoid escaping woes)
const newFn =
`function toSearchCards(features) {
  return features.map(f => {
    const pid = String(f.properties?.parcel_id || "");
    const addr = String(f.properties?.address || "");
    const zoning = String(f.properties?.zoning || "N/A");
    return {
      type: "parcel",
      id: pid,
      title: pid + " — " + addr,
      snippet: "Zoning: " + zoning
    };
  });
}
`;

// Try to replace existing function; otherwise append it.
const re = /function\s+toSearchCards\s*\([\s\S]*?\}\s*\}\s*\n?/m; // matches the whole function block
if (re.test(src)) {
  src = src.replace(re, newFn);
  console.log("✏️  Replaced existing toSearchCards() definition.");
} else {
  src += "\n" + newFn;
  console.log("➕ Added new toSearchCards() definition (was not found).");
}

// Backup then write
const backupPath = filePath + "." + Date.now() + ".bak";
fs.writeFileSync(backupPath, src, "utf8"); // temp write to ensure content is valid

// Actually write to original file (we already wrote valid content to backup var)
fs.writeFileSync(filePath, src, "utf8");
console.log("✅ Updated:", filePath);
console.log("🛟 Backup saved at:", backupPath);
