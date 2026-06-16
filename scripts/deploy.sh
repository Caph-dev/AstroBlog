#!/usr/bin/env bash
set -euo pipefail

cd /home/ubuntu/caph-blog
git fetch origin main
git reset --hard origin/main

LOG=/tmp/caph-blog-deploy.log
echo "=== deploy $(date -Iseconds) ===" | tee "$LOG"

# Docker build is noisy; redirect output to avoid SSH action buffer issues.
sudo docker build -t caph-blog:latest . >>"$LOG" 2>&1
echo "docker build done" | tee -a "$LOG"

sudo docker save caph-blog:latest | sudo k3s ctr images import -
sudo kubectl rollout restart deployment/caph-blog -n caph-blog
sudo kubectl rollout status deployment/caph-blog -n caph-blog --timeout=180s
curl -fsS -o /dev/null https://caph.me/

echo "Deploy complete: https://caph.me/"
