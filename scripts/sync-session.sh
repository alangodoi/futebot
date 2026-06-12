#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

HOST="${DEPLOY_HOST:-138.197.32.187}"
USER="${DEPLOY_USER:-deploy}"
KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519_DO_agent}"
APP_DIR="${DEPLOY_APP_DIR:-/home/deploy/apps/futebot}"

if [ ! -d "$ROOT_DIR/auth_info" ]; then
  echo "auth_info/ não encontrado localmente. Conecte o WhatsApp aqui primeiro."
  exit 1
fi

echo "Pare o futebot local antes de sincronizar (mesma sessão WhatsApp não pode rodar em 2 lugares)."

ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" "pm2 stop futebot 2>/dev/null || true"

rsync -avz --delete -e "ssh -i ${KEY} -o BatchMode=yes" \
  "$ROOT_DIR/auth_info/" "${USER}@${HOST}:${APP_DIR}/auth_info/"

if [ -d "$ROOT_DIR/data" ]; then
  rsync -avz --delete -e "ssh -i ${KEY} -o BatchMode=yes" \
    "$ROOT_DIR/data/" "${USER}@${HOST}:${APP_DIR}/data/"
fi

ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" "cd ${APP_DIR} && pm2 restart futebot"

echo "Sessão sincronizada."
