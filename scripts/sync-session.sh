#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

HOST="${DEPLOY_HOST:-138.197.32.187}"
USER="${DEPLOY_USER:-deploy}"
KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519_DO_agent}"
APP_DIR="${DEPLOY_APP_DIR:-/home/deploy/apps/futebot}"
RSYNC_SSH="ssh -i ${KEY} -o BatchMode=yes"

stop_local_bot() {
  if pgrep -f "${ROOT_DIR}/src/index.js" >/dev/null 2>&1; then
    echo "Parando futebot local..."
    pkill -f "${ROOT_DIR}/src/index.js" || true
    sleep 2
  fi
}

checkpoint_db() {
  local db="${ROOT_DIR}/data/futebot.db"
  if [[ ! -f "$db" ]]; then
    echo "AVISO: data/futebot.db não encontrado localmente."
    return
  fi

  if command -v sqlite3 >/dev/null 2>&1; then
    echo "Consolidando banco SQLite (wal_checkpoint)..."
    sqlite3 "$db" "PRAGMA wal_checkpoint(FULL);"
  else
    echo "AVISO: sqlite3 não instalado. Copiando .db + arquivos WAL."
  fi
}

if [[ ! -d "$ROOT_DIR/auth_info" ]]; then
  echo "ERRO: auth_info/ não encontrado localmente."
  echo "Conecte o WhatsApp aqui primeiro (npm run dev) ou use: npm run qr"
  exit 1
fi

echo "=== Sync local → servidor ==="
echo "Host: ${USER}@${HOST}:${APP_DIR}"
echo ""
echo "Isso copia:"
echo "  - auth_info/  (sessão WhatsApp)"
echo "  - data/       (banco SQLite com memória do bot)"
echo ""
echo "O bot NÃO pode rodar nos dois lugares ao mesmo tempo."
read -r -p "Continuar? [y/N] " confirm
if [[ "${confirm,,}" != "y" ]]; then
  exit 0
fi

stop_local_bot
checkpoint_db

echo "Parando futebot no servidor..."
ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" "pm2 stop futebot 2>/dev/null || true"

echo "Copiando auth_info/..."
rsync -avz --delete -e "$RSYNC_SSH" \
  "$ROOT_DIR/auth_info/" "${USER}@${HOST}:${APP_DIR}/auth_info/"

if [[ -d "$ROOT_DIR/data" ]]; then
  echo "Copiando data/ (banco)..."
  rsync -avz --delete -e "$RSYNC_SSH" \
    "$ROOT_DIR/data/" "${USER}@${HOST}:${APP_DIR}/data/"
else
  echo "AVISO: pasta data/ não existe localmente, banco não copiado."
fi

echo "Reiniciando futebot no servidor..."
ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" "cd ${APP_DIR} && pm2 restart futebot"

echo ""
echo "Sync concluído. Verifique: npm run logs"
