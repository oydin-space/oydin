I've already read `docs/decisions.md`, so I'm not repeating that. The research is complete enough to deliver. **I could not write `local://research-market.md`** because I have no write tool. The full file content is below for you to save.

# Oydin market research (web only, no repo changes)

## 1. Competitor table

| Vendor | Segment / focus | Cash-flow forecast | AI | Telegram | Pricing (vendor currency) | UZ localization | Source |
|---|---|---|---|---|---|---|---|
| Planfact | RU SMB finance (ДДС, P&L) | Yes, "Прогноз кассовых разрывов" on all tiers | Not on pricing page | Not on pricing page | 24-mo rates: Начальный 2 050 ₽, Основной 4 484 ₽, Расширенный 8 055 ₽, Полный 11 933 ₽/mo; 7-day trial | No UZ localization seen; 1С only on higher tiers/add-on | planfact.io/price (primary, fetched) |
| Finolog | RU SMB accounting/finance | Not confirmed on pricing page | Not confirmed | Not confirmed | 1 мес 3 990 ₽; 3 мес 2 997 ₽/mo; 12 мес 2 499 ₽/mo; 14-day trial; free tier | No UZ localization seen | finolog.ru/prices-old (primary, fetched) |
| Adesk | RU SMB finance/CRM | Cash-gap forecast only on higher tiers | "ИИ для подбора статей" on Первый and up; "Автоматизация и AI" on Эконом | Not confirmed | Эконом 2 490 ₽, Бизнес 5 590 ₽, Первый 7 490 ₽/mo (annual billing) | Russian only; RUB billing; no UZ localization found | adesk.ru/pricing (primary, fetched) |
| Moysklad (МойСклад) | Retail/warehouse ERP, UZ-localized site | Finance module is a paid add-on | Not confirmed | Not confirmed | Старт 69 300 сум (annual only); Базовый 156 800 (annual) / 196 000 (monthly); Проф 459 200 / 574 000; Корп 1 097 600 / 1 372 000. Add-ons: user 98 000/mo, finance 196 000/mo | Yes (moysklad.uz, UZS) | moysklad.uz/subscription (primary, fetched). A 1 July 2026 price change was announced; current prices not verified |
| Billz | UZ retail POS/ERP | Not confirmed | Not confirmed | Bot exists (`billzsales_bot`) | Start 299 000 UZS/mo per sales point (extra point 179 000) | Yes | billz.io (primary); price from BuySale survey (secondary) |
| Smartup | UZ SFA/CPG ERP | Not confirmed | Not confirmed | Not confirmed | No public price; "request demo" | Yes | smartup24.com (primary); market-leader claim is vendor self-claim |
| 1С (UZ partners) | Enterprise accounting | Not verified | Not verified | Not verified | Not verified | Presence in UZ not verified in this pass | Not verified |
| Uzum Business (Kapitalbank) | Bank business app | No cash-flow forecasting confirmed | Not confirmed | Not confirmed | Not published in sources | Yes (UZ bank app) | Google Play: 100K+ installs, ~4.6★; kapitalbank.uz features: accounts, payments, payroll, currency, loans, cards, remote onboarding |
| Kapitalbank SME | Bank SME financing/deposits | Not confirmed | Not confirmed | Not confirmed | n/a | Yes | kapitalbank.uz (primary) |

Notes:
- RUB prices are not converted to UZS: no sourced FX rate was used.
- BuySale survey (buysale.uz, 2026-09-18) is secondary. It is published by a competitor of Billz and Moysklad. It covers 24 POS systems, with a median of 134 700 UZS/mo across 11 published prices (range 69 000–299 000).

## 2. UZ SMB market stats

- Active SME entities: about 1.21 million as of 1 Oct 2025 (1 212.0k operating; small enterprises and microfirms 479.0k). Source: stat.uz PDF (primary, snippet read).
- SME share of GDP: 54.3% (2024), 51.5% (Jan–Sep 2025). Sources: stat.uz/AJEBM citing; globalresearchnetwork.us (secondary).
- ADB (adb.org): MSMEs are 54.3% of GDP, 90% of businesses, 74% of employment; the sector is "underfinanced". (primary, from snippet)
- World Bank (P511700): heavy reliance on cash and limited digital payments. (primary, from snippet)

## 3. Tax facts for calculators (2026)

**Verified against official or practitioner text**
- Turnover tax (special regime, Tax Code art. 18/461): base rate 4%. Retail: 4% in cities of 100k+, 2% elsewhere, 1% in remote/mountain areas. Tobacco retail 4%. Individual entrepreneurs and self-employed: 1%. Source: tax-legal.uz/en/turnover-tax (practitioner; cites lex.uz art. 467).
- Turnover tax reporting: monthly, due the 15th of the next month; annual due 15 February. Source: tax-legal.uz; Centa AI calendar (lex.uz-based, edition 21 Oct 2026).
- Threshold: UP-100 (26.05.2026, in force 1 June 2026) sets 12 000 BRV. Official gov.uz press release (27.05.2026). BRV is 412 000 UZS until 31 Aug 2026 (4.944 bn), 440 000 from 1 Sep 2026 (5.28 bn). Pactum notes that the Tax Code text still says 1 bn UZS as of Nov 2026; treat as divergence until resolved.
- Importers: UP-100 removes automatic VAT status for importers (gov.uz). Code art. 461 part 2 still lists importers as excluded from turnover tax. Divergence, unresolved.
- Simplified VAT at 6% (UP-100, 1 June 2026 – 1 Jan 2030): optional for trade, catering and services; not for large taxpayers or state-majority companies. Source: gov.uz/ru/soliq/news/view/196345 (official).
- General VAT 12%; monthly, due the 20th of the next month. Source: legal-force.uz (practitioner); Centa calendar for due date.
- Corporate income tax 15% standard, 20% for banks and certain others; monthly advances if prior-year income exceeds 20 bn UZS. Source: legal-force.uz (practitioner).
- Social tax 12% standard; monthly due 15th. Source: legal-force.uz (practitioner).
- PIT 12% residents; INPS 0.1% of employee income, credited against PIT. Source: legal-force.uz (practitioner). **INPS 0.1% is single-source. Mark as unverified until checked against lex.uz.**

**Unverified (do not use as fact in calculators)**
- Per-activity turnover rates beyond the table above.
- Simplified regime thresholds per activity beyond "trade/catering/services".
- 1 July 2026 Moysklad price change: current prices.

## 4. ZRU-547 localization (flag risk per decisions.md)

- Law ZRU-547 (2 July 2019) on personal data. Art. 27-1 is the localization clause. Source: lex.uz/docs/4396428 (primary; full article text not fetched in this pass).
- Amendment ZRU-1125 (26 March 2026) reportedly narrows mandatory in-country storage to: biometric data (including voice imprints used for identification), genetic data, and telecom subscriber data. Other personal data may be stored abroad if one of the art. 27-1 conditions is met: adequacy determination, standard contractual clauses, binding corporate rules, or international standards. Sources: zukko.ai/ru/blog/zru-547-lokalizaciya-personalnyh-dannyh (vendor blog, competitor to Oydin's category; cites gazeta.uz 27.03.2026 and lex.uz). **Verify ZRU-1125 text on lex.uz before relying on it.**
- Oydin implication: server location is unconfirmed (per decisions.md). Keep contacts and chat data behind a UZ-hosted or explicitly SCC-covered store. Voice recordings used for speaker identification would count as biometric and must stay in UZ. Call recordings for quality control, without identification, are normally ordinary personal data.

## 5. Gaps Oydin fills (candidate bullets)

- No competitor here combines: UZ tax logic (turnover 4/2/1%, 12 000 BRV threshold, 6% simplified VAT), UZS-native pricing, and Telegram or voice input. Planfact and Adesk are Russian-only, RUB-priced, and carry no UZ tax logic.
- Moysklad and Billz are inventory and POS first; their finance layers are add-ons at 196 000 UZS/mo or higher.
- Cash-gap forecasting exists in Planfact and Adesk but is locked to higher tiers and is RU-only. A UZS forecast on a lower tier is an open slot.
- Bank apps (Uzum Business, Kapitalbank) show balances and payments but no verified cash-flow forecasting.
- Data-residency concerns in ZRU-547 favor UZ-hosted storage as a selling point for SMBs and banks.

## Not verified

- Smartup pricing (no public price).
- 1С presence and partner landscape in UZ; Billz/Smartup 1С integration depth.
- Telegram and AI status for Finolog, Planfact, Adesk, Moysklad, Billz (not on pricing pages checked).
- Uzum Business feature depth and any forecasting.
- Current Moysklad prices after 1 July 2026 change.
- ZRU-1125 full text and art. 27-1 conditions (sourced from vendor blog and gazeta.uz snippet).
- INPS 0.1% and PIT/social rates (single practitioner source).
- VAT 12% and CIT 15/20% against lex.uz (practitioner sources only).
- RUB→UZS conversion (no FX rate sourced).
- Finolog consultant tier prices (conflicting: Забота 17 990 vs 14 990; Финдиректор 49 990 vs 44 990).
- Simplified regime thresholds per activity.
- Whether the Code's 1 bn vs UP-100's 12 000 BRV divergence has been resolved since Nov 2026.