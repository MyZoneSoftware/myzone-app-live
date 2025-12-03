#!/bin/bash
set -euo pipefail
URL="http://127.0.0.1:5177/"
echo "🔎 Checking $URL ..."
curl -I --max-time 3 "$URL" || { echo "❌ Server not responding. Is Vite running?"; exit 1; }
echo "✅ Server responded. Open $URL in your browser."
