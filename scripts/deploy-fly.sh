#!/usr/bin/env bash
# Deploy «Сбрось карты» to Fly.io — URL stays https://sbros-karty.fly.dev
# Requires: FLY_API_TOKEN (or `fly auth login`), flyctl, Docker OR Fly remote builder.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${FLY_API_TOKEN:-}" ]] && ! fly auth whoami >/dev/null 2>&1; then
  echo "BLOCKER: no Fly auth."
  echo "1) Sign up: https://fly.io/app/sign-up"
  echo "2) Create token: https://fly.io/user/personal_access_tokens"
  echo "3) export FLY_API_TOKEN=...   then re-run this script"
  exit 1
fi

export PATH="${HOME}/.fly/bin:${PATH}"

if ! fly apps list 2>/dev/null | grep -q '^sbros-karty'; then
  echo "Creating app sbros-karty (first time only)..."
  fly apps create sbros-karty --org personal || true
fi

echo "Deploying (same URL on every push)..."
fly deploy --ha=false --remote-only
echo "Smoke:"
curl -fsS "https://sbros-karty.fly.dev/health"
echo
echo "Stable URL: https://sbros-karty.fly.dev"
