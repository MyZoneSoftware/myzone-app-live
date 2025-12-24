#!/usr/bin/env bash

echo "=== Trying direct node on common entry files ==="
echo
echo "node server/src/index.js"
node server/src/index.js 2>&1 || true

echo
echo "node server/src/index.cjs"
node server/src/index.cjs 2>&1 || true

echo
echo "node server/src/index.mjs"
node server/src/index.mjs 2>&1 || true

echo
echo "=== Trying npm run dev in server folder ==="
(cd server && npm run dev 2>&1) || true

echo
echo "=== Trying npm start in server folder ==="
(cd server && npm start 2>&1) || true
