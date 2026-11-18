# Oydin launch film plan

## Film idea

**Working title:** *Know what your money needs next*

**Audience:** Uzbek small-business owners first; banks, MFOs, accountants, partners, judges, and developers second.

**Purpose:** explain one concrete idea: Oydin turns scattered money events into a current business pulse and shows what may happen before the next obligations arrive. The film should make that useful before it makes it technical.

**Mode:** human documentary opening and closing, with a precise Apple-keynote-style product film in the middle. Calm, warm, direct. No startup hype, fake urgency, neon, 3D-tilted interfaces, or invented outcomes.

**Master format:** 1920×1080, 30 fps, 16:9, target **3:10** (acceptable range 2:50–3:20). Keep all essential action and subtitles safe for a later 9:16 adaptation, but do not treat the vertical crop as a deliverable yet.

**60-second cut:** separate edit described below. It is not a speed-ramped copy of the master.

**Language:** Lola speaks in [TBD: RU / UZ / EN]. Main VO is drafted in English for ElevenLabs `voicelab`. Every spoken line gets human-reviewed RU and UZ (Latin) subtitles. Do not show two subtitle languages at once: make separate RU and UZ masters, plus a clean EN master if needed.

## Story spine

A real founder reaches for her phone because the information she needs is scattered. Her thumb opens Oydin; the phone screen becomes the film’s visual carrier. One synthetic but clearly labelled demo business travels through the product: pulse → brief → voice operation → forecast → generated decision tool → people and systems around the owner. Research interrupts the polished product world before the ending, so the film is honest about what is known and what still has to be tested. We return to Lola, now looking at the actual app, not acting out a promised business result.

The opening interview must stay factual. Lola’s pain, wording, and reaction cannot be scripted as personal truth. The lines below are prompts and edit targets; use only what she actually says.

## Narrative structure

1. **Cold open, 0:00–0:36.** Lola Sayfi, owner of the gallery “human house,” in her real space. Cash surprises, scattered notes, and lack of time are questions for the interview, not assumed facts. She picks up her phone and opens Oydin.
2. **Reveal and product film, 0:36–2:39.** A match cut turns Lola’s phone into a full-frame device stage. The app performs real actions. Macro UI components leave and return to their real places; ornaments act as transition geometry, never wallpaper.
3. **Research, 2:39–2:57.** Real conversations and artefacts, with exact source/consent records. State what the current research does and does not establish.
4. **Close, 2:57–3:10.** Lola again. One short genuine reaction, then the six-petal mark, Oydin, and `oydin.sayfi.uz`.

## Shot list — 3:10 master

All product screens are captures from the real app. “Rebuild” below means animating a verified DOM component or exact captured element without changing labels, values, or interaction semantics.

| # | Time / duration | Visual | On-screen text | VO line draft (EN; RU/UZ subtitle note) | Motion / transition | Sound |
|---:|---|---|---|---|---|---|
| 1 | 0:00–0:06 / 6s | Medium close-up of Lola in human house. Gallery activity stays visible behind her. | None | **Lola sync:** [TBD: her actual first sentence about running the gallery] — subtitle her original words into EN/RU/UZ as required. | Start on a lived-in frame, not black. Locked or very slow physical push-in. | Room tone first; music enters almost invisibly after 2s. |
| 2 | 0:06–0:16 / 10s | Interview angle plus cutaways: Lola at the desk, a calendar, a notebook, phone messages, an invoice or receipt with private details hidden. | None | **Lola sync:** [TBD: actual example of a cash surprise or an upcoming payment she had to reconstruct]. | Straight documentary cuts. No animated overlays over her face. | Sync sound; restrained tactile notes under cuts. |
| 3 | 0:16–0:27 / 11s | Hands moving between phone, notes, and work in the gallery. | None | **Lola sync:** [TBD: actual wording about where she keeps information and what takes time]. | Match hand positions across b-roll; slightly quicker rhythm as sources accumulate. | Paper, pen, notification texture kept low; no fake notification sounds unless recorded. |
| 4 | 0:27–0:36 / 9s | Lola says the final thought, reaches for the phone, taps Oydin. End tightly framed on the real screen. | None | **Lola sync:** [TBD: short line that naturally leads to checking the business]. | Hard match cut on the tap: live phone bezel aligns with the clean product device frame. | Tap transient; room tone narrows into the score. |
| 5 | 0:36–0:45 / 9s | Full phone stage on warm cream. Oydin opens to the real `/app` pulse. The white six-petal flower appears only inside the app. | **Your business, in one clear pulse** | “We built Oydin for the moment when a business owner needs one answer: what is actually safe to do with the money today?” — RU/UZ subtitles translated and reviewed. | Device settles in 0.6s. The pulse component comes forward at 1.8×, then returns to its exact place. | First clear musical motif; soft UI arrival, no sparkle. |
| 6 | 0:45–0:56 / 11s | Dashboard pulse, available money, reserves, owner draw, period result, and daily cash close. Use the actual seeded state. | **Cash is not the same as profit** | “Oydin separates the cash balance, the period result, owner contributions and draws, and money already reserved for obligations.” | One card at a time is isolated. A thin ink rule links related values; no three-card montage. | Dry ticks tied to value changes; warm bass pulse. |
| 7 | 0:56–1:06 / 10s | Morning brief in the PWA, then the same real brief in Telegram. A single relevant alert is shown, not a notification storm. | **The next thing that needs attention** | “The morning brief keeps it short: what changed, what needs attention, and the next useful action.” | Dashboard header becomes the Telegram message header by match cut. Ornament-islimi line draws the travel path, then resolves away. | Quiet message arrival; music opens slightly. |
| 8 | 1:06–1:18 / 12s | Phone in hand. Open prompt bar → hold microphone → speak a demo expense → quit/close → glance at the proposed operation → confirm. | **Open. Speak. Quit. Glance.** | “When something happens, you can say it once. Oydin prepares the operation; you check the amount, account, category, and whether it belongs to the business.” | Keep the whole interaction legible. Spoken waveform becomes the draft card edge. Confirmation only occurs after the visible human tap. | Realistic mic start/stop, low waveform texture, firm confirm click. |
| 9 | 1:18–1:30 / 12s | `/app/plan` and `/app/calendar`: obligation envelope fills; forecast line crosses a future threshold; gap date and amount use seeded synthetic data. | **See the gap before the payment** | “Upcoming payments and expected cash share one timeline. If the plan falls short, Oydin shows the date, the amount, and what the forecast depends on.” | Calendar cell expands into the line chart. Camera move 0.5s, then hold while the line actually draws. | A low pulse at threshold crossing, not an alarm. |
| 10 | 1:30–1:39 / 9s | “Can I afford it?” decision flow using a real purchase scenario. Assumptions and limits remain visible. | **Can I afford it?** | “Before a purchase, ask the practical question. The answer includes the reason and the limits of the available data.” | Question chip becomes the result panel; assumptions arrive after the main answer. | Short tonal question/answer pair. |
| 11 | 1:39–1:53 / 14s | `/app/chat`: owner asks for a what-if plan. A real OpenUI calculator or scenario control is generated, adjusted, and pinned to `/app/tools`. | **Ask. Adjust. Keep the tool.** | “The chat can build a calculator for the decision in front of you: a cash-gap scenario, unit economics, break-even, or another plan. Adjust it, then pin it and use it again.” | Chat bubble grows into the generated control. Slider movement changes the real result. The tool card returns into the tools workspace. | Subtle generative sequence, one tactile slider sound, pin click. |
| 12 | 1:53–2:04 / 11s | `/onboarding`: conversational setup asks for the business, then offers statement import or three notes, ending at the first pulse. | **Start with what you already have** | “Setup begins as a conversation. Add a statement or three notes, and Oydin uses them to prepare the first pulse.” | Chat messages replace one another in the same frame. The last message aperture-cuts into the dashboard result. | Music strips back; three soft entry sounds, then pulse motif. |
| 13 | 2:04–2:15 / 11s | `/app/team`: invite accountant and seller; show role boundaries. Then `/shared/[token]` read-only accountant report and PDF affordance. | **Bring the right people in** | “An owner can invite an accountant or seller with different access. A read-only report can be shared without handing over the whole account.” | Member row slides from the real invite action; role labels lock into columns. Shared report unfolds from its link. | Paper-fold texture kept very quiet; access click. |
| 14 | 2:15–2:26 / 11s | `/app/settings/developer`: create personal token with secret obscured; docs page/OpenAPI; terminal sends a real demo request; webhook or MCP result updates the app. | **REST, webhooks, and MCP** | “For developers, Oydin exposes a documented REST API, webhooks, and MCP, so verified business data can connect to the tools around it.” | Token row becomes a terminal line; response object becomes an operation in the app. Never show a real secret. | Keyboard detail, request whoosh, one response tick. |
| 15 | 2:26–2:39 / 13s | `/pricing`: Free and paid/request-access states exactly as shipped. Briefly return to pulse, forecast, integrations, and team through the plan details. | **Start free · Request access** | “The free plan keeps the pulse accessible. Forecasts, integrations, and team features are planned for paid access at roughly 99 to 199 thousand sum a month. Pricing is still being tested.” | Pricing rows reveal from the cursor’s actual scroll. Yellow accent travels into the next live-action scene as a physical yellow object or light patch. | Score reaches its product peak, then drops to room tone. |
| 16 | 2:39–2:48 / 9s | Real interview/research montage: owners talking, researcher listening, anonymised artefacts, street/workplace context. If field interviews have not happened, use source documents and research work only—never stage them as completed. | **Start with real money habits** | “The reason for building Oydin is simple: financial software only helps when it fits the way owners already work.” | Documentary cuts; no quote cards without exact, consented quotes. Girih geometry briefly organizes source tiles, then breaks back into footage. | Room tone from each location; music becomes sparse. |
| 17 | 2:48–2:57 / 9s | Research evidence and limitations on a clean cream field, intercut with real conversations if available. | **Research first. Claims second.** | “Existing research points to incomplete records, blurred lines between business and personal money, and the need for clearer daily control. Voice, forecasting, Telegram habits, and willingness to pay still need direct testing.” | One source at a time, with small source labels. No percentage animation. | Pencil/marker texture; restrained resolve in score. |
| 18 | 2:57–3:04 / 7s | Back to Lola in the same setup. She looks at the actual Oydin screen and gives one genuine reaction or next question. | None | **Lola sync:** [TBD: genuine reaction after using the prototype; do not script praise]. | Match her phone angle from shot 4. Hold long enough to feel unedited. | Sync sound and room tone; music returns under the last words. |
| 19 | 3:04–3:10 / 6s | Six white petals assemble from the six UI carriers used in the film onto `#FFD62C`; wordmark wipes in; URL lands below. | **Oydin**  
**Know what your money needs next**  
`oydin.sayfi.uz` | “Oydin. Know what your money needs next.” — RU/UZ subtitle only if that master uses translated end copy. | Build the mark, do not fade it in. Hold the complete card for at least 3s. | Six soft petal impacts, one resolved chord, clean tail. |

## Full VO script draft

The cold open and closing Lola lines are deliberately absent until the interview is recorded. Her sync sound should carry roughly 30–40 seconds in total.

> We built Oydin for the moment when a business owner needs one answer: what is actually safe to do with the money today?
>
> Oydin separates the cash balance, the period result, owner contributions and draws, and money already reserved for obligations.
>
> The morning brief keeps it short: what changed, what needs attention, and the next useful action.
>
> When something happens, you can say it once. Oydin prepares the operation; you check the amount, account, category, and whether it belongs to the business.
>
> Upcoming payments and expected cash share one timeline. If the plan falls short, Oydin shows the date, the amount, and what the forecast depends on.
>
> Before a purchase, ask the practical question. The answer includes the reason and the limits of the available data.
>
> The chat can build a calculator for the decision in front of you: a cash-gap scenario, unit economics, break-even, or another plan. Adjust it, then pin it and use it again.
>
> Setup begins as a conversation. Add a statement or three notes, and Oydin uses them to prepare the first pulse.
>
> An owner can invite an accountant or seller with different access. A read-only report can be shared without handing over the whole account.
>
> For developers, Oydin exposes a documented REST API, webhooks, and MCP, so verified business data can connect to the tools around it.
>
> The free plan keeps the pulse accessible. Forecasts, integrations, and team features are planned for paid access at roughly 99 to 199 thousand sum a month. Pricing is still being tested.
>
> The reason for building Oydin is simple: financial software only helps when it fits the way owners already work.
>
> Existing research points to incomplete records, blurred lines between business and personal money, and the need for clearer daily control. Voice, forecasting, Telegram habits, and willingness to pay still need direct testing.
>
> Oydin. Know what your money needs next.

**VO performance:** conversational, grounded, 145–155 words per minute, no trailer bass, no exaggerated smile, no “AI assistant” polish. Choose a voice that can pronounce **Oydin**, Uzbek names, UZS amounts, REST, and MCP correctly. Record pronunciation rules in ElevenLabs before the final take. Keep breaths and phrase breaks natural. Create one clean stem per scene so timing can change without regenerating the whole narration.

## 60-second cut

Target **0:60**, not 0:59 with a rushed card. Preserve the human/product/human structure and one complete task.

| Time | Beat |
|---|---|
| 0:00–0:08 | Lola’s strongest truthful sentence plus one cutaway. |
| 0:08–0:12 | She opens Oydin; match cut into the pulse. |
| 0:12–0:20 | Pulse and morning brief: one answer, one next action. |
| 0:20–0:29 | Complete voice flow: open → speak → quit → glance → confirm. |
| 0:29–0:38 | Forecast line reaches the gap; “Can I afford it?” returns a reasoned result. |
| 0:38–0:46 | AI chat generates and pins one real tool. |
| 0:46–0:51 | Team + developer connection in two caused match cuts. |
| 0:51–0:55 | Research limitation: “Built around real money habits. Still tested with owners.” |
| 0:55–1:00 | Lola glance → assembled flower → `oydin.sayfi.uz`. |

**60s VO draft:**

> Running a business should not require rebuilding the story of your money every time you need an answer. Oydin turns operations and obligations into one current pulse. Say what happened; check the draft; confirm it. See the next payment on the same timeline as expected cash, and ask whether a purchase is safe before committing to it. The chat can build a tool for the decision, then keep it on your dashboard. Bring in an accountant or seller with the right access, or connect through REST, webhooks, and MCP. We are building Oydin around real money habits—and testing the assumptions that still need proof. Oydin. Know what your money needs next.

The first sentence may be replaced by Lola’s own line if it makes the same point truthfully. Do not run VO over her voice.

## Research chapter: evidence rules

`docs/business-dreams.md` is not present in the repository at planning time. The current research source is `docs/research/custdev.md`, which explicitly records **zero first-party interviews**. The film must not imply otherwise.

What can be said now:

- Existing sources support investigating clearer profit/period-result reporting, incomplete records, tied-up working cash, business/personal separation, daily cash close, and easier setup.
- Local owner stories provide useful process examples, but they do not establish prevalence across Uzbek small businesses.
- Demand for voice, forecasts, a fixed Telegram brief, and the proposed price remains a hypothesis requiring direct interviews and use tests.
- Research also contains a counter-signal: many owners already report written budgets. The film must not say owners “do not plan” or diagnose them as financially illiterate.

If new `business-dreams` fieldwork is supplied, every statement used in the film needs: participant ID, segment, language, consent for recording/public use, exact transcript timecode, translation reviewer, and whether the line is a direct quote or editorial summary. No invented statistics; all unavailable numbers remain **[TBD]**.

## Visual direction

### Product cinematography

- Establish the real workspace before every macro isolation. Keep navigation visible long enough to locate the task.
- Isolate only the component performing the action, at roughly 1.6–2× its app scale; return it to the real workspace afterward.
- Device frames are straight-on or gently physical. No 3D carousel, dramatic perspective tilt, floating glass slabs, or tiny app windows in a dark void.
- Cursor size: 4–7% of frame height. It enters with intent, and a click causes the transition on that frame.
- Focus moves: 0.55–0.8s. Supporting reveals: 0.25–0.45s. Meaningful group stagger: 0.08–0.16s. No perpetual drift or breathing animation.
- Use 3–5 transition families only: live-phone/device match cut; component morph; chart-line/girih-line wipe; shared-card return; petal/shape match cut.

### Ornament use

Use the actual files:

- `web/public/landing/assets/ornament-islimi.svg` for organic paths between voice and brief;
- `ornament-girih.svg` for grids, developer systems, and research-source organization;
- `ornament-suzani.svg` for the human/live-action boundary;
- `ornament-ikat.svg` for short directional wipes.

Ornaments stay monochrome ink, cream-on-ink, or low-contrast brand yellow. They should cause or explain a transition, not sit behind every scene. Never combine all four in one frame.

### Typography and color

- **Primary UI/video type:** the app’s actual stack, with locally bundled **Onest** for reproducible rendering. Apple system fonts may appear only inside genuine device/browser chrome where the OS supplies them.
- Headings at 1080p: 84–112px. Supporting copy: 44–56px. Subtitles: 42–48px, maximum two lines. Real UI labels must remain at least 26px after scaling.
- Titles: one line where possible, maximum six words per line. The on-screen line should add context, not repeat the VO or visible UI.
- Core palette: brand `#FFD62C`; warm cream `#FBF7EE`; ink `#3B342A`; card `#FFFDF8`; muted cream `#F3ECDD`; border `#ECE3D1`.
- Preserve real semantic colors from the app. Yellow is for the logo, one active focus, the payoff, and the end card—not every card.
- The flower is the existing white six-petal mark. Use the source file, never redraw it from memory.
- No neon, electric gradients, glow, particles, generic blue-purple AI imagery, chrome, or full-film glass treatment.

## Music and sound direction

**Music:** one warm contemporary instrumental arc, 92–104 BPM, with felt percussion, muted plucks/marimba-like wood, soft bass, and restrained strings or synth air. It should feel modern without sounding corporate or “tech inspirational.” Uzbek instruments may be used only with a real musician or a well-sourced recording; avoid a decorative pseudo-traditional pastiche.

**Arc:**

- 0:00–0:27: mostly room tone, one simple motif.
- 0:27–0:45: pulse and bass enter through the phone tap.
- 0:45–1:53: controlled build; each product action gets space.
- 1:53–2:39: broader harmony, still below narration.
- 2:39–2:57: strip back for research and real voices.
- 2:57–3:10: motif returns and resolves under the logo.

**SFX:** record or source dry, close sounds—tap, mic start/stop, card lock, line threshold, slider, pin, invite, request/response, six petal impacts. Avoid riser packs, cinematic booms, cash-register sounds, sparkle chimes, fake crowd noise, and loud whooshes. Keep Lola’s room tone continuous across interview edits. Deliver separate stems for music, VO, sync, and SFX; final loudness target **[TBD: platform]**.

## Assets the user must provide

### Lola / human house footage

**Capture spec**

- 4K UHD minimum, 25 or 30 fps [TBD based on local lighting], 10-bit 4:2:2 log or a neutral camera profile; lock white balance and shutter.
- Record clean 48 kHz / 24-bit audio with lav plus boom backup. Capture at least 60 seconds of room tone.
- Main frame: medium close-up, eyes around upper third, Lola looking just off-camera. Leave negative space on both sides for 16:9 and possible vertical reframing.
- Second frame: wider environmental angle showing the gallery without turning it into a generic office.
- Phone inserts: 4K, screen at 60 Hz if possible, exposure set to avoid banding, no personal notifications, and the real Oydin build installed or opened in the browser.
- Keep shots steady for 3 seconds before and after every action. Capture clean plates of the room and desk.
- Obtain written permission for Lola, the gallery, visible artwork, visitors, and any recognisable staff/customer. Blur or replace private financial information at capture, not only in post.

**B-roll list**

- Opening the gallery or entering the workspace.
- Checking the day’s calendar or orders.
- A real notebook, receipt, invoice, or spreadsheet she already uses, with sensitive details removed.
- Switching between phone, paper, and computer.
- A customer or staff interaction, only with consent.
- Handling an artwork or gallery task that shows what takes her attention.
- Phone resting on the desk; hand reaches in.
- Unlocking phone, opening Oydin, dashboard loaded.
- Voice entry action with a prepared synthetic example, clearly separate from her real finances.
- Reading the pulse, one natural reaction, putting the phone down or returning to work.
- Exterior/signage and 10–15 seconds of gallery atmosphere.

**Interview questions for Lola**

Ask for the last real example, not a general opinion. Do not mention “cash gap” until she uses it or the behavioural questions are complete.

1. What does a normal day running human house actually look like?
2. Tell me about the last time a payment or expense surprised you. What happened?
3. What information did you need to reconstruct, and where did you look for it?
4. Where are today’s sales, upcoming payments, and informal promises recorded now?
5. When do you usually realise that the available balance is not the same as money you can safely spend?
6. What is the last financial task you postponed because something else in the gallery needed you?
7. Who else needs access to the numbers, and what should they not be able to change?
8. If you could ask one question about the next two weeks of the business, what would it be?
9. Try this Oydin flow without guidance. What do you think the pulse means?
10. What is unclear or wrong? What would stop you from trusting it?
11. Would speaking an operation be useful in your real setting, or would text/file import work better? Why?
12. After using it, what would you check next? Capture the answer as a question if that is more honest than praise.

### Other interview/research footage

- [TBD] consented clips from owners in relevant segments, ideally RU- and UZ-first speakers and outside a single type of business.
- For each clip: release, participant ID, segment, location, date, original language, full transcript, approved translation, and allowed usage.
- B-roll of the actual process discussed and anonymised artefacts. Do not ask participants to recreate a problem they did not have.
- If no field interviews exist by picture lock, use documented desk research and Lola only. Do not stage “research interviews.”

### Brand and audio choices

- Master vector logo and wordmark files, including an isolated six-petal flower and approved clear-space rules. Current fallback sources are `web/public/icons/favicon.svg`, `web/public/landing/assets/hero-wordmark.png`, and `oydin-wordmark-white.png`.
- Confirmation that “human house” is the exact public spelling and permission to name the gallery.
- ElevenLabs `voicelab` voice ID or 3–5 approved voice candidates; desired gender/age/accent are [TBD].
- Pronunciation recordings for Oydin, Sayfi, Uzbek names, UZS amounts, and the URL.
- Music licensing route and target channels: website, social, event screen, paid ads [TBD].
- Final CTA wording and whether the URL is public/request-access at release.

## Assets we generate or capture from the real app

All captures use a dedicated synthetic organization, visibly named **Print Lab Tashkent — demo** (or the final seeded demo label). No real customer data. Record the build commit, route, role, locale, viewport, theme, fixture ID, and capture date in an asset manifest.

### Capture matrix

| Product chapter | Route(s) | Viewport(s) | Required captured action/state |
|---|---|---|---|
| Pulse / cash close | `/app` | 390×844 and 1440×900 | Healthy pulse; gap pulse; balance vs period result vs owner draw; expected vs counted close and unexplained difference. |
| Morning brief | `/app`, Telegram bot/Mini App | 390×844 | Real brief payload and one gap alert. Capture Telegram only if the configured integration works end to end. |
| Voice entry | `/app`, `/app/quick` | 390×844 | Open prompt, record synthetic phrase, stop/quit, draft fields, edit if needed, confirm, operation appears. |
| Forecast and obligations | `/app/plan`, `/app/calendar` | 390×844 and 1440×900 | Envelope progress, daily contribution, forecast line, exact gap date/amount, assumptions. |
| Affordability | Real entry point on `/app/plan` or generated tool route [TBD after UI inspection] | 390×844 | Enter proposed spend, receive answer, reason, and data limits. |
| AI chat + generated tools | `/app/chat`, `/app/tools`, `/app/tools/[id]` | 390×844 and 1440×900 | Ask for one scenario calculator; OpenUI component renders; adjust a control; pin; reopen from tools. |
| Onboarding | `/onboarding` | 390×844 | Business selection; statement or three-note path; first pulse. Capture fallback wizard only if it is the shipped path. |
| Team and sharing | `/app/team`, `/app/settings/sharing`, `/shared/[token]` | 390×844 and 1440×900 | Invite accountant/seller; role restrictions; read-only report; PDF action. |
| Developer | `/app/settings/developer`, API docs at [TBD exact URL] | 1440×900 plus terminal 1440×900 | Create/revoke demo token, real API request, webhook delivery, MCP tool call. Obscure every secret. |
| Pricing | `/pricing`, `/app/billing` | 390×844 and 1440×900 | Exact free/request-access UI and current feature availability. No checkout implication. |
| Integrations, if visible | `/app/settings/integrations` | 1440×900 | Show working integrations separately from `coming_soon`; never animate a catalogue logo as a working connection. |

For each interaction, preserve a full-context recording and capture selected components from the real DOM at device scale 2. Static screenshots prove states, not interactions; voice, slider, pin, invite, API, and confirmation flows require recordings or deterministic DOM animation based on verified states.

### Demo data needed

Use internally consistent synthetic data derived from the existing Print Lab demo, with final values recorded before capture:

- UZS cash, card, and bank accounts; optional USD account with a stored CBU rate and visible stale/current state.
- Retail and B2B orders, including the documented synthetic product examples.
- Rent, salaries, supplier payment, loan, and user-entered tax reserve obligations.
- One owner contribution, one owner draw, one internal transfer that is not counted as expense, one personal transaction, and one draft requiring confirmation.
- At least 30 days of history for a readable forecast; exact history length [TBD based on product requirement].
- One future cash gap with exact amount/date **[TBD after seed execution]**.
- One “can I afford it?” purchase **[TBD]** with a result supported by the same ledger and obligations.
- One generated what-if tool with inputs and result **[TBD]**.
- Owner, accountant, and seller demo users with role-correct visibility.
- One share link, one safe PDF, one API token that is immediately revoked after capture, one webhook endpoint, and one MCP call.
- RU, UZ Latin, and EN strings reviewed in the screens used. The master can feature one locale [TBD]; subtitles must not cover key controls.

## HyperFrames composition breakdown

Create one editable HyperFrames project only after the plan and assets are approved. Default master is 1920×1080, 30 fps, 190 seconds. Every scene below is a sub-composition; root media tracks own music, VO, sync, and SFX.

| Composition ID | Time | Contents / ownership |
|---|---:|---|
| `01-lola-open` | 0:00–0:27 | Live footage, sync audio, minimal documentary cuts. |
| `02-phone-bridge` | 0:27–0:45 | Lola reach/tap, live-to-device match cut, first pulse reveal. Owns the persistent phone frame until 1:18. |
| `03-pulse` | 0:45–0:56 | Dashboard context and exact pulse components. |
| `04-brief` | 0:56–1:06 | PWA brief to Telegram match cut. |
| `05-voice` | 1:06–1:18 | Complete voice interaction and confirmed draft. |
| `06-forecast` | 1:18–1:39 | Calendar, forecast, gap, affordability result. |
| `07-chat-tools` | 1:39–1:53 | Chat prompt, generated OpenUI control, pin, tools workspace. |
| `08-onboarding` | 1:53–2:04 | Conversational onboarding to first pulse. |
| `09-team` | 2:04–2:15 | Invite, role access, share report. |
| `10-developer` | 2:15–2:26 | Token, docs, terminal, API/webhook/MCP result. |
| `11-pricing` | 2:26–2:39 | Real pricing/request-access state. |
| `12-research` | 2:39–2:57 | Documentary research, sources, limitations. |
| `13-lola-close` | 2:57–3:04 | Lola’s genuine response and room tone. |
| `14-end-card` | 3:04–3:10 | Petal assembly, wordmark, claim, URL. |
| `overlay-subtitles` | 0:00–3:10 | Single caption track, separate RU and UZ source variants. Keep inside 80% title-safe. |
| `overlay-carriers` | 0:27–3:10 | Persistent phone/component carriers and ornament transition paths where DOM continuity is required. |

**HyperFrames implementation rules for later production**

- One readable paused GSAP timeline per composition, registered after all tweens.
- Every timed element is explicit HTML with stable IDs and `.clip`, `data-start`, and `data-duration`.
- All media is local under `assets/`; no network fetches, timers, unseeded randomness, or hidden replacement screens.
- Product copy, media, and palette values are editable variables.
- Phone/component carriers that travel across scenes remain one persistent DOM element where possible. If a boundary forces two copies, treat and review it as a match cut.
- Footage grades, grain, blur, and vignettes are baked with HyperFrames media treatment, not CSS filters.
- The 60-second version gets a separate root timeline and compositions that share approved assets; it is not created by changing playback speed.

## Production steps

1. **Lock facts and story.** Confirm release state, exact feature availability, working integrations, pricing language, CTA, master language, and Lola’s role/title. Resolve every `[TBD]` that affects a public claim.
2. **Prepare research ledger.** Map each line in the film to a repo source, direct interview quote, or verified app interaction. Record limitations and consent.
3. **Interview Lola before scripting her.** Record a full conversation, then select truthful lines. Revise the cold open around her actual rhythm rather than forcing the 36-second outline.
4. **Collect documentary footage.** Capture Lola b-roll and any consented field interviews. Back up camera originals and sound separately.
5. **Freeze the demo dataset.** Make one coherent synthetic business state across dashboard, forecast, chat, tools, team, API, and Telegram.
6. **Verify real flows.** Exercise each intended interaction end to end. Remove any shot whose claimed behavior cannot be captured from the release build.
7. **Capture UI.** Record full context first, then component-level assets. Capture mobile and desktop at the matrix sizes with fonts and data fully loaded.
8. **Choose VO and music.** Audition the exact script in ElevenLabs `voicelab`; test Uzbek names and technical terms. License one music track or composition route before edit lock.
9. **Build the radio edit.** Lola sync + VO + room tone + temp music. Confirm 2:50–3:20 without padding.
10. **Build in HyperFrames.** Implement compositions, persistent carriers, real UI interactions, ornaments, captions, and deterministic audio timing.
11. **Editorial review.** Check that pictures alone and words alone each explain the same story; remove repeated captions and any feature-list rhythm.
12. **Fact, consent, and localization review.** Product owner signs off claims; participants sign off public clips; native reviewers approve RU and UZ subtitles.
13. **Visual and audio review.** Inspect every scene and transition at full size and at a 360px feed preview; mix dialogue first, then SFX and music.
14. **Create the 60-second cut.** Rebuild around one complete voice-to-forecast task and preserve the research caveat.
15. **Preview and delivery later.** Run HyperFrames checks and review snapshots, inspect rendered MP4s, verify dimensions/frame rate/duration, then deliver clean and subtitled masters plus editable source. Rendering is outside this planning assignment.

## Open questions

1. What language should Lola speak, and which subtitle masters are required: RU, UZ Latin, EN, or all three?
2. Is “Lola Sayfi, owner of the gallery human house” the exact approved public credit and spelling?
3. Has Lola agreed to appear, and do we have permission for the gallery, artwork, staff, and visitors?
4. Which of the three pain areas has Lola actually experienced: cash surprises, scattered notes, lack of time? What is the last concrete example?
5. Is there a separate `docs/business-dreams.md` or field-research file to supply? The current repo does not contain it.
6. Will real owner interviews be completed before picture lock? If yes, who owns consent, transcription, and RU/UZ translation review?
7. Which app commit and environment represent the release shown in the film?
8. Which features will be demonstrably live at release: voice STT, Telegram brief, generated OpenUI tools, invites, PDF sharing, REST, webhooks, and MCP?
9. What is the exact public docs URL and the real MCP interaction we should capture?
10. Which integrations are working in the release, and which must remain visibly marked `coming soon`?
11. Should the master UI be RU, UZ Latin, or EN? RU is currently the product spec default, but the film audience may suggest UZ.
12. Is the pricing line “roughly 99–199k UZS/month” approved for the film, or should the screen say only “Request access” while pricing is tested?
13. What exact CTA should the end card use: open the public demo, request access, or join a pilot?
14. Which ElevenLabs `voicelab` voice is approved, and may the final VO be English if the primary audience is Uzbek owners?
15. Where will the film run—website, Telegram, event screen, YouTube, paid social—and what loudness, caption, and licensing requirements follow?
16. Do we need a 9:16 or 1:1 version after the 16:9 and 60-second cuts?
17. Who gives final approval for product claims, research wording, Lola’s edit, localization, and brand usage?
