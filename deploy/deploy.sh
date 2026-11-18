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
URL="https://${PUBLIC_HOST:-oydin.space}"

for svc in api web; do
  ctx=backend; [ "$svc" = web ] && ctx=web
  docker buildx build --platform linux/amd64 --load -t "oydin-$svc:latest" "$ctx"
  docker builder prune -af >/dev/null
  docker save "oydin-$svc:latest" | gzip | ssh "$REMOTE" 'docker load'
done

ssh "$REMOTE" 'mkdir -p ~/oydin/docs-site ~/oydin/vault'
scp -q deploy/compose.yaml deploy/Caddyfile deploy/ensure-env.sh "$REMOTE:oydin/"
scp -q deploy/vault/vault.hcl deploy/vault/oydin-app.hcl "$REMOTE:oydin/vault/"
scp -q -r docs-site/. "$REMOTE:oydin/docs-site/"
ssh "$REMOTE" 'cd ~/oydin && bash ensure-env.sh && docker compose up -d --remove-orphans --wait && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile && docker image prune -f >/dev/null'
curl -fsS --retry 10 --retry-delay 3 --retry-connrefused "$URL/api/health/" && echo
# Профиль бота в Telegram (имя, описания, команды, меню, аватар); миграции уже прошли в entrypoint api. Не критично для деплоя.
ssh "$REMOTE" 'cd ~/oydin && docker compose exec -T api python manage.py set_bot_profile' || echo "set_bot_profile: не удалось, деплой продолжен" >&2
