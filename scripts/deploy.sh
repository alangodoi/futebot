#!/usr/bin/env bash
set -euo pipefail

HOST="${DEPLOY_HOST:-138.197.32.187}"
USER="${DEPLOY_USER:-deploy}"
KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519_DO_agent}"
APP_DIR="${DEPLOY_APP_DIR:-/home/deploy/apps/futebot}"

ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" bash -s <<EOF
set -euo pipefail
cd ${APP_DIR}
git pull origin main
npm install
pm2 restart futebot
EOF

echo "Deployed futebot on ${HOST}"
