#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo ""
echo " Print Gateway quraşdırılır..."
echo ""

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo " .env yaradildi."
fi

chmod +x print-gateway install.sh start.sh stop.sh 2>/dev/null || true

INSTALL_DIR="/opt/print-gateway"
SERVICE="/etc/systemd/system/print-gateway.service"

if [[ "$EUID" -eq 0 ]]; then
  mkdir -p "$INSTALL_DIR"
  cp -r print-gateway public config .env.example "$INSTALL_DIR/"
  [[ -f .env ]] && cp .env "$INSTALL_DIR/.env" || cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  chmod +x "$INSTALL_DIR/print-gateway"

  cat > "$SERVICE" <<EOF
[Unit]
Description=Print Gateway Service
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/print-gateway
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable print-gateway
  systemctl restart print-gateway
  echo ""
  echo " Quraşdırma tamamlandı (systemd)!"
  echo " Setup: http://localhost:3000/setup"
else
  pkill -f "$DIR/print-gateway" 2>/dev/null || true
  nohup "$DIR/print-gateway" >> gateway.log 2>> gateway.err.log &
  disown 2>/dev/null || true

  mkdir -p "$HOME/.config/autostart"
  cat > "$HOME/.config/autostart/print-gateway.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Print Gateway
Exec=$DIR/print-gateway
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

  sleep 2
  echo ""
  echo " Quraşdırma tamamlandı (user mode)!"
  echo " Sistem servisi üçün: sudo ./install.sh"
  echo " Setup: http://localhost:3000/setup"
fi

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:3000/setup" 2>/dev/null || true
fi
