#!/usr/bin/env bash
set -euo pipefail

# 在 netcup 主机上部署自建 Meting API，并把它挂到现有 Caddy 的 caph.me/meting/ 路径。
# 由 .github/workflows/deploy-meting.yml 通过 workflow_dispatch 在
# [self-hosted, netcup] runner 上执行；本脚本幂等，重复执行即“对齐到目标状态”。
#
# 1. 用仓库里的 compose 文件启动/更新 caph-meting 容器（不占公网端口）
# 2. 在 Caddyfile 的两个 server block 里插入 /meting 路由（已存在则跳过）
# 3. 校验并 reload Caddy，失败自动回滚
# 4. 跑就绪探针 + 音源可达性探针

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT/deploy/meting/docker-compose.yml"
METING_IMAGE="${METING_IMAGE:-}"
if [[ -z "$METING_IMAGE" ]]; then
  echo "METING_IMAGE is required (e.g. ghcr.io/caph-dev/meting-api:sha-xxxx)" >&2
  exit 1
fi
export METING_IMAGE
PROJECT="caph-meting"
CONTAINER="caph-meting"
CADDY="caph-caddy"
STACK_DIR="${STACK_DIR:-/home/caph/compose/caph-stack}"
PLAYLIST_ID="${PLAYLIST_ID:-18554736499}"
PROBE_PORT="${PROBE_PORT:-3002}"
DOMAIN="${DOMAIN:-caph.me}"
LOG="${DEPLOY_LOG:-/tmp/caph-meting-deploy.log}"

log() { echo "$*" | tee -a "$LOG"; }

echo "=== meting deploy $(date -Iseconds) ===" | tee "$LOG"

# ── 1. 容器 ──────────────────────────────────────────────
log "--- 启动/更新容器"
docker compose -p "$PROJECT" -f "$COMPOSE_FILE" pull >>"$LOG" 2>&1
docker compose -p "$PROJECT" -f "$COMPOSE_FILE" up -d >>"$LOG" 2>&1
docker ps --filter "name=$CONTAINER" --format '{{.Names}} {{.Status}} {{.Image}}' | tee -a "$LOG"

log "--- 等待就绪"
ready=""
for i in $(seq 1 40); do
  if curl -fsS -m 5 "http://127.0.0.1:${PROBE_PORT}/meting/?server=netease&type=song&id=29540314" >/dev/null 2>&1; then
    ready="yes"; break
  fi
  sleep 3
done
if [[ -z "$ready" ]]; then
  log "容器未就绪，最后 30 行日志："
  docker logs --tail 30 "$CONTAINER" 2>&1 | tee -a "$LOG"
  exit 1
fi
log "就绪"

# ── 2. Caddy 路由 ────────────────────────────────────────
mount_line="$(docker inspect "$CADDY" --format '{{range .Mounts}}{{.Source}}={{.Destination}}{{"\n"}}{{end}}' | grep -m1 'Caddyfile' || true)"
if [[ -z "$mount_line" ]]; then
  log "找不到 Caddyfile 挂载点，停止"
  exit 1
fi
host_cfg="${mount_line%%=*}"
ctr_cfg="${mount_line##*=}"
log "caddyfile: host=$host_cfg container=$ctr_cfg"

MARKER='# meting-api (managed by scripts/deploy-meting.sh)'

patch_caddy() {
  python3 - "$host_cfg" <<'PY'
import sys
path = sys.argv[1]
NEW = (
    "  # meting-api (managed by scripts/deploy-meting.sh)\n"
    "  @meting {\n"
    "    host caph.me\n"
    "    path /meting /meting/*\n"
    "  }\n"
    "  handle @meting {\n"
    "    reverse_proxy caph-meting:3000 {\n"
    "      # 网易云 CDN 的 302 给的是 http:// 地址，而页面是 https，浏览器会按混合内容拦掉；\n"
    "      # CDN 本身支持 https，这里把重定向目标改写成 https。\n"
    "      header_down Location http:// https://\n"
    "    }\n"
    "  }\n"
)
OLD = (
    "  # meting-api (managed by scripts/deploy-meting.sh)\n"
    "  @meting {\n"
    "    host caph.me\n"
    "    path /meting /meting/*\n"
    "  }\n"
    "  handle @meting {\n"
    "    reverse_proxy caph-meting:3000\n"
    "  }\n"
)
with open(path) as f:
    src = f.read()
if NEW in src:
    print("caddyfile: already routed")
    raise SystemExit(0)
if OLD in src:
    src = src.replace(OLD, NEW)
    with open(path, "w") as f:
        f.write(src)
    print("caddyfile: upgraded existing route")
    raise SystemExit(0)
anchor = "  @blog host caph.me\n"
count = src.count(anchor)
if count != 2:
    print(f"caddyfile: unexpected @blog anchor count={count}, refusing to patch")
    raise SystemExit(2)
src = src.replace(anchor, NEW + anchor)
with open(path, "w") as f:
    f.write(src)
print("caddyfile: route inserted")
PY
}

backup="$host_cfg.bak-before-meting-$(date +%Y%m%d%H%M%S)"
cp "$host_cfg" "$backup"
log "backup: $backup"

if ! patch_caddy 2>&1 | tee -a "$LOG"; then
  log "插入路由失败，未改动 Caddy，恢复备份"
  cp "$backup" "$host_cfg"
  exit 1
fi

if ! docker exec "$CADDY" caddy validate --config "$ctr_cfg" --adapter caddyfile >>"$LOG" 2>&1; then
  log "caddy validate 失败，恢复备份"
  cp "$backup" "$host_cfg"
  exit 1
fi

if ! docker exec "$CADDY" caddy reload --config "$ctr_cfg" --adapter caddyfile >>"$LOG" 2>&1; then
  log "caddy reload 失败，恢复备份并再次 reload"
  cp "$backup" "$host_cfg"
  docker exec "$CADDY" caddy reload --config "$ctr_cfg" --adapter caddyfile >>"$LOG" 2>&1 || true
  exit 1
fi
log "caddy reloaded"

# ── 3. 验收 ──────────────────────────────────────────────
log "--- 验收：本地回环 + Caddy 路由"
curl -fsS -o /dev/null -w "container /meting -> %{http_code}\n" \
  "http://127.0.0.1:${PROBE_PORT}/meting/?server=netease&type=playlist&id=${PLAYLIST_ID}" | tee -a "$LOG"

playlist_json="$(curl -fsS -m 20 -H "Host: $DOMAIN" "http://127.0.0.1/meting/?server=netease&type=playlist&id=${PLAYLIST_ID}" || true)"
printf '%s' "$playlist_json" > /tmp/meting-playlist.json
python3 - <<'PY' | tee -a "$LOG"
import json
try:
    d = json.load(open('/tmp/meting-playlist.json'))
except Exception:
    print("路由验收: 返回非 JSON，失败")
    raise SystemExit(1)
print(f"路由验收: {len(d)} 首")
for t in d:
    print("  -", (t.get('title') or t.get('name')), "|", t.get('author') or t.get('artist'))
PY

# 博客本身必须仍然正常
curl -fsS -o /dev/null -w "blog / -> %{http_code}\n" -H "Host: $DOMAIN" http://127.0.0.1/ | tee -a "$LOG"

# ── 4. 音源可达性：netcup 能不能真的拿到音频 ────────────
log "--- 音源探针（关键：德国主机到网易云 CDN）"
python3 - <<'PY' | tee -a "$LOG"
import json, subprocess, time
d = json.load(open('/tmp/meting-playlist.json'))
for t in d[:3]:
    title = t.get('title') or t.get('name')
    sid = (t.get('url') or '').split('id=')[1].split('&')[0] if 'id=' in (t.get('url') or '') else None
    if not sid:
        print(f"  {title}: 无 id"); continue
    raw = subprocess.run(["curl","-s","-m","20",
        f"http://127.0.0.1:3002/meting/?type=song&id={sid}"],capture_output=True).stdout
    try:
        j = json.loads(raw); u = j[0]['url'] if isinstance(j,list) and j else ''
    except Exception:
        print(f"  {title}: song 端点返回异常 {raw[:60]!r}"); continue
    if not u:
        print(f"  {title}: 无音源"); continue
    t0 = time.time()
    r = subprocess.run(["curl","-sL","-m","60","-o","/dev/null",
        "-w","%{http_code} %{size_download} %{time_starttransfer} %{time_total}",
        "-r","0-65535","-e","https://music.163.com/","-A","Mozilla/5.0", u],capture_output=True).stdout.decode()
    parts = r.split()
    if len(parts) == 4:
        code, size, ttfb, total = parts
        print(f"  {title}: http={code} 首字节={float(ttfb):.2f}s 总={float(total):.2f}s 拿到={int(size)//1024}KB"
              f" host={(u.split('/')[2] if '://' in u else u[:40])}")
    else:
        print(f"  {title}: 探针输出异常 {r!r}")
PY

log "Deploy meting complete"
