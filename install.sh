#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "[X] Node.js tapılmadı!"
  echo "Yüklə: https://nodejs.org/  və ya: sudo apt install nodejs npm"
  echo ""
  exit 1
fi

node scripts/install.js
