# Operator guides

Step-by-step setup for production (`https://oydin.sayfi.uz`). All secrets go into `~/oydin/.env` on the server (append-only, `chmod 600`); apply with `cd ~/oydin && docker compose up -d`. Check which providers are live with `curl https://oydin.sayfi.uz/api/auth/providers/`.

- [Google sign-in](google-oauth.md) — OAuth client, redirect URI, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- [Email codes via SMTP](smtp-email-otp.md) — `EMAIL_*` variables, limits, round-trip check.
- [Telegram bot](telegram-bot.md) — token, webhook, `botjobs`, account linking.
