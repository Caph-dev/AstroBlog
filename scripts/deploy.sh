#!/usr/bin/env bash
set -euo pipefail

cd /home/ubuntu/caph-blog
git fetch origin main
git reset --hard origin/main
sudo docker build -t caph-blog:latest .
sudo docker save caph-blog:latest | sudo k3s ctr images import -
sudo kubectl rollout restart deployment/caph-blog -n caph-blog
sudo kubectl rollout status deployment/caph-blog -n caph-blog --timeout=180s

echo "Deploy complete: https://caph.me/"
