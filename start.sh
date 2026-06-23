#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PORT=$(node -e "try{const e=require('./src/config-manager').readEnvFile();console.log(e.PORT||3000)}catch{console.log(3000)}")

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart print-gateway 2>/dev/null || pm2 start src/index.js --name print-gateway
  echo "Servis işləyir. Setup: http://localhost:${PORT}/setup"
  xdg-open "http://localhost:${PORT}/setup" 2>/dev/null || sensible-browser "http://localhost:${PORT}/setup" 2>/dev/null || true
  exit 0
fi

nohup node src/index.js >> gateway.log 2>> gateway.err.log &
sleep 2
echo "Servis başladıldı. Setup: http://localhost:${PORT}/setup"
xdg-open "http://localhost:${PORT}/setup" 2>/dev/null || sensible-browser "http://localhost:${PORT}/setup" 2>/dev/null || true
