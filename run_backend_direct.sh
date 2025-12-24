#!/usr/bin/env bash

echo "==> Running backend directly with Node (capture output below)"
if [ -d "./server" ]; then
  cd server
elif [ -d "./myzone-server" ]; then
  cd myzone-server
else
  echo "⚠️ Backend folder not found!"
  exit 1
fi

echo "PWD: $(pwd)"
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# Try common startup patterns:
echo
echo "### Attempt: node src/index.js ###"
node src/index.js

echo
echo "### Attempt: node start.cjs ###"
node start.cjs

echo
echo "### Attempt: npm run dev ###"
npm run dev
