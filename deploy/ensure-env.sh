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
add BUGSINK_ADMIN_EMAIL "admin@oydin.sayfi.uz"
add BUGSINK_ADMIN_PASSWORD "$(openssl rand -hex 16)"
