#!/usr/bin/env bash
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop print-gateway 2>/dev/null || true
  pm2 delete print-gateway 2>/dev/null || true
fi
pkill -f "src/index.js" 2>/dev/null || true
echo "Servis dayandırıldı."
