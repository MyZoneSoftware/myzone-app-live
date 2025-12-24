#!/usr/bin/env bash
echo "=== Backend directory listing (server) ==="
if [ -d "./server" ]; then
  ls -R server
else
  echo "No ./server folder"
fi

echo
echo "=== Backend directory listing (myzone-server) ==="
if [ -d "./myzone-server" ]; then
  ls -R myzone-server
else
  echo "No ./myzone-server folder"
fi
