# Product decisions (owner answers, 2026-11-18)

Source of truth for scope. Production-ready quality: everything works end to end, no artifacts, no stubs.

- **Server**: deploy user `oydin` on 2.29.194.215, domain oydin.sayfi.uz.
- **Segments**: textile print shops / small production (demo hero: Qani-style textile print shop), small retail, cafés/HoReCa, Uzum/Instagram sellers, services (salons, clinics, education). Onboarding asks the segment; seed/demo per segment.
- **Languages**: Russian, Uzbek (latin), English with a switcher (UI, AI replies, landing, legal docs).
- **Business model**: freemium (free pulse; paid ~99–199k UZS/mo for forecast, integrations, team) + B2B2C via banks/MFOs (cash-gap credit referral). Pricing page + "request access" only; no real charging.
- **Integrations (import/export)**: Excel/CSV with AI column mapping + XLSX/CSV export; Google Sheets via full Google OAuth (import + live export); 1C (1CClientBankExchange import/export + CommerceML); bank statements (Kapitalbank, TBC, Uzum Business, Hamkorbank) file parsers; Payme/Click merchant sync (user-entered creds); Uzum Market seller API; Moysklad and Billz APIs (user tokens); Didox / Faktura.uz e-invoices; public REST API with personal tokens + webhooks (OpenAPI documented); forward bank SMS / receipt photo to the bot → transaction (OCR).
- **OpenUI** (openui.com generative UI): AI chat answers and other surfaces render OpenUI components (charts, tables, scenario sliders, plan cards) using our pastel component set.
- **Calculators & planning**: NOT fixed tools. The AI builds custom calculators/planners on request via OpenUI (what-if cash gap, unit cost/pricing, break-even, payroll with taxes, loan/installment, tax regime + calendar, envelope budget plan-vs-fact, receivables aging). Users can pin generated tools to the dashboard and reuse them.
- **Ideas in scope**: Telegram daily 9:00 brief + gap alerts; voice for everything (income, expense, debts, promises); personal vs business money split (non-target leaks report); anonymous peer benchmarks; team roles (owner, accountant, seller); weekly 2-min "CFO call" voice summary in Telegram (TTS); goals & streaks (safety cushion); seasonality forecast from local stats (holidays, Navruz, school season).
- **Login**: Telegram Mini App initData, Telegram Login Widget on web (owner runs BotFather `/setdomain` → oydin.sayfi.uz), full Google OAuth, public demo. Guides in `docs/guides/`.
- **Legal**: RU/UZ/EN privacy policy + terms + consent screen; flag ZRU-547 data-residency risk (server location not confirmed in UZ). Reviewed by reviewer-astra.
- **Landing**: moonin structure, layout, CSS, motion and iPhone mockup 1:1; moonin's own images/logos/licensed fonts replaced with Oydin art.
- **LLM**: best by eval quality/latency on OpenRouter, cheaper model for classification; test spend cap ~$30.
- **Machine cleanup allowed**: caches, unused docker images and volumes, docker restart.
- **GitHub**: CI (tests, lint, typecheck, image build) + auto-deploy to server on push to main (SSH deploy key in repo secrets).

## Round 2 answers (2026-11-18)
- **Yes**: USD + UZS accounts with CBU rate; "Can I afford it?" decision button; 60-second onboarding (statement or 3 voice notes → first pulse); read-only accountant report link/PDF; tax deadline reminders in the bot (subject to the tax-fit research below); bank/MFO partner cabinet with consented anonymised leads; offline quick entry in the PWA; public /impact page; pitch kit (deck, demo script, 2-min HyperFrames video).
- **Tenancy**: every business is an organization (tenant); one user can belong to several organizations with a role in each; switcher in the UI. Refine project structure around this.
- **No**: Uzbek Cyrillic.
- **Untested integrations**: ship only what can be verified; the rest is listed as "coming soon" (no beta code paths presented as working).
- **Taxes**: open — research product fit, customer coverage and custdev before deciding how much tax functionality to keep. Outcome recorded in the product changelog.
- **Data residency**: keep the current server; not a concern for now.
- **UI**: standardized atomic components reused everywhere (personal library at ~/Projects/components + shadcn), no hardcoded one-off elements; real company logos and coloured icons for integrations; hover/motion where useful; fix or drop custom block icons (no boxed backgrounds); unified "brushed" look. Fable + Astra review.
- **Product work**: research cases, sources, custdev; prune functionality where research says so; keep a gitignored product changelog (`temp/product-changelog.md`) of what was removed/added and why.
- **Process**: after each deploy a Fable 5.2 UI/UX review (code + screenshots); CodeGraph for token economy; 10+ product iterations; log in `docs/iterations.md`.

## Round 3 / research outcomes (2026-11-18)

Sources: `docs/research/custdev.md`, `docs/research/tax-fit.md`, `docs/research/verifiable-integrations.md`, `docs/research/ux-patterns.md`. Contract: `docs/openapi.yaml` v0.3.0 (its changelog lists every removed or renamed item).

- **Tenancy:** the tenant is `accounts.Business`. One user can belong to many businesses through `Membership(user, business, role owner|accountant|seller, invited_email)`, and `Profile.business` is the active business. Invites go by email and are claimed on first login. The last owner cannot be removed or demoted. Login methods: email code, Google (only when env is configured), Telegram, and demo.
- **Roles:** owner can do everything. Accountant can read everything and write operations/obligations; no team, settings, integrations or API tokens. Seller can create operations/drafts and sees only own entries; no balances or forecast. Every operation is tagged with `x-roles`.
- **Currency:** accounts are UZS or USD, and amounts are integers in minor units. A CBU daily rate is stored in `ExchangeRate`. All totals are reported in UZS at the latest rate, and `/rates/` exposes the `stale` flag.
- **Tax (final, option B):** an optional tax-reserve envelope with either a fixed amount or a percent the user enters (no presets), plus deadline reminders the user confirms. No regime calculators. Provenance and a "planning reserve — not tax due" disclaimer are always shown. `Business.tax_regime` is removed.
- **Integrations (final):**
  - Working: CBU rates, CSV/XLSX import/export, 1CClientBankExchange + CommerceML import, Telegram bot, public REST API + webhooks, Google sign-in/Sheets (when env is set).
  - `coming_soon` catalogue entries with no backend code: Payme, Click, Uzum Market, Moysklad, Billz, Didox, Faktura, bank presets (Kapitalbank, TBC, Uzum Business, Hamkorbank), voice CFO call.
- **Pruned:**
  - Streaks are removed.
  - Peer benchmarks are `coming_soon` until cohorts exist.
  - The weekly CFO voice call becomes a TEXT weekly digest in Telegram.
  - Seasonality comes only from the business's own history (the `event` field is dropped).
- **Added:** daily cash close (expected vs counted, unexplained difference shown in pulse); `owner_draw`/`owner_contribution` operation kinds; period result (profit vs cash change vs owner draws); "can I afford it?" check; guided onboarding (business → statement or 3 notes → first pulse); accountant read-only share links (+PDF); partner (bank/MFO) cabinet with anonymised, consented leads; public `/impact/`; offline sync with idempotency.
- **Renames:** `/me/` → `/auth/me/`; `/transactions/` → `/operations/`; `/team/*` → `/businesses/{id}/members/*`. The public `/v1/transactions/` and the `transaction.created` webhook stay stable.

## Owner single screen (decided after mentor feedback)
Positioning: «Один экран для владельца» for young digital owners. The pitch line: "an accounting system covers one area; Oydin is the owner's single picture: money, people, debts and suppliers, set up for your business."

**Navigation:** 3 tabs (Oydin chat home / Пульс / Профиль). Everything else lives under Профиль → «Ещё».

**Businesses:** each business has its own view, plus one unified view across all of them.

**People:** one `people.Person` model with kind staff|contractor|buyer|partner and pay in UZS/USD/RUB/EUR, plus `Location` and monthly turnover. Seller is relabelled "employee (entry only)": it can enter data but cannot see totals.

**Owner money:**
- Owner withdrawals are shown apart from business money.
- Business money splits into keep-afloat / growth / owner's share.
- "Can I afford X?" is a local financing model.

**Staff:** no separate hire/cut screen. AI insights cover staff load, cost per person and hire/cut headroom, always showing the numbers behind them.

**Widgets:**
- System widgets are stored per tenant.
- The AI proposes changes from usage logs (develop, test, preview). The owner approves, and can roll back in settings.
- Widgets read and write data only through the API.
- No user-defined tables or fields, no visual workflow editor.

**Tools:** a curated catalogue of 6–8 local services described by what they do, each with a file-import fallback. MCP/API connections sit under «Для разработчиков».

**Credentials:** a self-hosted HashiCorp Vault (Transit) on the prod server.

**Other:** debts and supplier settlements are core. The beginner track (budget, regime, break-even, PDF, registration) is built last.

**Build order:**
1. People + entry role
2. Owner money split + afford
3. Staff insights + unified view
4. Locations
5. Module presets + AI widgets
6. Catalogue + Vault
7. Beginner track

**Traction:** none yet; do not claim any.

## Cash-gap focus; HR trimmed to salaries/advances (UI hidden, backend kept)
**Decision:** the product answers one owner question: «How much can I take or spend today so that salary and rent are covered on Friday?». The main screen shows the amount that can be taken, the date and size of the first cash gap, and the list of payments behind the calculation (`GET /api/planning/today/`).

**Why:** cash gaps are the top interview problem; a single worked answer is easier to trust and demo than a broad set of screens.

**Inputs:** only obligations, unpaid order remainders, 30-day confirmed averages and the tax reserve. Advances are salary-kind obligations; no new model field. No figure is invented: everything is user data or labelled demo data.

**HR:** only salaries and advances stay in the UI because they affect the forecast. Other HR surfaces are hidden in the UI; backend code is kept, so this is reversible.

**Not modelled yet:** inventory by size, per-payment FX, per-project accounting, yield scenarios. See `docs/scenarios.md`.
