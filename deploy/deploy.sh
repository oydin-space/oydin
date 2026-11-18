#!/usr/bin/env bash
# Сборка linux/amd64 образов локально, загрузка по ssh, docker compose up на сервере.
# Нужен SERVER (IP) в окружении или в temp/secrets.env. Первичная настройка сервера и .env: docs/deploy.md.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${SERVER:-}" ] && [ -f temp/secrets.env ]; then
  SERVER=$(grep -E '^SERVER=' temp/secrets.env | cut -d= -f2- | tr -d '"')
fi
: "${SERVER:?SERVER не задан}"
REMOTE="oydin@$SERVER"
URL="https://${PUBLIC_HOST:-oydin.sayfi.uz}"

for svc in api web; do
  ctx=backend; [ "$svc" = web ] && ctx=web
  docker buildx build --platform linux/amd64 --load -t "oydin-$svc:latest" "$ctx"
  docker builder prune -af >/dev/null
  docker save "oydin-$svc:latest" | gzip | ssh "$REMOTE" 'docker load'
done

ssh "$REMOTE" 'mkdir -p ~/oydin'
scp -q deploy/compose.yaml deploy/Caddyfile "$REMOTE:oydin/"
ssh "$REMOTE" 'cd ~/oydin && docker compose up -d --remove-orphans --wait && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile && docker image prune -f >/dev/null'
curl -fsS --retry 10 --retry-delay 3 --retry-connrefused "$URL/api/health/" && echo
