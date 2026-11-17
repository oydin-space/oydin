# OpenUI research for Oydin

Scope: OpenUI Lang, `@openuidev` packages, the React runtime, component library definition, system prompt generation, streaming, and the CLI. Versions and sources are as observed on the date of the fetch.

## Summary
- Oydin can render AI answers as OpenUI components (charts, tables, sliders, plan cards) with the React `Renderer`.
- Sliders and inputs recompute **in the browser** through `$variables` and expressions. The model is not called again on each change. Pinned calculators are persisted as the OpenUI program text, then re-rendered from it.
- The stack needs a `zustand` version compatible with `react-ui`'s peer range, plus `zod`. The current `web/package.json` has neither.
- Decision needed: the docs' default LLM path is the OpenUI Gateway (thesys, a paid third-party service). `docs/decisions.md` says the LLM is via OpenRouter. The recommended path below uses OpenRouter with `generateSystemPrompt` from `@openuidev/lang-core`.

## Versions (npm registry `latest`, fetched)
| Package | Version | Role |
|---|---|---|
| `@openuidev/react-ui` | 0.18.9 | Prebuilt components (`openuiLibrary`), `AgentInterface` chat |
| `@openuidev/react-lang` | 1.1.1 | `Renderer`, `defineComponent`, `defineFunction`, `createLibrary`, `buildMessage`, `parseMessage` |
| `@openuidev/lang-core` | 1.1.1 | `generateSystemPrompt` for Node/Edge backends |
| `@openuidev/react-headless` | 0.18.9 | Headless hooks (peer of react-ui) |
| `@openuidev/cli` | 0.6.3 | `openui generate` (prompt and spec), `create`, `deploy` |
| `zod` | 4.6.7 | Schemas. Import as `zod/v4` |
| `zustand` | 5.1.0 per registry `latest` | **See the compatibility note below** |

Source: `https://registry.npmjs.org/@openuidev/<pkg>/latest`, `https://registry.npmjs.org/zod/latest`, `https://registry.npmjs.org/zustand/latest`.

## Compatibility with `web/package.json`
Current `web/package.json`: `next` 16.4.5, `react` / `react-dom` 19.3.0, `@types/react` 19.3.0, `typescript` 5.9.3, `tailwindcss` 4.3.5, `recharts` 3.11.0, `motion` 14.14.0. Package manager `bun@1.4.4`.

Peer ranges (from each package's `package.json` on the registry):
- `@openuidev/react-ui` 0.18.9: `react ^18.3.1 || ^19.0.0`, `react-dom ^18.0.0 || ^19.0.0`, `zustand ^4.5.5` (required), `zod ^3.25.0 || ^4.0.0`, `@openuidev/react-lang >=1.0.0 <2.0.0`, `@openuidev/react-headless >=0.18.2 <0.19.0`.
- `@openuidev/react-lang` 1.1.1: `react *`, optional `react-dom`.
- `@openuidev/react-headless` 0.18.9: `react ^18.3.1 || ^19.0.0`, `zustand ^4.5.5`, optional `ai`.

Compatibility findings:
- React 19.3 and zod 4 satisfy the peers.
- `zustand`: react-ui requires `^4.5.5`, which resolves to the latest 4.x (not 5.x). The registry `latest` I fetched shows 5.1.0, which falls outside that range. Install `zustand@^4` explicitly, or check the 4.x line. **Not verified:** the exact latest 4.x version.
- `zustand` is missing from `web/package.json`. Add it.
- The `@openuidev/*` packages are not in `web/package.json`. Add them.
- `react-lang` depends on `@openuidev/devtools` ^0.3.1 and `@openuidev/observability` ^0.0.4, which installs transitively.

## Install
```bash
cd web
bun add @openuidev/react-lang@^1.1.1 @openuidev/react-ui@^0.18.9 zod@^4.6.7 "zustand@^4.5.5"
# Backend prompt generation (Node/Edge). Run in the backend package that builds the prompt:
bun add @openuidev/lang-core@^1.1.1
```
Note: `bun add` here is the install command, not a build or test. I did not run it.

Prompt generation CLI (docs, `getting-started`):
```bash
npx @openuidev/cli@latest generate ./src/lib/openui.tsx --spec --out src/lib/openui.spec.json
npx @openuidev/cli@latest generate ./src/lib/openui.tsx --out system-prompt.txt
```
Sources: `https://www.openui.com/docs/api-reference/cli`, `https://www.openui.com/docs/getting-started`.

## Library definition (Oydin custom components)
Based on `https://www.openui.com/docs/openui-lang/defining-components` and `https://www.openui.com/docs/openui-lang/functions`. Key order in `z.object({...})` is the positional argument order in OpenUI programs.

```tsx
// web/src/lib/openui-library.tsx
"use client";
import { defineComponent, defineFunction, createLibrary } from "@openuidev/react-lang";
import { openuiLibrary } from "@openuidev/react-ui";
import { z } from "zod/v4";

const Stat = defineComponent({
  name: "Stat",
  description: "Metric label and value in UZS.",
  props: z.object({ label: z.string(), value: z.number() }),
  component: ({ props }) => (
    <div>
      <div>{props.label}</div>
      <strong>{props.value.toLocaleString("ru-RU")} UZS</strong>
    </div>
  ),
});

const PlanCard = defineComponent({
  name: "PlanCard",
  description: "A financial plan with a title and a monthly amount.",
  props: z.object({ title: z.string(), monthly: z.number() }),
  component: ({ props }) => <div><b>{props.title}</b> {props.monthly}</div>,
});

const Percent = defineFunction({
  name: "Percent",
  description: "Formats part / total as a percentage",
  params: z.object({ part: z.number(), total: z.number().default(100) }),
  returns: z.string(),
  fn: ({ part, total }) => `${((part / total) * 100).toFixed(1)}%`,
});

export const oydinLibrary = openuiLibrary.extend({
  components: [Stat, PlanCard],
  functions: [Percent],
});
```

Notes:
- `openuiLibrary.extend({ components, functions, actions })` is documented in `https://www.openui.com/docs/openui-lang/actions` (its example uses `openuiLibrary.extend({ actions: { add: [...] } })`). The `components` and `functions` keys are **not verified** against the 0.18.9 type definitions.
- `Chart`, `Table`, `Slider`, and `Calculator` are not all confirmed as built-ins. The docs confirm `LineChart(xs, [Series(...)])`, `Table([Col(...)])`, `Select`, `Input`, and `Callout`. Oydin's `Calculator` is best built as a custom component (see Interactive state).
- Custom library from scratch: `createLibrary({ root: "Stat", components: [Stat, PlanCard], functions: [Percent] })`. Use `root` for the top-level component.

## Interactive state (sliders)
Do sliders recompute client-side? **Yes.** The model writes `$variables` and expressions once. The browser recomputes on every change, with no model call.

Program (model output, docs `reactive-state`):
```text
$rate = 10
$amount = 1000000
result = Stat("Profit (UZS)", $amount * $rate / 100)
slider = Slider("rate", $rate)
```

A custom reactive slider component (`reactive()` marks the prop bindable to `$var`; docs `interactivity`):
```tsx
import { reactive, useStateField } from "@openuidev/react-lang";
const RangeSlider = defineComponent({
  name: "RangeSlider",
  props: z.object({ name: z.string(), value: reactive(z.number().optional()) }),
  component: ({ props }) => {
    const f = useStateField(props.name, props.value);
    return (
      <input
        type="range"
        min={0} max={100}
        value={f.value ?? 0}
        onChange={(e) => f.setValue(Number(e.target.value))}
      />
    );
  },
});
```

Expression and reset support: `@Set($var, value)`, `@Reset($a, $b)`, `@Round(n, d)`, `@Sum`, `@Filter`. Source: `https://www.openui.com/docs/openui-lang/reactive-state`, `https://www.openui.com/docs/openui-lang/actions`.

## Streaming render (React)
```tsx
"use client";
import { Renderer } from "@openuidev/react-lang";
import { oydinLibrary } from "@/lib/openui-library";

export function AssistantAnswer({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <Renderer
      library={oydinLibrary}
      response={text}
      isStreaming={streaming}
      onError={(err) => console.warn("openui", err)}
    />
  );
}
```
- The parser re-runs on each chunk. Invalid partial parts are dropped while streaming.
- `onError` surfaces errors that can be fed back to the LLM for correction.
Sources: `https://www.openui.com/docs/openui-lang/renderer`, `https://www.openui.com/docs/openui-lang/architecture`.

## System prompt generation (backend, OpenRouter path)
```ts
// backend or Next route handler (Node/Edge)
import { generateSystemPrompt } from "@openuidev/lang-core";
import type { LibrarySpec } from "@openuidev/lang-core";
import spec from "./openui.spec.json"; // produced by the CLI command above

export const systemPrompt = generateSystemPrompt({
  library: spec as LibrarySpec,
  promptOptions: {
    preamble: "You are Oydin, a finance assistant for small businesses in Uzbekistan. Reply in the user's language (RU/UZ/EN). Amounts are integer UZS.",
    additionalRules: ["Use $variables for any value the user may adjust."],
  },
});
```
Then send it as the system message to OpenRouter (`https://openrouter.ai/api/v1/chat/completions`, OpenAI-compatible) through `openai` SDK `baseURL: "https://openrouter.ai/api/v1"`. The OpenRouter call is not verified against a live key.

Gateway alternative (not recommended under current decisions): `new OpenAI({ apiKey: process.env.THESYS_API_KEY, baseURL: "https://api.thesys.dev/v1/embed" })`, with the key from `npx @openuidev/cli@latest generate-api-key`. It is a paid third-party service.
Sources: `https://www.openui.com/docs/openui-lang/system-prompts`, `https://www.openui.com/docs/api-reference/cli`.

## Persistence and re-render
- Store the raw OpenUI program text, not the rendered DOM. Save it with `buildMessage({ content, context, attributes, end })`, and read it back with `parseMessage(stored)` (`@openuidev/react-lang`).
- Persist slider state separately: `<Renderer initialState={savedState} onStateUpdate={(s) => save(s)} />`.
- Strip `]]>openui:` markers before sending history to the model.
- Pinned calculators: store `{ program, state }` per pin and re-render with `initialState`.
Source: `https://www.openui.com/docs/openui-lang/message-protocol`, `https://www.openui.com/docs/openui-lang/renderer`.

## Queries and mutations (optional, not needed for MVP)
`Query("tool", {args}, default)` and `Mutation(...)` with `@Run(ref)`. The browser calls `toolProvider` functions directly, without a model call. Source: `https://www.openui.com/docs/openui-lang/queries-mutations`.

## Sources
- https://www.openui.com/docs/getting-started
- https://www.openui.com/docs/openui-lang
- https://www.openui.com/docs/openui-lang/defining-components
- https://www.openui.com/docs/openui-lang/system-prompts
- https://www.openui.com/docs/openui-lang/renderer
- https://www.openui.com/docs/openui-lang/architecture
- https://www.openui.com/docs/openui-lang/specification
- https://www.openui.com/docs/openui-lang/reactive-state
- https://www.openui.com/docs/openui-lang/functions
- https://www.openui.com/docs/openui-lang/interactivity
- https://www.openui.com/docs/openui-lang/message-protocol
- https://www.openui.com/docs/openui-lang/queries-mutations
- https://www.openui.com/docs/openui-lang/actions
- https://www.openui.com/docs/api-reference/cli
- npm registry: `@openuidev/react-ui`, `@openuidev/react-lang`, `@openuidev/lang-core`, `@openuidev/react-headless`, `@openuidev/cli`, `zod`, `zustand`

## Not verified
- No install, build, test, or render was run. Nothing was edited in the repo.
- `openuiLibrary` built-in list (exact `Chart`, `Table`, `Slider`, `Stat` names and argument order) is not confirmed. The docs pages `/docs/react-lang`, `/docs/openui-lang/components`, and `/docs/openui-lang/built-in-components` returned 404.
- `openuiLibrary.extend({ components, functions })` typing against 0.18.9 was not checked.
- Latest 4.x `zustand` version, and whether `react-ui` 0.18.9 works with it, were not checked.
- No live OpenRouter or Gateway call. No key was tested.
- No check of Next 16 rendering, Russian/Uzbek locale output, 375px / 1280px layouts, or the browser behavior of `Renderer` in the `"use client"` boundary.
- `docs/openapi.yaml` contract changes for calculator persistence were not drafted.
- Save step: the researcher has no write tool. The main agent must save this text to `local://research-openui.md`.