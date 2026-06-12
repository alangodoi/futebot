#!/usr/bin/env bash
set -euo pipefail

HOST="${DEPLOY_HOST:-138.197.32.187}"
USER="${DEPLOY_USER:-deploy}"
KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519_DO_agent}"
APP_DIR="${DEPLOY_APP_DIR:-/home/deploy/apps/futebot}"
REPO="${DEPLOY_REPO:-git@github.com:alangodoi/futebot.git}"

ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" bash -s <<EOF
set -euo pipefail
mkdir -p $(dirname ${APP_DIR})
if [ ! -d ${APP_DIR}/.git ]; then
  git clone ${REPO} ${APP_DIR}
fi
cd ${APP_DIR}
git pull origin main
npm install
mkdir -p data auth_info
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Edite o .env: nano ${APP_DIR}/.env"
fi
if ! pm2 describe futebot >/dev/null 2>&1; then
  pm2 start /usr/bin/bash --name futebot --cwd ${APP_DIR} -- -c "node --env-file=.env src/index.js"
else
  pm2 restart futebot
fi
pm2 save
EOF

echo "Setup done. Next: npm run sync:session (or pm2 logs futebot for QR)"
