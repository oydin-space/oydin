# Oydin mobile UI kit: evidence and acceptance rules

Research date: 2026-11-18. Scope: owner-facing web/PWA and Telegram Mini App; RU, Uzbek Latin, EN. This is a proposed implementation specification, not a claim that current screens comply. `docs/decisions.md` wins over older product copy. No charging, automatic AI mutations, or new product modules are authorized here.

**Decision:** show cash safety first, supporting transactions second, and a confirmation-based voice/text entry within thumb reach. Reuse the existing personal component library + shadcn; extend their canonical components rather than maintaining a parallel kit. All numeric tokens below are Oydin design decisions, not measurements copied from competitors.

## Evidence: borrow task clarity, not banking complexity

These are primary-source desk findings, not hands-on app usability results. “Best-in-class” is the reference shortlist supplied in the assignment, not a verified ranking.

| Reference and source | Observed evidence | Oydin adaptation / boundary |
|---|---|---|
| [Apple Wallet / Apple Card](https://support.apple.com/en-us/104950) | Wallet → card → installment; individual plans reveal details; early payment includes a continuation step. | Summary → obligation → exact detail; explicit confirmation. Do not imitate credit-product controls or Apple branding. |
| [Copilot Money quick start](https://help.copilot.money/en/articles/11157550-quick-start-guide) | Dashboard has “To Review”; suggested transaction types/categories can be edited; recurring items reviewed separately. | A visible draft review queue, editable AI classification, recurring obligation review. Do not copy subscription-first onboarding. |
| [Monarch mobile reports](https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports) | Charts drill into constituent transactions; mobile filters include dates/accounts; documentation warns persistent filters can make data look missing. | Tap chart → matching list; always expose period and active filters. Do not put its full chart selector on the pulse. |
| [Revolut Business](https://www.revolut.com/business/business-account/) / [official help](https://help.revolut.com/en-US/help/more/company/revolut-for-business) | Both fetched pages blocked by Cloudflare (403); search found help listings but not usable business UI evidence. | Unverified reference: task-first account/action grouping is a candidate, not an attributed finding. Do not treat personal Revolut analytics as Business evidence. |
| [Qonto cash flow](https://support-de.qonto.com/hc/en-us/articles/23949205213201-How-can-I-manage-my-cashflow-in-Qonto) | Web/mobile forecast shows current balance, upcoming flows, overdue items, chart and dated transaction list; account/type/period filters. | Forecast beside due-date list; predicted/manual/actual provenance. Unlike Qonto's documented default, Oydin excludes own-account transfers from expense totals. |
| [Mercury Insights](https://support.mercury.com/hc/en-us/articles/44277089544084-Insights-page-overview) | Overview → filtered transactions; AI recap supports follow-up questions; internal transfers excluded from money-in/out. Source describes sidebar/web, not mobile parity. | Number → explanation → “why?” chat → evidence list; never call a cash balance profit. Mobile layout is our adaptation. |
| [Wise Business](https://wise.com/gb/business/) | Transfer preview exposes send/receive amounts, arrival and total fees; permissions and currencies are separate concerns. Marketing source, not authenticated mobile inspection. | Show original currency, converted amount, rate/date and calculation assumptions before confirm. No implication Wise is available to every UZ entity. |
| [Finolog money + mobile](https://finolog.ru/product/money/) | Separates transfers, recurring and planned payments; planned payments affect forecast, not reports; promotes mobile/Telegram cash entry. | Distinct actual/planned states; immediate cash capture. Source confirms mobile offering, not current installed app interaction quality. |
| [Planfact mobile](https://help.planfact.io/article/18170) | Four sections; mobile balances, cash flow/profit, creation/editing of actual and future operations. | Stable few destinations; editable transactions on phone. Avoid importing accounting directories into primary navigation. |

Finolog's official page explicitly advertises Telegram; the older market note's “not confirmed” must not be read as proof of absence. No market-note edits made in this assignment.

### Platform sources

- **T:** [Telegram Mini Apps](https://core.telegram.org/bots/webapps): safe/content-safe areas, responsive accessible UI, theme changes, BackButton, haptic feedback and home-screen API. Feature-detect and version-gate methods; older clients need ordinary web controls.
- **A:** [Apple accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility): larger text, color-independent meaning, labeled controls, keyboard alternatives and reduced motion. Current page calls 44×44 pt the default control size (not the absolute platform minimum); Oydin deliberately adopts it as its minimum target.
- **N:** [Apple tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars): destinations, not actions; stable labels/state; avoid overflow. [Toolbars / large titles](https://developer.apple.com/design/human-interface-guidelines/toolbars): orient with a large title that compacts while scrolling. [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets): one scoped task, one sheet, clear cancellation.
- **P:** [web.dev installation](https://web.dev/learn/pwa/installation), [installation prompt](https://web.dev/learn/pwa/installation-prompt), [Apple current iPhone instructions](https://support.apple.com/en-uz/guide/iphone/iph42ab2f3a7/ios). Browser/platform support varies; prefer Apple's current instructions over older web.dev capability lists (some are stale). Install is not a guarantee of offline readiness.

## Exactly 20 checkable design rules

Sizes are CSS px at default text size, expressed through rem tokens where appropriate; native pt guidance is adapted, not equated to physical screen pixels. No page-local token values.

| # | Required rule | Acceptance check |
|---|---|---|
| 1 | **Spacing:** tokens 4, 8, 12, 16, 24, 32, 48; mobile page inset 16; desktop 24; section gap 24; card gap 12. A 1px separator is exempt. | Inspect computed layout: all paddings/gaps use tokens; no arbitrary 13/19px values. |
| 2 | **Type:** system sans stack with Cyrillic/Uzbek support; caption 12/16, secondary 14/20, body 17/24, section 20/28, page 28/34, hero amount 34/40; weights 400/500/600/700. Financial values use tabular numerals, never thin weight. | All text uses named styles; real RU/UZ/EN strings render without missing glyphs. |
| 3 | **Responsive text:** use rem, allow browser text scaling, preserve zoom; no fixed-height text containers. Native wrappers honor Dynamic Type; web must reflow at 200% text size. | At 375px + 200% text, labels wrap and amounts remain accessible; no clipped confirmations. [A] |
| 4 | **Surfaces:** semantic light/dark tokens for canvas, surface, raised, text, muted, border, positive, caution, negative. Radius: input/button 12, card 20, sheet 24 top corners, pill 999. Flat 1px border by default; overlay-only shadow `0 8px 24px rgb(0 0 0 / .12)`. Yellow `#FFD62C` only logo/accent. | All states meet WCAG AA: normal text 4.5:1, large text 3:1, meaningful UI boundaries 3:1; no yellow body text or color-only risk meaning. [A] |
| 5 | **Touch/keyboard:** every actionable target ≥44×44; icon visible size 20/24; adjacent independent targets gap ≥8. All actions have accessible names and visible 2px focus ring with 2px offset. | Tab/Enter/Escape works; touch boxes do not overlap; no hover-only operation. [A] |
| 6 | **Navigation:** propose four stable destinations: Pulse, Payments, Operations, More (localized); More is a named app section, not automatic hidden-tab overflow. Chat/voice is a composer action, never a fake tab. Preserve each destination's scroll/filter state. Desktop uses matching sidebar destinations. | All four visible at 375px default size; enlarged text can use expanded layout without hiding destinations. Switching tabs does not clear a draft. [N, Planfact] |
| 7 | **Headers/context:** one large page title, compact sticky title after scroll; show current organization and role through the shared switcher. Do not imply one business's balance belongs to another. | Switch tenant: header/data/loading state update together; no prior-tenant flash; drill-down back restores context. [N] |
| 8 | **Pulse/card anatomy:** one status sentence first, then four metrics from product scope. Card slots: label → amount → period/context → optional source/update → one detail action. Padding 16, internal gap 8. At 375px use a single column; ≥390px allow two only when strings fit, otherwise stack. | No carousel hides metrics; each amount names currency/period; gap sentence includes date and amount, never just a red score. |
| 9 | **List rows:** minimum 64 high, auto-grow; leading plain icon or genuine integration logo 24; title and secondary account/date; trailing signed amount and status; separators inset to text. Only navigable rows get chevrons; never nest buttons inside a row button. | Long counterparty wraps; exact amount never ellipsized; transfer has distinct label and source→destination, not expense coloring. [Finolog, Copilot] |
| 10 | **Number formatting:** RU compact UZS: `950 тыс. сум`, `3,2 млн сум`, `1,2 млрд сум`; compact max one decimal; exact detail `3 200 000 сум`. Zero is `0 сум`; missing is `—` + reason. Preserve decimal precision where the source has it; never silently round stored values. | Formatter cases: 0, negative, 999, 999500, 1000000, 3200000, 1000000000, null. Promote rounded `1000 тыс.` to `1 млн`; minus is `−`; full amount available on tap/focus and accessible name. EN uses `UZS 3.2m`, UZ Latin uses `3,2 mln soʻm`; currency never inferred from color. |
| 11 | **Currency integrity:** aggregate USD/UZS only with declared display currency, CBU rate and date; detail retains original amount. Distinguish cash, reserved cash, owner's available amount and profit with a short explanation. | Combined total opens rate/source detail; stale or missing FX blocks a misleading precise combined total. [Wise] |
| 12 | **Charts:** cash balance line 2px; actual solid, forecast dashed; mark today, zero baseline and first projected gap with date+amount. Max two compared series, ≤5 x labels at mobile width; no smoothed overshoot, 3D or decorative gradients. Envelope progress uses labeled bars. | Touch/focus selects date and opens matching dated rows; text summary + table alternative exist; unknown days remain gaps, not fabricated zeros. [Qonto, Monarch, product] |
| 13 | **Filters/provenance:** every total/chart exposes period and account scope; active filter pills visible with Clear. AI insights show source, updated date and confidence; forecast shows assumptions, not certainty. | Same filters yield same chart/list totals; empty filtered list offers reset; demo always visibly says synthetic. [Monarch, Mercury] |
| 14 | **Empty/loading:** distinguish first use, no results and insufficient data. Each empty state has one explanation + relevant action. Initial loading uses matching static skeleton geometry; long task uses logo spinner + task text, not fake progress. Refresh preserves previous values with “updating.” | No empty zero balance or made-up chart; skeletons are hidden from screen readers; container has `aria-busy`; reduced motion removes shimmer/spin. |
| 15 | **Errors/offline:** inline field error names correction; section failure keeps healthy sections; persistent banner states offline/last synced. Offline entry shows “saved on this device / awaiting sync,” not “recorded.” Retry never clears user text or reports success before acknowledgement. | Exercise failed save, expired login, rejected import and offline entry; failed/pending/confirmed visibly distinct; alert announced once. |
| 16 | **Forms/sheets:** persistent labels, 16px+ input text, decimal keyboard for amount; amount/currency/account/date visible before save. One sheet at a time, medium/expanded where useful, explicit Cancel/Close and Confirm; dirty dismissal asks to discard. Full-page flow for complex import. | Sheet traps/restores focus, background inert, Escape/back closes appropriate layer; keyboard never covers focused field/confirm. [N] |
| 17 | **Voice/AI:** composer states idle, recording with timer+Stop, transcribing, editable draft, saving, confirmed/error. Text alternative always present; microphone consent requested only on use. AI response order: number → reason → action → data limits. Every mutation requires explicit review/confirmation. | “Paid rent 4 million cash” produces editable amount/account/category/personal-business draft; cancel creates nothing; pending AI is never counted in actuals. [Copilot, product] |
| 18 | **Interaction/motion:** hover (fine pointer only) adds 4% semantic foreground overlay; press 8%; buttons optionally scale .98 without moving layout; disabled blocks events and explains when necessary. Color/opacity 120ms, disclosure 180ms, sheet 240ms; enter `cubic-bezier(.2,0,0,1)`, exit `cubic-bezier(.4,0,1,1)`. No count-up money. | Reduced-motion uses no transform or travel, ≤80ms fade; only transform/opacity animate; no endless animation except meaningful active loading. Focus is as visible as hover. [A,T] |
| 19 | **Telegram shell:** map themeParams to semantic tokens, recompute on themeChanged; honor safeAreaInset and contentSafeAreaInset + their change events. Normalize device/container insets once rather than summing overlapping top insets; browser fallback uses `env(safe-area-inset-*)`. Register BackButton only on nested routes, clean listeners on exit. Haptics: light selection/impact, success only after save; optional/no-op if unsupported. | Old/new client, fullscreen, light/dark custom theme and open keyboard: header/composer/buttons unobscured. Root hides BackButton; back closes sheet before route. No duplicate native/web primary CTA or doubled bottom padding. [T] |
| 20 | **PWA install:** offer dismissible install after first useful pulse/confirmed entry, never gate use. Android: call captured beforeinstallprompt only from user tap if available; otherwise localized browser-menu guidance. iOS: Page Menu→Share (or Share)→Add to Home Screen→Open as Web App when offered→Add. Hide install prompt in standalone; Telegram uses its own supported home-screen API, not browser install instructions. | Dismissal respected for session; native decline is not success; unsupported browser gets honest instructions. Standalone launch, safe areas, login continuity and offline quick entry verified separately from installation. [P,T] |

## Canonical inventory: 25 shared components

This is the required public UI vocabulary, not permission to rewrite existing equivalent primitives. Map existing library/shadcn names to these contracts once. Pages compose these components; OpenUI rendering must resolve to the same components/tokens. No arbitrary JSX/CSS from model output.

Common: `id`, translated `label`/content, `className` only for layout (no token overrides), `testId` where needed. Interactive components inherit accessible name, focus/disabled behavior and 44px targets. All money values use a shared exact decimal/minor-unit domain value, not binary-float arithmetic in rendering. Source/locale are explicit, not guessed from browser alone.

| # | Component | Required/optional props and contract |
|---|---|---|
| 1 | Text | `as`, `variant: caption/secondary/body/section/page/hero`, `tone`, `weight`, `children`; semantic heading hierarchy. |
| 2 | Icon | `name`, `size:20/24`, `decorative`, `label?`; one coherent icon set, no decorative boxes. |
| 3 | BrandMark | `providerId`, `size:24/32`, `label`, `fallbackName`; approved real integration logo, text fallback on unavailable asset. |
| 4 | Button | `variant:primary/secondary/ghost/destructive`, `label`, `icon?`, `loading`, `disabled`, `onPress`, `type`; stable width while loading. |
| 5 | IconButton | `icon`, `label`, `onPress`, `pressed?`, `disabled`; tooltip supplements, never replaces accessible name. |
| 6 | Badge | `text`, `tone:neutral/positive/caution/negative`, `icon?`; text conveys status. |
| 7 | Money | `value`, `currency`, `locale`, `mode:exact/compact`, `sign:auto/always`, `missingReason?`; exact accessible label. |
| 8 | Field | `label`, `value`, `onChange`, `kind:text/amount/date/search`, `hint?`, `error?`, `required`, `disabled`; label/error associations. |
| 9 | SelectField | `label`, `options:{value,label,icon?,disabled?}[]`, `value`, `onChange`, `error?`; searchable account/category variants. |
| 10 | ChoiceControl | `kind:checkbox/switch/radio`, `label`, `description?`, `checked`, `onChange`, `disabled`; do not use switch for navigation. |
| 11 | SegmentedControl | `label`, `options`, `value`, `onChange`; ≤3 short choices, otherwise SelectField. |
| 12 | FilterBar | `period`, `accountScope`, `filters`, `onOpen`, `onRemove`, `onClear`; scope never hidden. |
| 13 | Card | `title?`, `description?`, `tone`, `children`, `footer?`; standard padding/radius, no implied click without action. |
| 14 | MetricCard | `label`, `value`, `currency`, `period`, `explanation`, `source?`, `updatedAt?`, `onDetails`; composes Card/Money. |
| 15 | StatusBanner | `tone`, `title`, `description?`, `action?`, `persistent`, `live:off/polite/assertive`; cash-gap/offline/errors share anatomy. |
| 16 | ListRow | `leading?`, `title`, `subtitle?`, `amount?`, `currency?`, `status?`, `onOpen?`, `trailingAction?`; no nested interactive targets. |
| 17 | AppHeader | `title`, `compact`, `organization`, `role`, `onSwitchOrganization`, `back?`, `action?`; shared context. |
| 18 | AppNavigation | `items:{route,label,icon,badge?}[]`, `activeRoute`, `onNavigate`, `layout:bottom/sidebar`; state retained per route. |
| 19 | TaskSheet | `open`, `title`, `size:medium/large`, `dirty`, `onClose`, `primaryAction`, `children`; desktop dialog from same contract. |
| 20 | StateView | `state:firstUse/noResults/insufficient/loading/error`, `title`, `description`, `action?`, `skeleton?`; no fake sample data. |
| 21 | FeedbackNotice | `kind:success/info/error`, `message`, `action?`, `onDismiss`, `persistent`; important failure never timed away. |
| 22 | CashChart | `actualPoints`, `forecastPoints`, `currency`, `locale`, `today`, `gap?`, `assumptions`, `onSelectDate`, `tableRows`; accessible alternative required. |
| 23 | EnvelopeProgress | `label`, `reserved`, `target`, `currency`, `dueDate`, `dailyContribution?`, `onOpen`; numeric progress and overfunded state. |
| 24 | Composer | `text`, `onTextChange`, `state`, `elapsed?`, `onRecord`, `onStop`, `onSubmit`, `onCancel`, `error?`; text/voice shared lifecycle. |
| 25 | EvidenceCard | `kind:insight/answer/draft/tool`, `headline`, `amount?`, `reason`, `sources`, `updatedAt`, `confidence?`, `assumptions`, `actions`, `onConfirm?`, `onEdit?`; action registry restricts AI-generated tools, mutation remains explicitly confirmed. |

Integration rows compose BrandMark + ListRow + Badge; onboarding composes Field/SelectField/StateView; install prompt composes StatusBanner + TaskSheet. Date picker, menus, tooltip and dialog internals reuse existing accessible primitives, not page-specific widgets. Calculators compose Field, Money, Card and EvidenceCard; scenario values remain distinct from actual ledger values.

## Ban these anti-patterns

- One-off card/button/chart CSS, duplicate money formatters, generated UI bypassing the kit.
- Dashboard walls of numbers; unexplained EBITDA/ДДС/маржа jargon before plain-language meaning.
- Yellow-on-white text, pale low-contrast text, red/green as the sole status signal.
- Boxed decorative icons everywhere; invented provider logos; emoji as integration identity.
- Bottom “Add” tab, moving/hiding destinations, unlabeled icons, swipe-only delete or tooltip-only detail.
- Nested sheets, irreversible confirm on Enter from unrelated fields, automatic AI posting.
- “All good” without enough data, unknown as zero, demo figures mixed with actuals, stale balances without dates.
- Cash inflow presented as profit; own-account transfers counted as income/expense; summed USD + UZS without rate.
- Decorative donut/gauge scores, smoothing that hides a zero crossing, chart interaction requiring hover.
- Auto-playing voice, recording without a visible stop/timer, AI “typing” forever after failure.
- Bounce/confetti/count-up on financial results, permanent shimmer, layout-shifting hover effects.
- Install/notification walls at first launch, false offline promises, browser install instructions inside Telegram.

## Handoff and evidence limits

Acceptance belongs to the implementing owner: exercise 375/390 and 1280/1440 layouts, RU/UZ/EN, 200% text, keyboard/screen reader, reduced motion, light/dark, Telegram safe areas/back/haptics, real Android/iOS installation and offline/save/retry. These are required checks, not completed checks.

Research limitations: Revolut Business pages blocked; no authenticated/native competitor sessions or measured task success. Mercury/Wise observations are web/help/marketing evidence, not verified mobile parity. Exact competitor spacing, font/radius and motion values were not inspected and are not claimed. Apple Card evidence covers obligation drill-down, not a full Wallet audit. PWA documentation includes stale capability claims; actual browser/version behavior must be device-tested. Token choices and four-destination navigation are Oydin proposals to validate with non-financial owners, not proven conversion improvements.

Not verified: implementation compliance; native competitor flows; Revolut Business UI; all target devices/viewports/locales, accessibility, install and offline end-to-end behavior.
