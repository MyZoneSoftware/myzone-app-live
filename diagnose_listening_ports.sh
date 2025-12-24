#!/usr/bin/env bash

echo "=== Listening TCP ports (common dev ports) ==="
netstat -an | grep LISTEN | grep -E ":5000|:5001|:5002|:5003|:5004|:5173|:5177|:3000|:3001|:8080"

echo
echo "=== Full LISTENING ports ==="
netstat -an | grep LISTEN
