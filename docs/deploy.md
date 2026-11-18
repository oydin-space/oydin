# Деплой

Один сервер (Ubuntu, Docker), https://oydin.space. Стек в `deploy/compose.yaml`: `caddy` (авто-TLS) → `api` (gunicorn) и `web` (Next standalone), `db` (postgres:17, том `pgdata`). Caddy: `/api/*`, `/admin/*`, `/static/*` → api, остальное → web.

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
- Откат на предыдущий выкат: `mise run rollback` (на сервере перед каждым выкатом образы `oydin-api`/`oydin-web` сохраняются как `:previous`; одноразовый шаг, глубже одного выката не хранится). Откат на любой коммит, образ которого есть в GHCR: Actions → Deploy → Run workflow → `sha` (полный SHA). Миграции БД откат образа не отменяет: при необходимости вручную `docker compose exec api python manage.py migrate <app> <номер>`.

## CI/CD (GitHub Actions)

- `.github/workflows/ci.yml` (PR и push в `main`): `backend` (uv sync, ruff если настроен, `makemigrations --check`, `manage.py test` на Postgres 17), `web` (`bun install --frozen-lockfile`, eslint, `tsc --noEmit`, `next build`), `docker` (сборка обоих образов с кэшем buildx, без push).
- `.github/workflows/deploy.yml`: после успешного CI на `main` (environment `production`) собирает образы, пушит в `ghcr.io/aliakseych/oydin-{api,web}:<sha>`, по ssh на сервере делает `docker pull`, тегирует как `oydin-*:latest` (предыдущие становятся `:previous`; `compose.yaml` не меняется), `docker compose up -d --wait`, `manage.py migrate`, затем проверяет `https://oydin.space/api/health/` (`"ok": true`). Если переключение или проверка не прошли, job возвращает `:previous` и падает. Параллельные деплои сериализуются.
- Пакеты GHCR приватные: логин на сервере делается `GITHUB_TOKEN` через stdin на время job и сразу `docker logout`; долгоживущих кредов на сервере нет.
- Локальный `mise run deploy` работает как раньше (образы `:latest`, без GHCR).
- Actions закреплены по SHA коммита (комментарий с версией), права jobs минимальные.

### Секреты репозитория (Settings → Secrets → Actions)

| Секрет | Содержимое |
| --- | --- |
| `DEPLOY_SSH_KEY` | приватный ed25519-ключ выделенного deploy-ключа (публичная часть в `~oydin/.ssh/authorized_keys`, комментарий `github-actions-deploy@oydin`) |
| `DEPLOY_HOST` | IP сервера |
| `DEPLOY_USER` | `oydin` |
| `DEPLOY_KNOWN_HOSTS` | вывод `ssh-keyscan` сервера (проверка ключа хоста) |

Ротация: `ssh-keygen -t ed25519 -N ''`, добавить публичную часть в `authorized_keys`, `gh secret set DEPLOY_SSH_KEY < key`, удалить старую строку из `authorized_keys`, удалить приватный ключ локально. `.env` на сервере деплой не трогает.
