#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE="$DIR/node/bin/node"
APP="$DIR/app"
cd "$APP"

echo ""
echo " Print Gateway quraşdırılır..."
echo " (Node.js daxildir — ayrıca quraşdırmaya ehtiyac yoxdur)"
echo ""

[[ -f .env ]] || cp .env.example .env

INSTALL_DIR="/opt/print-gateway"
SERVICE="/etc/systemd/system/print-gateway.service"

if [[ "$EUID" -eq 0 ]]; then
  mkdir -p "$INSTALL_DIR"
  cp -r "$DIR/node" "$DIR/app" "$INSTALL_DIR/"
  [[ -f "$INSTALL_DIR/app/.env" ]] || cp "$INSTALL_DIR/app/.env.example" "$INSTALL_DIR/app/.env"

  cat > "$SERVICE" <<EOF
[Unit]
Description=Print Gateway Service
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR/app
ExecStart=$INSTALL_DIR/node/bin/node src/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable print-gateway
  systemctl restart print-gateway
  echo " Quraşdırma tamamlandı (systemd)!"
else
  pkill -f "$APP/src/index.js" 2>/dev/null || true
  nohup "$NODE" src/index.js >> "$DIR/gateway.log" 2>> "$DIR/gateway.err.log" &

  mkdir -p "$HOME/.config/autostart"
  cat > "$HOME/.config/autostart/print-gateway.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Print Gateway
Exec=env PATH="$DIR/node/bin:$PATH" $NODE $APP/src/index.js
Path=$APP
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

  sleep 2
  echo " Quraşdırma tamamlandı!"
  echo " Sistem servisi üçün: sudo ./install.sh"
fi

echo " Setup: http://localhost:3000/setup"
command -v xdg-open >/dev/null && xdg-open "http://localhost:3000/setup" 2>/dev/null || true
