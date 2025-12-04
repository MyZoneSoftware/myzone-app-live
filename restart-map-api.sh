#!/usr/bin/env bash
set -e

# Go to map-api folder
cd "$(dirname "$0")/map-api"

echo "Stopping any existing map-api server on port 5003 (if running)..."
PID=$(lsof -ti:5003 || true)
if [ -n "$PID" ]; then
  kill "$PID" || true
  echo "Killed process $PID"
else
  echo "No process on port 5003"
fi

echo "Starting map-api on http://localhost:5003 ..."
node server.js
