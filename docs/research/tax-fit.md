# Keep tax cash planning; cut tax computation

Decision research · 18 November 2026 · web-only, no customer interviews.

**Recommendation: B — an optional tax reserve envelope plus user-confirmed deadline reminders.** Oydin should help owners have money ready, not determine what they legally owe. This preserves the cash-gap promise without competing with accountants, 1C or the Tax Committee. This is a recommendation for owner approval, not an amendment to `docs/decisions.md`.

## Evidence: compliance already has owners and tools

| Workflow | Evidence and implication |
|---|---|
| Who prepares/accounts/files? | Owners can handle their own affairs, employ an accountant or contract an accounting firm. A local [Norma interview](https://www.norma.uz/nashi_obzori/buhgalterskiy_autsorsing_vybor_za_predprinimatelem) describes full outsourced bookkeeping with the customer retaining signature authority and responsibility for organization of accounting. It establishes the workflow, **not its current prevalence**: published in 2018 and supplied by an outsourcing vendor. Do not claim most UZ SMEs outsource. |
| Accountant's production system | [1C's official UZ product](https://v8.1c.ru/static/1s-bukhgalteriya-8-dlya-uzbekistana) supports accounting and mandatory reporting; [1C Uzbekistan](https://1c.uz/v8/generic_products/uz_accounting.php) describes accounting and tax accounting for multiple organizations. Oydin can supply cash records to the accountant rather than rebuild statutory books. |
| Filing and official account | [my.soliq.uz](https://my.soliq.uz/main?lang=ru) is the official electronic tax-services portal. The Committee [announced consolidation of my.soliq/my3.soliq](https://gov.uz/ru/soliq/news/view/172890). The public unauthenticated portal is JS-dependent; authenticated submission flows were not exercised. Treat it as the official destination, not an integration already available to Oydin. |
| Mobile visibility | [Spot's report citing the Committee](https://www.spot.uz/ru/2024/08/01/soliq-biznes/) describes Soliq Biznes: director/chief-accountant Face ID access, tax-obligation status, tax debt, invoice/contract/power-of-attorney status, notices and demands, account suspension reasons and inspector contact. The Committee independently confirms debt visibility in Soliq Biznes [here](https://gov.uz/ru/soliq/news/view/18085). This does not prove all taxes can be calculated or filed in the mobile app. |
| Deadlines and reminders already exist | The Committee publishes [taxpayer calendars](http://gov.uz/ru/soliq/news/view/160307). Its July 2026 [AI SOLIQ press release](https://api-portal.gov.uz/uploads/29/2026/07/30/36b925fc-e358-8298-9498-9a6314560927_media_.pdf) says “ИИ Отчетность” identifies required returns, periods, due dates, overdue returns and corrections. Personal-account demands/notices also exist. Universal proactive pre-deadline push/SMS delivery was **not verified**. Oydin's differentiator is funding readiness alongside other bills, not a unique tax calendar. |
| Rental registration | Official [E-ijara](https://ijara.soliq.uz/) registers rental contracts; search-visible portal text includes lease/leasing arrangements. This is a registration/compliance workflow, not a substitute for a rent cash-flow envelope. Do not build E-ijara registration into Oydin. |
| Electronic documents | [Didox API documentation](https://api-docs.didox.uz/ru/integrators-property-documents) defines invoice tax-document payloads. Its [corporate-card offering](https://cards.didox.uz/) markets receipt/tax/advance-report automation. Evidence supports document infrastructure, not the claim that Didox replaces an accountant or calculates/files every tax. |

**Outsourced-accountant share: unknown.** No representative current UZ statistic was found in this search. Vendor testimonials, international outsourcing rates and theoretical papers are not valid substitutes. Also distinguish external accounting firms, freelance/monthly accountants and in-house staff; combining them would distort the owner's question.

## Competitors support taxes without proving a UZ filing opportunity

| Competitor | Verified scope | Decision relevance |
|---|---|---|
| Planfact | Public [VAT calculator](https://planfact.io/tools/calculator-nds); [management-accounting VAT guidance](https://planfact.io/blog/posts/kak-pravilno-otrazhat-nds-v-upravlencheskoj-otchetnosti). The calculator is Russian-tax oriented. | Calculators can be acquisition tools; their existence does not validate UZ customer demand or a statutory engine inside Oydin. |
| Finolog | Official [release note](https://help.finolog.ru/article/4243) adds tax-expense types for correct report presentation. Its [management-accounting article](https://blog.finolog.ru/materials/kak-ehffektivno-vesti-upravlencheskij-uchet) distinguishes the accountant's tax scope from management information. | Tax payment categorization belongs in cash management. Current automatic statutory calculation/filing was not established. |
| Adesk | [Help documentation](https://help.adesk.ru/article/15929) explicitly calls taxes a separate serious accounting domain; provides tax categories, VAT presentation and placement in cash-flow/P&L reports. | More than “no taxes,” but management treatment is not evidence of UZ statutory compliance. |
| Moysklad | [UZ website](https://www.moysklad.uz/) advertises E-POS registration of sales/returns with the UZ tax authority. | Fiscal sales reporting is distinct from computing all tax liabilities. Do not confuse receipt fiscalization with tax returns. |
| BILLZ | Official [integrations page](https://billz.io/integration) advertises 1C integration and API access to shop data. | Retail operations can feed accounting. Full UZ tax calculation/filing was **not verified**, not proven absent. |

## Wrong numbers create real losses; disclaimers do not erase them

The Committee's [tax-debt explanation](https://gov.uz/ru/soliq/news/view/18085), with Tax Code links, describes daily late-payment penalties, collection orders against bank accounts, and escalation against property. It separately specifies reporting/payment deadlines. Its 2024 numerical interest-rate example is historical, **not a current rate to copy**.

[Inference] A wrong liability or deadline can therefore cause under-reserving, late payment, penalties and lost trust even if Oydin never files a return. A user-editable percentage reduces regime-selection risk, but does not guarantee sufficient reserves. Separate actual tax paid, confirmed payable and planning reserve; do not present a reserve as a statutory liability or deduct it twice.

Oydin's own contractual/professional liability under UZ law was not determined. “Not tax advice” is a description of scope, not guaranteed immunity. Obtain UZ legal review before liability promises, automated advice or statutory claims. No precise fine schedule is asserted here.

## Options: B best preserves customer coverage per unit of risk

Relative costs below are engineering/product judgments, not delivery estimates.

| Option | Customer coverage | Legal/product risk | Build and continuing cost |
|---|---|---|---|
| **A: no taxes** | All segments retain generic cash tracking; tax-related funding need remains unmet. | Lowest tax-specific risk, but optimistic “available to spend” if known tax payments are omitted. | Lowest. Generic obligations still need to accept accountant-entered payments. |
| **B: reserve + reminders** | Useful to self-filers **and** accountant-served owners: percentage planning for simple receipts, fixed confirmed amounts for complex regimes. Optional for users without a present liability. | Moderate: wrong inputs, misunderstood reserve, missed reminders. Lower than C if no legal-rate defaults or completeness claims. | Low incremental cost using existing envelopes/calendar; ongoing responsibility for reminder delivery and truthful labels, not a tax-law rules engine. |
| **C: full calculators** | Potentially useful to self-filers and accountant cross-checkers, but only for regimes, exceptions and source data actually supported. VAT/payroll/production require more than bank receipts. | Highest: wrong base, deductions, eligibility, thresholds, amendments and deadlines; generated UI does not make generated legal logic reliable. | High recurring cost: effective-dated law, tax expertise, complete inputs, deterministic calculations, edge cases and regression coverage. Filing adds another separate scope. |

**Customer-use percentages cannot be estimated from this evidence.** No observed denominator exists for Oydin's target segments. Accountant outsourcing share would not equal calculator demand anyway: an outsourced customer may want a reserve, and a self-filer may prefer Soliq. A credible numerical answer is “not measured,” not an invented TAM percentage.

[Inference] B has broader potential relevance than C because the cash-funding job survives delegation of compliance. Production/retail/cafés may need accountant-supplied amounts; simple sellers/services may choose percentage reserves. These are segment hypotheses, not adoption findings.

## Exact recommended scope

**Keep**
- Ordinary tax payment category and obligations in forecasts; optional envelope named **“Tax reserve / Резерв на налоги.”**
- Two user-confirmed methods: fixed planned amount, or editable percentage of selected eligible business receipts. No rate preselected. Display selected period, receipt base, percentage and result.
- Exclude own-account transfers, loans, owner funding and personal receipts from the reserve base; allow correction of misclassified transactions. Explain that cash receipts are not necessarily the legal tax base.
- Accountant/owner can replace an estimate with a confirmed payable amount and date. Show provenance: “your setting,” “accountant-confirmed,” or “planning estimate”; never imply government verification.
- Editable payment/reporting reminders as **separate events**, with confirmed dates and Telegram opt-in. Use the existing obligations mechanism. Official calendar links can help the user confirm dates; do not silently assign a regime calendar.
- Include each obligation once in the cash-gap forecast. A virtual envelope reduces spendable cash but does not claim funds were moved to a bank subaccount or tax authority. Record real payment separately and reconcile the reserve.

**Cut / do not claim**
- Mandatory tax-regime onboarding; automatic 1%/4%/6%/12%/15% presets; automatic threshold or eligibility decisions.
- Full VAT, profit-tax, payroll-tax or regime-comparison calculators, including AI-generated versions. Allow arithmetic on an explicitly user-provided percentage, labeled as reserve planning only.
- Filing, tax payment execution, E-ijara registration, automatic statutory returns, tax optimization, penalty guarantees and “all your taxes are covered.”
- Any “net profit after tax” or “safe to withdraw” claim based solely on an unconfirmed reserve. Mark missing tax obligations as a forecast limitation.

This supersedes the **recommendation** embedded in `docs/product.md`'s tax-regime paragraph, not the file itself: Main/owner must approve and reconcile product copy and calculator scope. Existing market research's claim that UZ tax logic is a competitive gap is not demand evidence and should not drive implementation.

### Exact disclaimer copy

**Envelope setup:** “Oydin plans a cash reserve using the amount or percentage you choose. This is not a calculation of tax due, a tax return, or tax advice. Confirm your tax base, rate, amount and deadlines with your accountant or the Tax Committee.”

**Number label:** “Planning reserve — not tax due. Based on your settings and recorded receipts; excluded or missing transactions can change the amount.”

**Reminder:** “Reminder for the date you confirmed. This is not an official tax notice. Check current obligations and deadlines in Soliq or with your accountant. Marking this reminder complete does not file a return or pay tax.”

**Russian setup copy:** «Oydin планирует денежный резерв по указанной вами сумме или проценту. Это не расчёт налога к уплате, не налоговая отчётность и не налоговая консультация. Уточните налоговую базу, ставку, сумму и сроки у бухгалтера или в Налоговом комитете».

Translate the same meaning into Uzbek Latin and English at implementation; do not weaken the distinction in abbreviated mobile labels.

## Validate coverage before expanding

Proposed, not yet run: recruit 15 owners across the five target segment groups, including self-filers, freelance/outsourced-accountant customers and in-house-accountant customers. This is directional discovery, not a representative survey.

Ask for the **last actual** tax-payment workflow: who computed/filed it, how the owner learned the amount/date, whether cash was short, and which tool was used. Observe consented/redacted evidence; do not request credentials. Then offer real setup of a reserve/reminder versus a calculator, recording activation rather than favorable opinions.

Report calculator users / eligible owners observed and reserve users / same denominator, with accountant status and segment. Proposed decision gate: retain B if at least 5/15 set up a real obligation and 3 use it again at their next payment cycle. Reconsider C only after at least 5 demonstrate the same recurring unsupported calculation, supply required inputs and request a replacement for their current workflow. These thresholds are learning gates, not adoption-share estimates or permission to ship legal calculations.

**Not verified:** representative outsourcing share; calculator/reserve adoption shares; authenticated Soliq filing and notification delivery; live competitor accounts; full competitor tax feature inventories; current legal liability interpretation; customer interviews or behavior; implementation and translations. No builds/tests run.
