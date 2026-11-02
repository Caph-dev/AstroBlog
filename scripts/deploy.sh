#!/usr/bin/env bash
set -euo pipefail

# Deploy a prebuilt AstroBlog image to the netcup compose stack (caph-blog).
# The image is built and pushed by GitHub Actions; this script only pulls that
# image and recreates the container, so no compilation happens on this host.
# Intended for the self-hosted runner labeled `netcup`.

IMAGE_REF="${IMAGE_REF:-ghcr.io/caph-dev/astroblog:latest}"
COMPOSE_DIR="${COMPOSE_DIR:-/home/caph/compose/caph-stack}"
LOG="${DEPLOY_LOG:-/tmp/caph-blog-deploy.log}"
# The compose project on this host references a local image tag, so the pulled
# image is re-tagged to match and the host configuration stays untouched.
LOCAL_TAG="${LOCAL_TAG:-caph-blog:latest}"
PREV_TAG="${PREV_TAG:-caph-blog:previous}"

echo "=== deploy $(date -Iseconds) ===" | tee "$LOG"
echo "image=$IMAGE_REF compose=$COMPOSE_DIR" | tee -a "$LOG"

# Pull first: if this fails, the running site is untouched.
docker pull "$IMAGE_REF" >>"$LOG" 2>&1
echo "docker pull done" | tee -a "$LOG"

# Keep the release currently running so a bad image can be rolled back with:
#   docker tag caph-blog:previous caph-blog:latest
#   cd "$COMPOSE_DIR" && docker compose up -d --no-deps --force-recreate blog
if docker image inspect "$LOCAL_TAG" >/dev/null 2>&1; then
  docker tag "$LOCAL_TAG" "$PREV_TAG"
fi
docker tag "$IMAGE_REF" "$LOCAL_TAG"

cd "$COMPOSE_DIR"
# Record what the compose project expects, so a name mismatch between the pulled
# image and the service definition is visible in the deploy log.
echo "--- compose service image/build ---" | tee -a "$LOG"
docker compose config 2>/dev/null | grep -nE "^ *[a-z_]+:|image:|build:|context:|pull_policy:" | grep -B1 -A2 -E "image:|build:" | head -30 | tee -a "$LOG" || true
# --no-build: never build here. The image was prepared by the GitHub runner and
# only re-tagged locally, so compose must start exactly that local image.
docker compose up -d --no-deps --no-build --force-recreate blog

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

# A recreated container must actually be running the image just pulled; and any
# mount over the served path would mask the files baked into it.
running_image="$(docker inspect --format '{{.Image}}' caph-blog 2>/dev/null || true)"
expected_image="$(docker inspect --format '{{.Id}}' "$LOCAL_TAG")"
requested_image="$(docker inspect --format '{{.Config.Image}}' caph-blog 2>/dev/null || true)"
echo "running_image=$running_image expected_image=$expected_image requested_image=$requested_image" | tee -a "$LOG"
docker inspect --format '{{range .Mounts}}mount: {{.Type}} {{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' caph-blog | tee -a "$LOG"
if [[ "$running_image" != "$expected_image" ]]; then
  echo "caph-blog is not running the pulled image" | tee -a "$LOG"
  exit 1
fi

curl -fsS -o /dev/null -H 'Host: caph.me' http://127.0.0.1/
curl -fsS -o /dev/null https://caph.me/

# Drop older pulls of this image so the host disk does not fill up over time.
# The running release stays reachable through $LOCAL_TAG and $PREV_TAG.
# (Assumes the registry host carries no port, which holds for ghcr.io.)
image_repo="${IMAGE_REF%%:*}"
current_tag="${IMAGE_REF##*:}"
while IFS= read -r ref; do
  docker rmi "$ref" >/dev/null 2>&1 || true
done < <(docker images "$image_repo" --format '{{.Repository}}:{{.Tag}}' | grep -v -e ":${current_tag}\$" -e ':latest$' || true)
# Untagging leaves the old layers behind; drop those that no remaining tag or
# container references. Safe: dangling-only, never touches tagged images.
docker image prune -f >/dev/null 2>&1 || true

echo "Deploy complete: https://caph.me/"
