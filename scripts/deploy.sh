#!/usr/bin/env bash
set -euo pipefail

# Deploy AstroBlog to netcup compose stack (caph-blog).
# Intended for the self-hosted runner labeled `netcup` (Actions checkout provides ROOT).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="${COMPOSE_DIR:-/home/caph/compose/caph-stack}"
LOG="${DEPLOY_LOG:-/tmp/caph-blog-deploy.log}"

echo "=== deploy $(date -Iseconds) ===" | tee "$LOG"
echo "repo=$ROOT compose=$COMPOSE_DIR" | tee -a "$LOG"

cd "$ROOT"
docker build -t caph-blog:latest . >>"$LOG" 2>&1
echo "docker build done" | tee -a "$LOG"

cd "$COMPOSE_DIR"
docker compose up -d --no-deps --force-recreate blog

for i in $(seq 1 45); do
  status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' caph-blog 2>/dev/null || echo missing)"
  if [[ "$status" == "healthy" ]]; then
    echo "caph-blog healthy" | tee -a "$LOG"
    break
  fi
  if [[ "$i" -eq 45 ]]; then
    echo "caph-blog not healthy after wait (status=$status)" | tee -a "$LOG"
    docker ps -a --filter name=caph-blog | tee -a "$LOG"
    exit 1
  fi
  sleep 2
done

curl -fsS -o /dev/null -H 'Host: caph.me' http://127.0.0.1/
curl -fsS -o /dev/null https://caph.me/

echo "Deploy complete: https://caph.me/"
