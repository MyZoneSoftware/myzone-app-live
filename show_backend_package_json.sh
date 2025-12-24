#!/usr/bin/env bash
echo "=== server/package.json ==="
sed -n '1,200p' server/package.json
echo
echo "=== end of server/package.json ==="
