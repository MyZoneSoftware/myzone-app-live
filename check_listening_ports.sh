#!/usr/bin/env bash

echo "=== Listening TCP and UDP ports (for 5000–5020 range) ==="
netstat -an | grep LISTEN | grep -E ":50(00|01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20)"
echo
echo "=== Full LISTENING ports ==="
netstat -an | grep LISTEN
