#!/usr/bin/env bash

echo "=== Listing route files in server/src/routes ==="
ls -la server/src/routes || echo "No routes directory found!"

echo
echo "=== Dumping contents of route files ==="
for f in server/src/routes/*; do
  echo
  echo "----- $f -----"
  sed -n '1,300p' "$f"
done
