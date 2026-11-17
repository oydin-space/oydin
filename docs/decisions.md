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
