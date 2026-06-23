#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/app"
nohup "$DIR/node/bin/node" src/index.js >> "$DIR/gateway.log" 2>> "$DIR/gateway.err.log" &
sleep 2
echo "Servis başladı. Setup: http://localhost:3000/setup"
command -v xdg-open >/dev/null && xdg-open "http://localhost:3000/setup" 2>/dev/null || true
