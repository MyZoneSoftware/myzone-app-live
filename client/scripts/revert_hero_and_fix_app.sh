#!/bin/bash
set -euo pipefail

APP="client/src/App.jsx"

if [ ! -f "$APP" ]; then
  echo "❌ Missing $APP"
  exit 1
fi

# 1) Remove HeroProxy/HeroSearch imports if present
perl -0777 -i -pe 's/^\s*import\s+HeroProxy\s+from\s+.\.\/components\/HeroProxy\.jsx';\s*\n//mg' "$APP"
perl -0777 -i -pe 's/^\s*import\s+HeroSearch\s+from\s+.\.\/components\/HeroSearch\.jsx';\s*\n//mg' "$APP"

# 2) Remove any <HeroProxy /> component usage
perl -0777 -i -pe 's/<HeroProxy\s*\/>\s*//gs' "$APP"

# 3) Remove any <HeroSearch .../> usage (self-closing or with children)
perl -0777 -i -pe 's/<HeroSearch\b[^>]*\/>\s*//gs' "$APP"
perl -0777 -i -pe 's/<HeroSearch\b[^>]*>[\s\S]*?<\/HeroSearch>\s*//gs' "$APP"

# 4) Remove any dummy local onInsight fallback we may have added
perl -0777 -i -pe 's/\s*\/\/\s*Local\s+safe\s+fallback[^\n]*\n\s*const\s+onInsight\s*=\s*undefined;\s*//gs' "$APP"

echo "✅ Reverted App.jsx to previous UI (Hero components removed)."
