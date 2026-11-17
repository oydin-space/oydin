# Telegram bot

The bot sends notifications, accepts SMS/receipt photos as drafts, and enables Telegram sign-in.

## Steps

1. In @BotFather: `/newbot` (or pick your bot) and copy the token.
2. Sign-in domain: `/setdomain` → select the bot → `oydin.sayfi.uz`. Note: the backend (`POST /api/auth/telegram/`) validates Mini App `init_data` signed with the bot token (valid 24 h); it does not consume Login Widget callbacks, so the token is what matters for login.
3. Append to `~/oydin/.env` (keep `chmod 600`):

   ```
   TELEGRAM_BOT_TOKEN=<token from BotFather>
   TELEGRAM_BOT_USERNAME=<bot username without @>
   ```
   `TELEGRAM_BOT_USERNAME` defaults to `oydin_agent`; it builds the link `https://t.me/<username>?start=<code>`.
4. Recreate services: `cd ~/oydin && docker compose up -d`. This also starts `botjobs`, which runs `python manage.py run_bot_jobs --loop` (a tick every 5 minutes).
5. Register the webhook (Telegram will POST to `https://oydin.sayfi.uz/api/telegram/webhook/`):

   ```
   docker compose exec api python manage.py set_telegram_webhook https://oydin.sayfi.uz
   ```
   Expected output: `Webhook: https://oydin.sayfi.uz/api/telegram/webhook/`.
6. Verify: `curl https://oydin.sayfi.uz/api/auth/providers/` shows `"telegram": true`.

The webhook secret is derived from `DJANGO_SECRET_KEY` and `TELEGRAM_BOT_TOKEN`. **If either changes, re-run `set_telegram_webhook`**, otherwise Telegram's requests get `403 forbidden`.

## Linking an account

In the app open notification settings and choose to connect Telegram (`POST /api/telegram/link/` returns a `t.me` link valid 15 minutes). Open it and press Start; the chat is bound to your user. Unlink with `DELETE /api/telegram/link/`.

## What the bot does

- Commands: `/start`, `/help`, `/brief`, `/lang`.
- Daily brief (from the user's `brief_hour`), cash-gap alerts (nearest gap within 14 days, repeated at most every 3 days), Monday weekly digest, tax reminders 3 days before and on the due date. Each is toggled via `daily_brief`, `gap_alerts`, `weekly_digest`, `tax_reminders` in `/api/notifications/settings/`.
- A bank SMS text or a receipt photo sent to the bot becomes a **draft** transaction with confirm buttons; requires the user's AI consent.

## Troubleshooting

- `"telegram": false` — `TELEGRAM_BOT_TOKEN` empty in the container.
- `403 forbidden` on `/api/telegram/webhook/` (see `docker compose logs api`) — webhook secret mismatch; re-run step 5.
- `set_telegram_webhook` prints `Telegram: ...` error — bad token or Telegram cannot reach the URL (needs public HTTPS).
- `401` on `/api/auth/telegram/` — `Неверная подпись` (token mismatch), `Данные устарели` (older than 24 h) or `Вход через Telegram не настроен` (no token).
- No notifications — check `docker compose ps botjobs` and `docker compose logs botjobs`; the account must be linked and the user a finance-reading role.
- Bot asks for consent instead of creating a draft — grant AI consent in the app.
