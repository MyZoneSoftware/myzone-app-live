#!/usr/bin/env bash

echo "=== Trying direct node server/src/index.js ==="
node server/src/index.js || true

echo
echo "=== Trying direct node server/src/index.cjs ==="
node server/src/index.cjs || true

echo
echo "=== Trying direct node server/src/index.mjs ==="
node server/src/index.mjs || true

echo
echo "=== Trying npm run dev in server folder ==="
(cd server && npm run dev) || true

echo
echo "=== Trying npm start in server folder ==="
(cd server && npm start) || true
