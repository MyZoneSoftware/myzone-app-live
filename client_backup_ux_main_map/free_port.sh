#!/bin/bash
set -euo pipefail

for PORT in 5177 5173 3000; do
  if command -v lsof >/dev/null 2>&1; then
    PID=$(lsof -ti tcp:$PORT || true)
    if [ -n "$PID" ]; then
      echo "🔪 Killing PID $PID on :$PORT"
      kill -9 $PID || true
    else
      echo "✅ No process on :$PORT"
    fi
  fi
done
