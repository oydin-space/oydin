# Oydin architecture (v0.3 scope)

Scope source: `docs/decisions.md` (Rounds 1–3). HTTP contract: `docs/openapi.yaml` (v0.3.0) is the single source of truth. Change the spec first, then the code. Every operation carries `x-roles`, and views must enforce exactly that list.

## Conventions

- Django, one app per bounded context. Function views return `JsonResponse` via `accounts.http.api_view`. Errors are `{"error": "..."}`. Dates are ISO.
- Money is an integer in the account currency's minor unit (UZS so'm, USD cents). Totals (pulse, forecast, reports, afford, impact) are UZS at the latest `finance.ExchangeRate`. Never use floats for money; rates are `Decimal`.
- Tenancy: every business-scoped query filters by `request.business` (the active business from `Profile.business`, validated against `accounts.Membership`). Role check: `accounts.permissions.require_role(request, *roles)` → 403 `forbidden`. Seller row filtering (`created_by = request.user`) lives in the finance services, not the views.
- Each app exposes `urls.py` / `urlpatterns`. The orchestrator wires them in `config/urls.py`. Business logic lives in `services.py` / `domain/`, and views stay thin.
- Web calls the backend only through `api()` in `web/src/lib/api.ts`. Response types live in `web/src/lib/types.ts`.
- Secrets at rest (Google refresh tokens) are Fernet-encrypted with `INTEGRATIONS_FERNET_KEY`. API tokens are stored as SHA-256 hashes; webhook secrets are encrypted. Both are shown once. Share-link tokens are stored hashed.
- Locale fallback order: `Me.locale` → `Business.locale` → `ru`.
- Offline: mutating PWA writes carry `Idempotency-Key` / `client_id`. The queue flushes through `POST /sync/`.

## Module map

| Module | Kind | Responsibility | Endpoints |
|---|---|---|---|
| `backend/config` | core | settings, root urls, scheduler wiring | `/health/` |
| `backend/accounts` | app | users, `Business`, `Membership`, roles, email-code / Telegram / Google / demo auth, active business switch, invite claim on first login | `/auth/*`, `/businesses/*`, `/onboarding/` |
| `backend/finance` | app | accounts (UZS/USD), operations (`kind` regular/owner_draw/owner_contribution, `purpose`), obligations, envelopes, forecast (seasonality from own history), `ExchangeRate` + CBU fetch, products, orders, offline sync | `/accounts/`, `/operations/*`, `/sync/`, `/obligations/`, `/envelopes/`, `/forecast/`, `/rates/`, `/products/`, `/orders/` |
| `backend/insights` | app | pulse, insights, analytics, period result, leaks | `/dashboard/pulse/`, `/insights/`, `/analytics/summary/`, `/reports/*` |
| `backend/planning` | new app (replaces `growth`) | afford check, daily cash close, tax reserve + confirmed reminders, goals (no streaks), benchmarks stub | `/decisions/afford/`, `/cash-close/*`, `/tax/*`, `/goals/*`, `/benchmarks/` |
| `backend/ai` | app (AI agent) | chat (+ OpenUI `ui`), voice, drafts, saved tools | `/ai/*`, `/tools/*` |
| `backend/integrations` | app | integration catalogue (working vs coming_soon), Google Sheets `Connection` + `SyncRun` | `/integrations/*` |
| `backend/imports` | app | csv/xlsx/1C/CommerceML parsers, AI column mapping, preview/commit, exports, OCR | `/imports/*`, `/exports/transactions/`, `/ocr/` |
| `backend/notifications` | app | Telegram bot webhook, daily brief, gap alerts, tax reminders, weekly TEXT digest, `run_notifications` | `/telegram/webhook/`, `/notifications/*`, `/digest/weekly/` |
| `backend/publicapi` | app | API tokens, Bearer auth, `/v1/*`, signed webhooks | `/developer/*`, `/v1/*` |
| `backend/sharing` | new app | accountant share links, public report JSON + PDF, partner cabinet, partner consents, impact counters | `/share-links/*`, `/shared/*`, `/partner/*`, `/consents/partner/*`, `/impact/` |
| `backend/legal` | app | consent versions, access requests | `/legal/consent/`, `/pricing/access-request/` |

Cross-module calls go only through the target app's `services.py`:

- Operation created → `publicapi.services.emit("transaction.created", op)`, run after `transaction.on_commit`.
- Gap detection (`finance.domain.forecast`) → `notifications.services.gap_alert(...)` and `publicapi.services.emit("gap.detected", …)`.
- `safe_to_spend` (insights) subtracts `planning.services.tax_reserve_amount(business)`.
- Pulse `unexplained_difference` comes from `planning.services.latest_cash_difference(business)`.
- Tax reminders with an amount → `finance.services.upsert_obligation(kind="tax")`.
- Weekly digest / period result → `insights.services.period_result(business, from, to)`.
- Google OAuth `purpose=sheets` (accounts) → `integrations.services.create_google_connection(...)`.

## Implementation slices (v0.3 fan-out)

Paths are disjoint. A worker edits only its own paths and asks the owner for anything else. **CoreTenancy** has already landed `accounts/**`, the finance models/migrations (Membership, currency, ExchangeRate, operation kind, created_by, client_id) and auth endpoints. `backend/ai/**` and `backend/evals/**` belong to the AI agent.

**Orchestrator-only files** (Main edits these; slices ask): `backend/config/urls.py`, `backend/config/settings.py`, `backend/pyproject.toml`, `backend/uv.lock`, `web/src/lib/api.ts`, `web/src/lib/types.ts`, `web/package.json`, `web/bun.lock`, `docs/openapi.yaml`, `.env.example`, `compose.yaml`. Each backend slice exposes `<app>/urls.py` with `urlpatterns`, and Main wires it in. A slice that needs a new model field in another app asks that app's owner.

| # | Wave | Slice | Owns (exclusive paths) | Endpoints / deliverable |
|---|---|---|---|---|
| 1 | 1 | Imports / exports | `backend/imports/**` | `/imports/*` (csv, xlsx, 1c_bank, commerceml only), `/exports/transactions/`, `/ocr/` |
| 2 | 1 | Notifications + digest | `backend/notifications/**` | `/telegram/webhook/`, `/notifications/*`, `/digest/weekly/`, tax reminder sends; voice CFO call removed |
| 3 | 1 | Planning | `backend/planning/**`, `backend/growth/**` (delete after moving goals) | `/decisions/afford/`, `/cash-close/*`, `/tax/*`, `/goals/*`, `/benchmarks/` (coming_soon) |
| 4 | 1 | Public API + sync | `backend/publicapi/**`, `backend/finance/sync.py`, `backend/finance/tests_sync.py` | `/developer/*`, `/v1/*`, `/sync/`, Idempotency-Key helper |
| 5 | 1 | Sharing / partners / impact | `backend/sharing/**`, `backend/legal/**`, `backend/integrations/**` | share links + PDF, `/partner/*`, `/consents/partner/*`, `/impact/`, integration catalogue |
| 6 | 1 | Web i18n | `web/src/i18n/**`, `web/messages/**`, `web/src/components/providers/locale-provider.tsx` | ru/uz/en for all new screens |
| 7 | 1 | Web auth / onboarding / tenancy / settings | `web/src/app/login/**`, `web/src/app/(app)/app/onboarding/**`, `web/src/app/(app)/app/settings/**`, `web/src/components/{auth,settings,tenancy}/**` | email + Google + Telegram login, onboarding stepper, business switcher, team, integrations catalogue, tax reserve, share links, developer |
| 8 | 1 | Web OpenUI chat + saved tools | `web/src/components/{chat,ai-chat,openui,tools}/**` | `AiReply.ui` rendering, pin to dashboard |
| 9 | 2 | Web screens on UI kit | `web/src/components/{pulse,operations,products,calendar,app}/**`, `web/src/app/(app)/app/{page.tsx,layout.tsx,operations,products,calendar,cash-close,reports}/**` | pulse (UZS, rates stale), operations (kind, currency, seller view), cash close, period result, afford sheet; starts after UIKit lands |
| 10 | 2 | CI + auto-deploy | `.github/**`, `deploy/**` | backend tests, web lint/tsc/build, spec validation, deploy to oydin.sayfi.uz with a health check |

Wave 1 runs slices 1–8 (8 parallel). Wave 2 runs slices 9–10 after wave 1 merges. Not in any slice: `web/src/app/(landing)/**`, `web/src/components/landing/**` (landing owner), and `web/src/components/{ui,shared,brand}/**` (UIKit).

## Environment variables

Existing: `DEBUG`, `DJANGO_SECRET_KEY`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `DATABASE_URL`, `DEMO_LOGIN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `PUBLIC_BASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `INTEGRATIONS_FERNET_KEY`, `LLM_*`, `STT_MODEL`, `OCR_MODEL`, `LANGFUSE_*`, `AI_CHAT_PER_MINUTE`, `AI_VOICE_PER_MINUTE`, `IMPORT_MAX_MB`, `PUBLIC_API_PER_MINUTE`, `WEBHOOK_TIMEOUT_SECONDS`, `LEGAL_VERSION`, `ACCESS_REQUEST_NOTIFY_CHAT_ID`; web: `API_URL`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`.

Removed: `TTS_MODEL` (voice CFO call is coming_soon).

New:

| Variable | Used by | Notes |
|---|---|---|
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL` | accounts | email-code login; `/auth/providers/` reports `email:false` and request returns 503 `email_not_configured` when unset |
| `EMAIL_CODE_TTL_SECONDS` | accounts | default 600 |
| `CBU_RATES_URL` | finance | default `https://cbu.uz/ru/arkhiv-kursov-valyut/json/USD/{date}/` |
| `SHARE_LINK_MAX_DAYS` | sharing | default 180 |
