# Email sign-in codes (SMTP)

Users get a 6-digit code by email. Without `EMAIL_HOST` the SMTP backend is off and `/api/auth/providers/` reports `"email": false` (in `DEBUG` mode codes print to the console instead).

## Variables

Read by `backend/config/settings.py`, passed to the `api` service by `deploy/compose.yaml`:

| Var | Default | Meaning |
|---|---|---|
| `EMAIL_HOST` | empty | SMTP server; setting it enables email login |
| `EMAIL_PORT` | `587` | port |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | empty | SMTP credentials |
| `EMAIL_USE_TLS` | `1` | STARTTLS (port 587) |
| `EMAIL_USE_SSL` | `0` | implicit TLS (port 465); do not enable together with TLS |
| `DEFAULT_FROM_EMAIL` | `Oydin <noreply@oydin.space>` | sender; must be allowed by your provider |

## Steps

1. Create an SMTP account at your provider and verify the sending domain/address (SPF/DKIM for deliverability).
2. Append to `~/oydin/.env` (keep `chmod 600`); example for a generic provider:

   ```
   EMAIL_HOST=smtp.example.com
   EMAIL_PORT=587
   EMAIL_HOST_USER=<smtp username>
   EMAIL_HOST_PASSWORD=<smtp password>
   EMAIL_USE_TLS=1
   EMAIL_USE_SSL=0
   DEFAULT_FROM_EMAIL=Oydin <noreply@oydin.space>
   ```
3. Restart: `cd ~/oydin && docker compose up -d`
4. Verify: `curl https://oydin.space/api/auth/providers/` shows `"email": true`.
5. Round-trip: request a code, read the email, verify it.

   ```
   curl -X POST https://oydin.space/api/auth/email/request/ -H 'Content-Type: application/json' -d '{"email":"you@example.com","lang":"en"}'
   ```

   Expect `{"ok": true, "resend_in": 60}`. Easier: sign in through the site and enter the code (verify is `POST /api/auth/email/verify/` with `email` and `code`; browsers also need the CSRF cookie from `/api/auth/csrf/`).

## Limits enforced by the code (`backend/accounts/otp.py`)

- Code lives 10 minutes; 5 verification attempts per code.
- One request per email per 60 s, max 5 per email per hour.
- Max 20 requests and 30 verifications per IP per hour.
- Exceeding any limit returns `429 rate_limited`.

## Troubleshooting

- `503 email_not_configured` — `EMAIL_HOST` is empty in the container; check `.env` and recreate with `docker compose up -d`.
- `400 invalid_email` — address failed validation.
- `429 rate_limited` — see limits above; wait and retry.
- `400 invalid_code` — wrong, expired or already used code.
- `403 forbidden` on verify — staff/superuser accounts cannot sign in this way.
- Request returns 200 but no mail, or a 500 — SMTP error (15 s timeout): check `docker compose logs api`, port/TLS pairing (587+TLS or 465+SSL), credentials, sender verification.
