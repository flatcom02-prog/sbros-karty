#!/usr/bin/env bash
# Keep «Сбрось карты» reachable via Cloudflare quick tunnel.
# Run on the worker VM. Ephemeral URL is printed by cloudflared.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Prefer fast local copy if present
APP="${SBROS_APP:-/tmp/sbros-karty}"
if [[ ! -f "$APP/package.json" ]]; then
  APP="$ROOT"
fi
PORT="${PORT:-3080}"
LOG_DIR="${LOG_DIR:-/tmp/sbros-deploy-logs}"
CF="${CLOUDFLARED:-/tmp/cloudflared}"
mkdir -p "$LOG_DIR"

if [[ ! -x "$CF" ]]; then
  echo "Downloading cloudflared..."
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o "$CF"
  chmod +x "$CF"
fi

if [[ ! -d "$APP/dist" ]]; then
  echo "Building in $APP ..."
  (cd "$APP" && npm install && npm run build)
fi

if ! curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  echo "Starting server on :$PORT ..."
  (cd "$APP" && PORT="$PORT" npm run start:prod >>"$LOG_DIR/server.log" 2>&1) &
  for _ in $(seq 1 30); do
    curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1 && break
    sleep 0.3
  done
fi

echo "Starting tunnel → http://127.0.0.1:${PORT}"
exec "$CF" tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate 2>&1 | tee -a "$LOG_DIR/tunnel.log"
