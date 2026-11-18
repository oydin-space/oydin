# Product review: does Oydin deliver what owners dream of?

Review date 2026-11-18. Evidence base: [`business-dreams.md`](business-dreams.md) (dreams D1–D12, sources S1–S30). Product facts are taken from `docs/product.md`, `docs/decisions.md`, `docs/onboarding-plan.md`, `docs/research/custdev.md`, the app navigation and the billing seed migration.

**Everything in this document is a proposal for the product owner to accept or reject. Nothing here has been decided or implemented.** Impact and effort ratings are my estimates `[INFERENCE]`; nobody has sized the work.

## Top 10 recommendations

Ordered by impact relative to effort. Impact: H/M/L on the owner's dream. Effort: S (days, mostly copy or config), M (about a sprint), L (more than a sprint).

| # | Proposal | Dream | Impact | Effort | Why |
|---|---|---|---|---|---|
| 1 | Talk to 8–10 owners and test the price before fixing the tiers | all | H | S | Neither this research nor `custdev.md` contains a single owner interview, and no source says what an Uzbek micro-business will pay. 149 000 and 249 000 UZS are untested. |
| 2 | Give Free a 7-day cash-gap warning; keep the long forecast and "can I afford it" for Pro | D7 | H | S–M | The cash gap is the product's headline problem, and Free currently lists "Cash-gap forecast" as missing. A free user never sees the thing the product is for, so has no reason to upgrade. |
| 3 | Make "count the money today" (daily cash close) a first-class home action and the first thing a new user does | D4, D1 | H | S | Four independent sources converge on a daily expected-versus-counted check as the remedy owners trust. The feature exists; it needs prominence. `custdev.md` already recommends this. |
| 4 | Fix the pricing contradictions before launch (see section 3.1) | — | H | S | The landing FAQ promises "one flat price for the whole business, not per user" while the tiers gate team members. Plan limits do not appear to be enforced anywhere in the backend. |
| 5 | Close the loop with one number: after every confirmed entry, show the new "safe to spend" figure, then let the user leave | D7, D5 | H | S–M | Owners ask for one answer, not a dashboard. The entry should end with the answer so that quitting is the natural next step. |
| 6 | Make the 3-step fast path the default onboarding; move the rest into the in-app checklist | D5 | H | M | The onboarding plan itself says "Ten steps is a lot for a kiosk owner". Only 26% of surveyed owners are confident in Excel, so "upload your data" is a weak first-value step. |
| 7 | Add a "personal card" label and an explanation export for card-to-card transfers | D2, D3 | H (Uzbekistan) | M | The Tax Committee gives 10 days to explain personal-card inflows. Being able to say which transfers were sales, family or own money is a specific, local, current need. Needs legal review. |
| 8 | Package a "for the bank" 12-month report as the Pro upgrade trigger | D8 | M–H | S–M | Owners are refused loans for messy books, and the EBRD says SMEs do not speak the banks' language. The accountant PDF already exists. |
| 9 | Keep the tax reserve and deadline reminders in Free, and add "set aside X% of every income" | D2 | M | S | Tax fear is the most frequent pain in the research, level with D1. It builds trust, and peers already give this advice to each other. Do not calculate taxes. |
| 10 | Sell Team on per-seller cash close, not on "unlimited members" | D4 | M | M | The owner's question is "which shift is short", and the seller role and seller bot already exist. This is the reason to pay 249 000 UZS. |

Two things I recommend **not** doing: do not promise theft detection (the evidence supports a routine, not a detector), and do not lead with "AI" in tier names or feature lists (no source asks for it; owners ask for advice in plain words).

## 1. Dream → feature map

Status: **Exists** = described as built in the repo docs or visible in code; **Planned** = marked `coming_soon` or described only in a plan; **Missing** = not found. I did not run the app, so "Exists" means "documented as existing".

| Dream | What the owner wants | Oydin today | Status | Gap |
|---|---|---|---|---|
| D1 What did I actually earn | One honest profit figure, in plain words | Pulse phrase and cards (profit, owner take); insights with source, date and confidence; chat assistant | Exists | Profit sits among eight cards. Owners in S18 and S19 cannot read a P&L; a single sentence should come first. |
| D2 Tax is not a threat | Know what to set aside and when; be able to explain myself | Optional tax reserve envelope; deadline reminders | Exists (narrow) | No "set aside X% per income" rule. No help with P2P explanation letters (D3). Correctly does not compute taxes. |
| D3 Personal and business money apart | Clean separation; a fixed "salary" | Personal split on operations; `owner_draw` and `owner_contribution`; envelopes | Exists | No concept of "this business income arrived on my personal card". No export of that split. |
| D4 Nobody takes from the till | Daily proof that cash matches | Daily cash close (expected vs counted); cash-difference card; seller role sees only own entries | Exists | Not prominent: no dock entry, and not in the first-steps checklist. Not per seller or per shift `[INFERENCE: not verified in code]`. |
| D5 Out of my head | Record without effort | Voice and quick add with one-tap confirm; CSV/XLSX/1C import; offline sync; Telegram bot | Exists | The strongest part of the product. Risk: 30 AI questions a month on Free may throttle voice entry (section 3.3). |
| D6 Know the rules | Be told when something changes | Deadline reminders only | Missing | Out of scope by decision. I agree: it is a content business. A link-out is enough. |
| D7 Safe to spend today | One number: free money after commitments | Safe-to-spend card; gap callout; "can I afford it"; payment calendar; day-by-day forecast; runway | Exists | Free tier hides the forecast. The number is one card among several. |
| D8 Get a loan | Statements a bank accepts | Accountant read-only share links and PDF; partner (bank/MFO) cabinet | Exists (partly) | Not framed for the owner as "a report for the bank". No 12-month pack. |
| D9 Someone who advises | "Do this next", in plain words | Chat assistant; insights; weekly digest; 9:00 Telegram brief | Exists | Advice quality was not assessed here. Voice CFO call is `coming_soon`; `custdev.md` recommends deferring it, and I agree. |
| D10 Fair money in the family | See who took what | `owner_draw`; roles | Partly | No way to mark a payee as family or to see draws per person. Evidence is thin; do not build yet. |
| D11 A day off | Business runs without me | Telegram brief and gap alerts; seller entries | Partly | Mostly outside a money app's reach. The honest promise is "you can check in 10 seconds", not "you can leave". |
| D12 What really makes money | Margin per product and channel | Products and orders unit economics; Uzum Market integration `coming_soon` | Exists / Planned | Marketplace fees need the integration to be credible. |
| Payment rails (UZ) | All pockets in one place | Cash, card and account with transfers; Payme, Click, bank presets `coming_soon` | Exists / Planned | Until integrations ship, wallets are manual. The pricing page should not list integrations as a paid feature while they are `coming_soon` (section 3.1). |

**Summary.** The product already covers the three most frequent money dreams (D1, D5, D7) and has the right mechanism for D4. Coverage is not the weakness. The weaknesses are that the best mechanisms are buried, the free tier withholds the core promise, and the one sharply local pain (personal-card transfers and the tax letter) is not addressed.

## 2. The "open – speak – quit – glance" loop

The intended habit: open the app, say what happened, leave, and later glance at the state of the business.

| Step | Today | Assessment | Proposal |
|---|---|---|---|
| Open | PWA; mic is the centre dock button and goes to `/app/quick?voice=1` | Good. One tap from launch to speaking. | Keep. Consider letting the PWA shortcut open straight into voice. |
| Speak | Voice or text becomes a draft, confirmed in one tap | Good, and matches D5. | Make sure voice entry never counts against the AI question limit. Accept several entries in one utterance if it does not already `[not verified]`. |
| Quit | After confirm, the user is left in the quick-add flow `[INFERENCE: not run]` | This is where the loop is weakest. There is no payoff for speaking. | After confirm, show one line: the new safe-to-spend figure and whether a gap is ahead. Then nothing else to do. The answer is the reward. |
| Glance | Home pulse (phrase plus up to eight cards); 9:00 Telegram brief; gap alerts | Too much to glance at in the app; right channel in Telegram. | One sentence and one number above the fold; cards below. Treat the Telegram brief as the primary glance surface, since the onboarding plan already notes iOS push limits. |

Two additions to the loop, both proposals:

- **An evening prompt to count the till.** A Telegram message at closing time: "Count the cash. Expected: 1 240 000 UZS." The owner replies with a number. This puts D4 into the loop without opening the app.
- **No streaks or scores.** `custdev.md` already recommends deferring streaks. Owners in S24 describe shame about their books; a broken streak adds to it.

## 3. Pricing-tier packaging

Current seed (`backend/billing/migrations/0002_seed_plans.py`): Free 0, Pro 149 000 UZS a month (popular), Team 249 000 UZS a month.

### 3.1 Problems in the current packaging

1. **Free withholds the core promise.** Free's `missing` list starts with "Cash-gap forecast". The Pro tagline is "Forecast and AI to see cash gaps ahead of time". So the product's headline problem is solved only after payment, and a free user has no experience of it to judge by.
2. **The landing FAQ contradicts the tiers.** It says Oydin is free during the hackathon and afterwards will have "one flat price for the whole business, not per user". The tiers gate team members and have two paid prices.
3. **Limits are copy, not behaviour.** Outside `backend/billing` and the accounts admin, no backend code refers to the subscription or plan. "1 business", "30 AI questions per month" and "Owner only" do not appear to be enforced. Either enforce them or do not state them.
4. **Paid features that are not shipped.** "Bank and service integrations" is listed as a Pro highlight while Payme, Click, Uzum Market, Moysklad, Billz, Didox, Faktura and bank presets are `coming_soon`. Selling this is a trust risk in a market where trust in anything touching money is low (S7, S12).
5. **Team's value is stated as a quantity.** "Unlimited team members" and "Public API" do not answer an owner's question. Roles are listed as a Team feature, while the product docs describe accountant sharing as a core feature.
6. **"AI" as the unit of value.** "30 AI questions", "Unlimited AI questions", "Custom AI-built tools". No source in the research asks for AI.
7. **"Limited" on paid tiers.** "Up to 3 businesses" and "Up to 10 businesses" are generous allowances shown under a "Limited" heading. They read as restrictions on a plan the user is paying for.

### 3.2 Proposed packaging

The principle: Free solves "what is happening today" completely. Pro sells "what happens next and what should I do". Team sells "what are my people doing with the money".

| | Free — 0 | Pro — 149 000 UZS | Team — 249 000 UZS |
|---|---|---|---|
| For | One owner, one business, records by voice | An owner who plans, borrows or pays tax on time | An owner with sellers or an accountant |
| Core | Pulse; voice and text entry (unlimited); import; daily cash close; tax reserve and deadline reminders; Telegram brief | Everything in Free | Everything in Pro |
| Forecast | 7-day gap warning | Full day-by-day forecast, payment calendar, "can I afford it", seasonality | Same |
| Advice | 30 assistant questions a month | Unlimited assistant; weekly digest; debtor reminders | Same |
| Sharing | One read-only accountant link | "For the bank" 12-month report; accountant PDF | Sellers and accountant with roles; seller bot; per-seller cash close |
| Businesses | 1 | Up to 3 | Up to 10 |

Open questions for the product owner:

- Whether the accountant read-only link belongs in Free. I propose yes: it costs little, the accountant becomes a referral channel, and D9 shows owners already feel underserved by accountants.
- Whether integrations are listed at all until at least one is live. I propose listing them under a "coming" label on all tiers, without a tier promise.
- Whether "Public API" and custom AI-built tools appear on the pricing page. I propose moving both off the page; they matter to partners, not to a shop owner.

### 3.3 Proposed copy for Free: "what's missing" and "limited"

Write `missing` as outcomes the owner loses, not as feature names.

| | Current (en) | Proposed (en) | Proposed (ru) | Proposed (uz) |
|---|---|---|---|---|
| missing 1 | Cash-gap forecast | Forecast beyond 7 days | Прогноз дальше 7 дней | 7 kundan uzoq prognoz |
| missing 2 | Bank and service integrations | "Can I afford it?" check | Проверка «Могу ли я это позволить?» | «Bunga pulim yetadimi?» tekshiruvi |
| missing 3 | Team: accountant and sellers | Report for the bank | Отчёт для банка | Bank uchun hisobot |
| missing 4 | Unlimited AI assistant | Sellers and per-seller cash close | Продавцы и сверка кассы по каждому | Sotuvchilar va har biri boʻyicha kassa solishtiruvi |
| limits 1 | 1 business | 1 business | 1 бизнес | 1 ta biznes |
| limits 2 | 30 AI questions per month | 30 questions to the assistant a month (entries are unlimited) | 30 вопросов ассистенту в месяц (записи без ограничений) | Yordamchiga oyiga 30 ta savol (yozuvlar cheklanmagan) |
| limits 3 | Owner only | Gap warning 7 days ahead | Предупреждение о разрыве на 7 дней вперёд | Kassa uzilishi haqida 7 kun oldin ogohlantirish |
| limits 4 | — | One accountant link, read-only | Одна ссылка для бухгалтера, только просмотр | Buxgalter uchun bitta havola, faqat koʻrish |

The Uzbek strings are drafts and need a native-speaker check.

For Pro and Team, I propose renaming the allowance so it does not read as a restriction ("Up to 3 businesses" as a feature line), and leaving `limits` empty on Team.

### 3.4 Upgrade triggers

A trigger is a moment when the user has just felt the need. Show the offer there and nowhere else.

| From → to | Trigger moment | What to show |
|---|---|---|
| Free → Pro | The 7-day warning fires, or the forecast sees a gap on day 8 or later | "There is a gap on the 19th. See the full forecast." Show the date for free; charge for the detail. |
| Free → Pro | The user asks "can I afford…" in chat or taps the check | One free answer a month, then the offer |
| Free → Pro | The 30th assistant question | State the count from the 25th; never block a voice entry |
| Free → Pro | The user taps "report for the bank" or exports a PDF | Preview of the first page |
| Free → Pro | The user adds a second business | The allowance |
| Pro → Team | The owner invites a seller or a second accountant | The roles and what each sees |
| Pro → Team | Cash difference is non-zero on three closes in a fortnight | "See the close per seller." This is the strongest Team trigger. |
| Pro → Team | A second cash point is added | Per-point close |

Do not show upgrade prompts in the first session or on the home pulse. The first-session job is trust.

### 3.5 Price

- 149 000 UZS a month is within the 99 000–199 000 hypothesis noted in `custdev.md`, which that document marks as untested.
- I found no evidence on willingness to pay in Uzbekistan. Recommendation 1 exists for this reason.
- Proposal to test, not to adopt: an annual option, and a first paid month at a symbolic price, since Click checkout is already being built.

## 4. Onboarding

Source: `docs/onboarding-plan.md` (a design proposal with 10 steps; fast path of steps 1, 3 and 7 at about 1 min 45 s; full path about 6 min).

**What is right.** The targets (first pulse within 90 seconds at the median, 60% with own data in the first session, 70% with a delivery channel by day 1) measure the right things. The step-5 pain chips match the research closely: real earnings (D1), cash gaps (D7), tax set-aside (D2), notebook or head (D5), mixed money (D3), what is profitable (D12), fear of inspections (D2). The plan is honest about its own risks.

**Proposals.**

| # | Proposal | Reason |
|---|---|---|
| O1 | Make the fast path the only path before the first pulse. Language, name, business. Everything else moves to the in-app first-steps checklist. | The plan's own risk note. Six minutes before value is long for a seller standing at a counter. |
| O2 | Offer "say how much money you have right now" as the first-value step, ahead of file upload. | 30.8% keep books and 26% are confident in Excel (S25). Most new users have no file. Voice is the product's best feature and should be the first thing they touch. |
| O3 | Make the first action after the pulse "count the money today". | D4, and `custdev.md`'s existing recommendation. It produces a second real number in under a minute. |
| O4 | Do not make the tax identification number a required step. | Registry access is not secured (the plan says so), and S7 and S12 show owners are wary of anything that looks connected to the tax office. Ask later, with a stated reason. |
| O5 | Add a pain chip for staff and till ("I am not sure the cash adds up"), and one for credit ("I want a loan"). | D4 and D8 are in the research and not in the chip list. Chips should drive which card leads the pulse. |
| O6 | Ask for the Telegram connection right after the first pulse, as "get this every morning at 9:00". | It is the realistic glance channel, and the ask lands when the user has just seen what they would receive. |
| O7 | Say in the first screen what Oydin does not do: it does not send anything to the tax office or the bank. | The informal-economy context (S7, S10, S11). This must be true and must stay true; it needs the product owner's and legal confirmation before it is written. |

The current in-app first-steps checklist has four items: add an account, make an entry, import, connect Telegram. Under O3 it would gain "count today's cash".

## 5. Detail on selected recommendations

**Recommendation 7, personal-card transfers.** Scope as proposed: a pocket type "personal card" alongside cash, card and account; each inflow on it labelled as sale, family, own transfer or other; a monthly export listing them. Limits: this is a record the owner keeps for their own explanation. It must not be presented as tax advice, as a way to stay under a reporting threshold, or as a guarantee of anything. The figures in S6 and S8 come from media reports and a draft; the rules may have changed. Legal review comes before any copy is written.

**Recommendation 8, report for the bank.** Scope: twelve months of income, expenses, owner draws and balances per pocket, one page of summary, generated from data already in the system. The partner cabinet already exists for banks and MFOs. Open question: whether any partner bank will actually accept it. Without that, call it "a summary to take to the bank", not a bank document.

**Recommendation 10, per-seller close.** Scope: each seller closes their own shift (expected from their entries versus counted); the owner sees a line per seller. The seller role already hides balances, which is the right default. Wording matters: this is "the cash adds up" for everyone's protection, including the seller's.

## 6. What I would leave alone

- The scope exclusions (CRM, warehouse, scoring, "AI director"). The research supports them.
- Tax as reserve and reminders only.
- Deferring the voice CFO call, peer benchmarks, streaks and AI-built calculators, as `custdev.md` recommends.
- The three roles and what each can see.

## 7. Not verified

- No owner interviews; all dreams come from desk research with the limits listed in `business-dreams.md`.
- The app was not run. "Exists" means documented in the repo, not observed working. The quit step of the loop and the per-seller state of cash close are inferred.
- "Plan limits are not enforced" rests on a text search of the backend for references to billing and subscription on 2026-11-18. Other workers were editing billing at the time, so this may already be out of date.
- Whether voice entry counts against the AI question limit was not checked.
- Impact and effort ratings are estimates; no engineer has sized anything.
- Uzbek copy in section 3.3 has not been checked by a native speaker.
- The legal position on personal-card transfers and on what Oydin may promise about data sharing was not checked.
- Prices are untested.
