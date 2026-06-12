#!/usr/bin/env bash
set -euo pipefail

HOST="${DEPLOY_HOST:-138.197.32.187}"
USER="${DEPLOY_USER:-deploy}"
KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519_DO_agent}"

exec ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" "pm2 logs futebot --lines 100"
