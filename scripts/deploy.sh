#!/usr/bin/env bash
set -euo pipefail

# Deploy a prebuilt AstroBlog image to the netcup compose stack (caph-blog).
# The image is built and pushed by GitHub Actions; this script only pulls that
# image and recreates the container, so no compilation happens on this host.
# Intended for the self-hosted runner labeled `netcup`.

IMAGE_REF="${IMAGE_REF:-ghcr.io/caph-dev/astroblog:latest}"
COMPOSE_DIR="${COMPOSE_DIR:-/home/caph/compose/caph-stack}"
LOG="${DEPLOY_LOG:-/tmp/caph-blog-deploy.log}"
CONTAINER="${CONTAINER:-caph-blog}"
# Convenience tag for humans and for rollback; the compose project itself may
# ask for a different name (see compose_image below).
LOCAL_TAG="${LOCAL_TAG:-caph-blog:latest}"
PREV_TAG="${PREV_TAG:-caph-blog:previous}"

echo "=== deploy $(date -Iseconds) ===" | tee "$LOG"
echo "image=$IMAGE_REF compose=$COMPOSE_DIR" | tee -a "$LOG"

# Pull first: if this fails, the running site is untouched.
docker pull "$IMAGE_REF" >>"$LOG" 2>&1
echo "docker pull done" | tee -a "$LOG"
pulled_id="$(docker inspect --format '{{.Id}}' "$IMAGE_REF")"

# Remember what is actually running right now, so a bad image can be rolled
# back with:
#   docker tag caph-blog:previous "$compose_image"
#   cd "$COMPOSE_DIR" && docker compose up -d --no-deps --force-recreate blog
prev_id="$(docker inspect --format '{{.Image}}' "$CONTAINER" 2>/dev/null || true)"
if [[ -n "$prev_id" ]]; then
  docker tag "$prev_id" "$PREV_TAG"
fi

cd "$COMPOSE_DIR"

# The compose project may pin a release tag (for example
# caph-blog:20261101-0923) instead of tracking a rolling tag. Ask compose which
# image name the blog service expects, and point that name at the image we just
# pulled, so the host configuration keeps working untouched.
compose_image="$(docker compose config --images 2>/dev/null | grep -E '(^|/)caph-blog:' | head -1 || true)"
if [[ -z "$compose_image" ]]; then
  compose_image="$(docker compose config 2>/dev/null | awk '
    /^  [a-zA-Z0-9_.-]+:/ { in_service = ($1 == "blog:") ; next }
    in_service && /^ *image:/ { print $2; exit }
  ' || true)"
fi
if [[ -z "$compose_image" ]]; then
  echo "cannot determine the image name compose expects for service blog" | tee -a "$LOG"
  exit 1
fi
echo "compose_image=$compose_image" | tee -a "$LOG"

docker tag "$IMAGE_REF" "$compose_image"
docker tag "$IMAGE_REF" "$LOCAL_TAG"

# --no-build: never build here. The image was prepared by the GitHub runner and
# only re-tagged locally above, so compose starts exactly that image.
docker compose up -d --no-deps --no-build --force-recreate blog

for i in $(seq 1 45); do
  status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CONTAINER" 2>/dev/null || echo missing)"
  if [[ "$status" == "healthy" ]]; then
    echo "caph-blog healthy" | tee -a "$LOG"
    break
  fi
  if [[ "$i" -eq 45 ]]; then
    echo "caph-blog not healthy after wait (status=$status)" | tee -a "$LOG"
    docker ps -a --filter "name=$CONTAINER" | tee -a "$LOG"
    exit 1
  fi
  sleep 2
done

# The recreated container must actually run the image just pulled; any mount
# over the served path would mask the files baked into that image.
running_id="$(docker inspect --format '{{.Image}}' "$CONTAINER" 2>/dev/null || true)"
echo "pulled=$pulled_id running=$running_id compose_image=$compose_image" | tee -a "$LOG"
docker inspect --format '{{range .Mounts}}mount: {{.Type}} {{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' "$CONTAINER" | tee -a "$LOG"
if [[ "$running_id" != "$pulled_id" ]]; then
  echo "caph-blog is not running the pulled image (compose pins $compose_image)" | tee -a "$LOG"
  exit 1
fi

curl -fsS -o /dev/null -H 'Host: caph.me' http://127.0.0.1/
curl -fsS -o /dev/null https://caph.me/

# Drop older pulls of this image so the host disk does not fill up over time.
# The running release stays reachable through $compose_image, $LOCAL_TAG and
# $PREV_TAG. (Assumes the registry host carries no port, which holds for ghcr.io.)
image_repo="${IMAGE_REF%%:*}"
current_tag="${IMAGE_REF##*:}"
while IFS= read -r ref; do
  docker rmi "$ref" >/dev/null 2>&1 || true
done < <(docker images "$image_repo" --format '{{.Repository}}:{{.Tag}}' | grep -v -e ":${current_tag}\$" -e ':latest$' || true)
# Untagging leaves the old layers behind; drop those that no remaining tag or
# container references. Safe: dangling-only, never touches tagged images.
docker image prune -f >/dev/null 2>&1 || true

echo "Deploy complete: https://caph.me/"
