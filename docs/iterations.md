# Oydin iteration log

Running log of iterations, bug fixes, new features and research. Newest at the bottom. Each iteration: scope → changes → gates → deploy → Fable UI/UX review (code + screenshots) → panel scores → fixes carried over.

## Iteration 0 — foundation (2026-11-18)
- **Features**: Django backend (pulse, forecast, insights, chat, voice drafts), Next web app, landing, brand art. Commits `2a4aa08`, `0bdfe99`, `9d6c552`, `ecae444`.
- **Deploy**: https://oydin.sayfi.uz live (caddy, postgres 17, api, web); bot `@oydin_agent` menu button set. Health 200, demo login 200.
- **Research**: `docs/research/market.md` (competitors, UZ SME stats, tax facts, ZRU-547), `docs/research/integrations.md` (1C, Payme, Click, Uzum, Moysklad, Billz, Didox, Faktura, Google, Telegram, TTS), `docs/research/openui.md`.
- **Known issues**: UI elements hardcoded and not unified across screens (owner feedback); crayon icons have boxy backgrounds on dark cards; several tax rates single-source; bank statement formats unverified.
- **Decisions**: `docs/decisions.md`.
