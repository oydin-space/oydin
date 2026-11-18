# Oydin iteration log

Running log of iterations, bug fixes, new features and research. Newest at the bottom. Each iteration: scope → changes → gates → deploy → Fable UI/UX review (code + screenshots) → panel scores → fixes carried over.

## Iteration 0 — foundation (2026-11-18)
- **Features**: Django backend (pulse, forecast, insights, chat, voice drafts), Next web app, landing, brand art. Commits `2a4aa08`, `0bdfe99`, `9d6c552`, `ecae444`.
- **Deploy**: https://oydin.sayfi.uz live (caddy, postgres 17, api, web); bot `@oydin_agent` menu button set. Health 200, demo login 200.
- **Research**: `docs/research/market.md` (competitors, UZ SME stats, tax facts, ZRU-547), `docs/research/integrations.md` (1C, Payme, Click, Uzum, Moysklad, Billz, Didox, Faktura, Google, Telegram, TTS), `docs/research/openui.md`.
- **Known issues**: UI elements hardcoded and not unified across screens (owner feedback); crayon icons have boxy backgrounds on dark cards; several tax rates single-source; bank statement formats unverified.
- **Decisions**: `docs/decisions.md`.

## Iteration 1 — tenancy, auth, UI kit (2026-11-19, in progress)
- **Research**: `docs/research/{tax-fit,custdev,verifiable-integrations,ux-patterns}.md`; competitor feature fit in `docs/research/competitor-features.md`.
- **AI QA**: 40-case golden set over 5 models, see `docs/ai-quality.md`. Commit `1d360f5`.
- **Decisions**: tax scope reduced to a reserve envelope plus confirmed reminders; unverifiable integrations shown as "coming soon"; streaks removed; benchmarks and voice CFO call deferred; daily cash close and owner draws added.
- **Scope**: membership tenancy, email one-time-code and Google sign-in, Django admin, USD accounts with CBU rates, contract v0.3, unified UI kit.

## Iteration 1c — mobile UX wave + second security layer (2026-11-18)
- Mobile (375) UX review: 6 majors, 12 minors. Fixed: wrapping page header and banners, list rows on narrow screens, 44px tap targets (segmented control, switch, prompt bar), tools template preview, settings import/integrations layout, Uzbek typography (ʻ/ʼ) in app strings.
- Server texts (gap reason, pulse, insights, template tools) follow the request language (RU/UZ/EN).
- Second security review (gpt-6-astra) on the previous fix wave, 6 majors fixed: seller-safe transfer merge, same-currency merge, `/sync/` user check, atomic chat-bound Telegram link codes, usable-user gate for bot commands and jobs, offline flush invalidation on session change, atomic tool cap.
- Gates: backend 417 tests, tsc, eslint, 45 web tests, next build.
- Open: Uzbek typographic apostrophes in landing copy and legal text keep U+2018/U+2019; desktop (1280) review in progress.

## Iteration 3 — cash-gap focus, oydin.space (2026-11-18)
- **Scope**: product refocused on cash gaps. Home answers «Сколько я могу забрать или потратить сегодня, чтобы в пятницу хватило на зарплату и аренду?» via `GET /api/planning/today/` (can_take, gap date and amount, breakdown of obligations, order payments, 30-day averages, tax reserve). Commits `850b12b`, `5f1f53a`, `ef30bfa`.
- **Demo**: Print Lab Tashkent — salary 15M + advance 3M + rent 6M on Friday, B2B order remainder 8M due five days later → Friday shortfall 3M (synthetic seed).
- **HR**: reduced to salaries and advances (UI only; people backend, locations and staff insights kept server-side).
- **Docs**: `docs/product.md` rewritten, `docs/scenarios.md` (10 business scenarios, what is and is not modelled), OpenAPI covers today/people/modules/rollup/beginner.
- **Infra**: domain oydin.space with oydin.sayfi.uz 301; Vault restart-loop on mlock fixed with memlock ulimit (`86d9b60`); prod was briefly 502 during the vault failure, restored on previous images.
- **Gates**: backend tests OK (clean worktree), migrations clean, tsc, eslint, 45 web tests, build.
