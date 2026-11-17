# Деплой

Один сервер (Ubuntu, Docker), https://oydin.sayfi.uz. Стек в `deploy/compose.yaml`: `caddy` (авто-TLS) → `api` (gunicorn) и `web` (Next standalone), `db` (postgres:17, том `pgdata`). Caddy: `/api/*`, `/admin/*`, `/static/*` → api, остальное → web.

## Повторный деплой

```sh
mise run deploy        # = deploy/deploy.sh
```

Скрипт собирает образы `linux/amd64` локально (`docker buildx build --platform linux/amd64 --load`), чистит кэш сборки, грузит через `docker save | gzip | ssh oydin@SERVER docker load`, копирует `compose.yaml` и `Caddyfile`, делает `docker compose up -d --wait` и проверяет `/api/health/`. IP берётся из `SERVER` (окружение или `temp/secrets.env`).

При старте `api` выполняет `migrate` и `seed` (демо-бизнес создаётся один раз, перезапуск данные не сбрасывает; чтобы пересоздать: `docker compose exec api python manage.py seed`).

## Первичная настройка сервера (один раз)

1. root: пользователь `oydin` без пароля, `authorized_keys` скопирован из root, группа `docker`; Docker Engine + compose из официального apt-репозитория Docker; `ufw` разрешает 22, 80, 443 (tcp, 443 udp для HTTP/3).
2. `~oydin/oydin/.env` (chmod 600) по образцу `deploy/.env.example`: `POSTGRES_PASSWORD` и `DJANGO_SECRET_KEY` случайные, остальное из секретов (`OPENROUTER_API` → `LLM_API_KEY`, `BOTAPI_TOKEN` → `TELEGRAM_BOT_TOKEN`). Не пересоздавайте файл заново: пароль БД в томе уже зафиксирован.

## Прод-настройки Django

`DEBUG=0` → `DJANGO_SECRET_KEY` обязателен, куки secure (`SameSite=None` для Telegram Mini App), `SECURE_PROXY_SSL_HEADER` по `X-Forwarded-Proto`, `ALLOWED_HOSTS` и `CSRF_TRUSTED_ORIGINS` из окружения. `DEMO_LOGIN=1` оставлен для жюри (данные синтетические).

## Telegram

Кнопка меню и описания бота задаются Bot API (`setChatMenuButton` с `web_app` → `/app`, `setMyDescription`, `setMyShortDescription`); токен берётся из `TELEGRAM_BOT_TOKEN`, не из репозитория.

## Откат / эксплуатация

- Логи: `ssh oydin@SERVER 'cd oydin && docker compose logs -f api'`.
- Откат: предыдущий образ не хранится; соберите нужный коммит и снова `mise run deploy`. Миграции откатываются вручную (`manage.py migrate <app> <номер>`).
