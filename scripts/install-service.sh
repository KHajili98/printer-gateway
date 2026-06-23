#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_NAME="print-gateway"

echo "Installing print-gateway service..."

cd "$APP_DIR"
npm install --production

if command -v pm2 >/dev/null 2>&1; then
  pm2 start src/index.js --name "$SERVICE_NAME"
  pm2 save
  echo "Started with PM2. Run 'pm2 startup' to enable boot persistence."
  exit 0
fi

UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
echo "PM2 not found. Creating systemd unit at $UNIT_FILE (requires sudo)..."

sudo tee "$UNIT_FILE" > /dev/null <<EOF
[Unit]
Description=Print Gateway Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=$(command -v node) src/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"
echo "Service installed and started."
