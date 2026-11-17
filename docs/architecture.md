# Oydin architecture (v0.2 scope)

Scope source: `docs/decisions.md`. HTTP contract: `docs/openapi.yaml` (v0.2.0) — the single source of truth; change it first, then code.

## Conventions (unchanged)

- Django, one app per bounded context, function views returning `JsonResponse` via `accounts.http.api_view`; errors `{"error": "..."}`; money is integer UZS; dates ISO.
- Every app exposes `urls.py` mounted under `/api/` in `config/urls.py`; business logic in `services.py` / `domain/`, views stay thin.
- Web calls the backend only through `api()` / `post()` in `web/src/lib/api.ts`; response types live in `web/src/lib/types.ts`.
- Permissions: `accounts.permissions.require(request, "<permission>")` → 403. Role → permission map is the `Permission` description in the spec.
- Secrets at rest (integration credentials, Google refresh tokens) are Fernet-encrypted with `INTEGRATIONS_FERNET_KEY`; personal API tokens and webhook secrets are stored hashed (SHA-256) / encrypted respectively and shown once.
- Locale: `User.locale` → `Business.locale` → `ru`. AI prompts, bot messages and TTS receive the locale explicitly.

## Module map

| Module | Kind | Responsibility | Endpoints |
|---|---|---|---|
| `backend/config` | core | settings, root urls, scheduler wiring | `/api/health/` |
| `backend/accounts` | app | users, businesses, membership/roles, invites, locale, Telegram Mini App + Login Widget auth, Google OAuth (login + sheets purpose) | `/auth/*`, `/me/`, `/business/`, `/team/*` |
| `backend/finance` | app | accounts, transactions (`purpose` personal/business), obligations, envelopes, forecast incl. seasonality, products, orders | `/transactions/`, `/forecast/`, … |
| `backend/insights` | app | pulse insights, analytics | `/insights/`, `/analytics/summary/` |
| `backend/growth` | new app | goals & streaks, anonymous peer benchmarks, leaks report | `/goals/*`, `/benchmarks/`, `/reports/leaks/` |
| `backend/ai` | app | chat (reply + OpenUI Lang `ui`), voice, drafts, saved tools | `/ai/*`, `/tools/*` |
| `backend/integrations` | new app | `Connection` (encrypted creds), provider adapters (google_sheets, payme, click, uzum_market, moysklad, billz, didox, faktura), `SyncRun`, idempotent upsert by `external_id` | `/integrations/*` |
| `backend/imports` | new app | file parsers (csv, xlsx, 1c_bank, commerceml, kapitalbank, tbc, uzum_business, hamkorbank), AI column mapping, preview/commit, exports (xlsx, csv, 1c_bank), OCR receipt/SMS → drafts | `/imports/*`, `/exports/transactions/`, `/ocr/` |
| `backend/notifications` | new app | Telegram bot webhook (text/voice/photo/forwarded SMS → draft + confirm buttons, invite deep links), daily brief, gap alerts, weekly CFO call (TTS voice), schedule runner (`manage.py run_notifications`) | `/telegram/webhook/`, `/notifications/*` |
| `backend/publicapi` | new app | personal tokens, Bearer auth, `/v1/*` read/write, webhook subscriptions + signed delivery (HMAC-SHA256) with retries | `/developer/*`, `/v1/*` |
| `backend/legal` | new app | consent versions + `ConsentRecord`, pricing access requests | `/legal/consent/`, `/pricing/access-request/` |
| `web/src/i18n`, `web/messages` | web | ru/uz/en dictionaries, `t()` hook, locale switcher, persists via `PATCH /me/` | — |
| `web` settings | web | settings: profile/locale, team, integrations, imports/exports, notifications, developer; goals/benchmarks/leaks widgets; login page (Telegram widget, Google) | — |
| `web` chat/OpenUI | web | OpenUI renderer on pastel components, chat `ui` rendering, pin/saved tools on dashboard | — |
| `web` landing | web | moonin-style landing + pricing (owned by landing worker, not in this table) | — |

Cross-module calls go through the target app's `services.py` only (never its models from another app's views):

- `transactions.created` → `publicapi.services.emit("transaction.created", tx)` and `growth.services.on_transaction(tx)`; finance calls both after commit (`transaction.on_commit`).
- Gap detection (`finance.domain.forecast`) → `notifications.services.gap_alert(business, gap)` and `publicapi.services.emit("gap.detected", …)`.
- Google OAuth `purpose=sheets` callback (accounts) → `integrations.services.create_google_connection(business, tokens)`.
- Bot drafts/photos → `imports.services.ocr(...)` and `ai.voice` / `ai.draft`.
- Invite deep link `start=join_<token>` (notifications) → `accounts.services.accept_invite(user, token)`.

## Implementation slices (parallel workers)

Paths are disjoint. A worker edits only its paths; anything else is requested from its owner. **Core** (Main) lands first and freezes shared files before workers start.

| # | Slice | Owns (exclusive paths) | Endpoints / deliverable | Depends on |
|---|---|---|---|---|
| 0 | Core (Main) | `backend/config/**`, `backend/finance/models.py`, `backend/finance/migrations/**`, `backend/pyproject.toml`, `backend/uv.lock`, `compose.yaml`, `deploy/**`, `.env.example`, `web/src/lib/api.ts`, `web/src/lib/types.ts`, `web/package.json`, `web/bun.lock`, `docs/openapi.yaml` | app registration + url includes for all new apps, `Transaction.source` new values, deps (cryptography, openpyxl, httpx), env wiring, TS types from spec | — |
| 1 | Integrations | `backend/integrations/**` | `/integrations/*`, adapters for 8 kinds, `create_google_connection` | 0 |
| 2 | Imports / exports / OCR | `backend/imports/**` | `/imports/*`, `/exports/transactions/`, `/ocr/` | 0 |
| 3 | Telegram bot + notifications | `backend/notifications/**`, `backend/finance/management/commands/run_notifications.py` | `/telegram/webhook/`, `/notifications/*`, brief/alerts/CFO call | 0; calls 2, 4 services |
| 4 | Accounts, team, goals, benchmarks, seasonality | `backend/accounts/**`, `backend/growth/**`, `backend/insights/**`, `backend/finance/domain/**`, `backend/finance/services.py`, `backend/finance/views.py`, `backend/finance/urls.py`, `backend/finance/tests.py`, `backend/finance/seed.py`, `backend/finance/management/commands/seed.py` | `/auth/telegram/widget/`, `/auth/google/*`, `/me/` PATCH, `/business/`, `/team/*`, `/goals/*`, `/benchmarks/`, `/reports/leaks/`, forecast `seasonality`/`event`, per-segment seed | 0; calls 1 |
| 5 | Public API + webhooks | `backend/publicapi/**` | `/developer/*`, `/v1/*`, signed webhook delivery | 0 |
| 6 | Web i18n | `web/src/i18n/**`, `web/messages/**`, `web/src/components/providers/locale-provider.tsx` | dictionaries ru/uz/en, `useT()`, switcher component | 0 |
| 7 | Web settings, integrations, team, goals, login | `web/src/app/(app)/app/settings/**`, `web/src/app/(app)/app/join/**`, `web/src/app/login/**`, `web/src/components/settings/**`, `web/src/components/growth/**`, `web/src/components/auth/**` | all settings screens, import wizard (upload → mapping preview → commit), exports, goals/benchmarks/leaks widgets, Telegram widget + Google login | 0, 6 |
| 8 | OpenUI chat + saved tools | `backend/ai/**`, `backend/evals/**`, `web/src/components/chat/**`, `web/src/components/ai-chat/**`, `web/src/components/openui/**`, `web/src/components/tools/**`, `web/src/lib/use-chat.ts`, `web/src/lib/voice.ts` | `AiReply.ui` generation + eval, `/tools/*`, OpenUI renderer on pastel set, pin to dashboard (exposes `<PinnedTools/>` for dashboard owner) | 0, 6 |
| 9 | Legal | `backend/legal/**`, `docs/legal/**`, `web/src/app/legal/**`, `web/src/components/legal/**` | RU/UZ/EN privacy + terms, consent screen, `/legal/consent/`, `/pricing/access-request/`, ZRU-547 residency flag | 0, 6 |

Not in any slice (stay with current owners): `web/src/app/(landing)/**`, `web/src/components/landing/**` (landing worker), `web/src/components/app/**`, `web/src/app/(app)/app/{page.tsx,layout.tsx,operations,products,calendar}`, `web/src/components/{pulse,operations,products,calendar,shared,ui,brand}/**` (app UI owner; mounts widgets exported by slices 7–9).

## Environment variables

Existing: `DEBUG`, `DJANGO_SECRET_KEY`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `DATABASE_URL`, `DEMO_LOGIN`, `TELEGRAM_BOT_TOKEN`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_CLASSIFY_MODEL`, `LLM_FALLBACK_MODEL`, `STT_MODEL`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`, `AI_CHAT_PER_MINUTE`, `AI_VOICE_PER_MINUTE`; web: `API_URL`.

New:

| Variable | Used by | Notes |
|---|---|---|
| `PUBLIC_BASE_URL` | accounts, notifications, publicapi | `https://oydin.sayfi.uz`; OAuth redirect and invite links |
| `TELEGRAM_BOT_USERNAME` | accounts, notifications, web | Login Widget + `t.me` deep links (web: `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`) |
| `TELEGRAM_WEBHOOK_SECRET` | notifications | compared to `X-Telegram-Bot-Api-Secret-Token`; set via `setWebhook secret_token` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | accounts | redirect `${PUBLIC_BASE_URL}/api/auth/google/callback/` |
| `INTEGRATIONS_FERNET_KEY` | integrations, accounts, publicapi | Fernet key (comma-separated list allows rotation via MultiFernet) |
| `TTS_MODEL` | notifications | weekly CFO call voice |
| `OCR_MODEL` | imports | vision model for receipts (OpenRouter) |
| `IMPORT_MAX_MB` | imports | default 10 |
| `PUBLIC_API_PER_MINUTE` | publicapi | per-token rate limit, default 60 |
| `WEBHOOK_TIMEOUT_SECONDS` | publicapi | default 5 |
| `LEGAL_VERSION` | legal | current consent version, e.g. `2026-11-18` |
| `ACCESS_REQUEST_NOTIFY_CHAT_ID` | legal | Telegram chat that receives pricing access requests |
