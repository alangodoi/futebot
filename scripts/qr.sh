#!/usr/bin/env bash
set -euo pipefail

HOST="${DEPLOY_HOST:-138.197.32.187}"
USER="${DEPLOY_USER:-deploy}"
KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519_DO_agent}"
APP_DIR="${DEPLOY_APP_DIR:-/home/deploy/apps/futebot}"

echo "=== QR code do futebot (servidor → seu terminal) ==="
echo ""
echo "1. O bot no servidor vai reiniciar"
echo "2. O QR aparece AQUI embaixo (arte ASCII)"
echo "3. No celular: WhatsApp → Aparelhos conectados → Conectar aparelho"
echo ""
echo "Ctrl+C para sair dos logs (o bot continua no servidor)"
echo ""

ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" bash -s <<EOF
set -euo pipefail
cd ${APP_DIR}

if pm2 describe futebot >/dev/null 2>&1; then
  pm2 restart futebot
else
  pm2 start /usr/bin/bash --name futebot --cwd ${APP_DIR} -- -c "node --env-file=.env src/index.js"
fi
EOF

echo "Aguardando QR nos logs..."
echo ""

exec ssh -t -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" \
  "pm2 logs futebot --lines 30"
