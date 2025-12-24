#!/usr/bin/env bash

echo "=== server/package.json ==="
sed -n '1,200p' server/package.json
echo
echo "===== END OF server/package.json ====="
