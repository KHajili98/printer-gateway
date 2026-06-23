#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
pkill -f "$DIR/app/src/index.js" 2>/dev/null || true
systemctl stop print-gateway 2>/dev/null || true
echo "Servis dayandırıldı."
