#!/usr/bin/env bash
# Выполняется на сервере в ~/oydin: дописывает в .env недостающие BUGSINK_* со случайными значениями.
# Значения никогда не печатаются; существующие не трогаются.
set -euo pipefail
cd "$(dirname "$0")"
touch .env && chmod 600 .env
add() { # имя значение; пустое значение считается отсутствующим
  grep -q "^$1=." .env && return 0
  grep -v "^$1=" .env > .env.tmp || true
  mv .env.tmp .env && chmod 600 .env
  printf '%s=%s\n' "$1" "$2" >> .env
}
add BUGSINK_SECRET_KEY "$(openssl rand -hex 32)"
add BUGSINK_ADMIN_EMAIL "admin@oydin.space"
add BUGSINK_ADMIN_PASSWORD "$(openssl rand -hex 16)"

# PUBLIC_HOST не должен совпадать со старым доменом: иначе Caddy зациклит редирект OLD_HOST -> PUBLIC_HOST.
public_host="$(grep '^PUBLIC_HOST=' .env | tail -1 | cut -d= -f2- || true)"
old_host="$(grep '^OLD_HOST=' .env | tail -1 | cut -d= -f2- || true)"
old_host="${old_host:-oydin.sayfi.uz}"
if [ "$public_host" = "$old_host" ]; then
  echo "ОШИБКА: PUBLIC_HOST в .env равен OLD_HOST ($old_host). Укажите новый домен (oydin.space)." >&2
  exit 1
fi
