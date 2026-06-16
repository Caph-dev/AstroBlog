#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/Caph-dev/AstroBlog"
RUNNER_VERSION="2.321.0"
RUNNER_DIR="/home/ubuntu/actions-runner"

if [[ -z "${1:-}" ]]; then
  echo "Usage: $0 <GITHUB_RUNNER_REGISTRATION_TOKEN>"
  echo ""
  echo "Get a token from:"
  echo "  ${REPO_URL}/settings/actions/runners/new"
  exit 1
fi

TOKEN="$1"
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [[ ! -f ./config.sh ]]; then
  curl -fsSL -o actions-runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  tar xzf actions-runner.tar.gz
  rm actions-runner.tar.gz
fi

./config.sh --url "$REPO_URL" --token "$TOKEN" --unattended --replace

if ! sudo ./svc.sh status >/dev/null 2>&1; then
  sudo ./svc.sh install ubuntu
fi

sudo ./svc.sh start
sudo ./svc.sh status

echo "Runner installed. Push to main branch to trigger deploy."
