# i18n

Dependency-free, typed. Locales: `ru` (default), `uz` (Latin only), `en`. `ru.ts` defines the key shape; `uz.ts`/`en.ts` must satisfy `Dict` (compile error on a missing key).

```tsx
import { useT, useI18n } from "@/i18n"

const t = useT()
t("nav.operations")                         // "Операции" | "Operatsiyalar" | "Operations"
t("auth.codeSent", { phone })               // {name} interpolation
t("common.days", { count: 3 })              // plural: "one|few|many" (ru), "one|other" (uz, en)

const { formatSumShort, formatMoney, formatDate, locale, setLocale } = useI18n()
formatSumShort(3_000_000)                   // "3 млн" | "3 mln" | "3M"
```

Switcher: `import { LanguageSwitcher } from "@/components/ui"`. Detection: cookie `oydin_lang` → Telegram `language_code` → `navigator.language` → `ru`. Missing keys fall back to ru, then to the key. Pure helpers (`translate`, `detectLocale`, `formatSumShort`) live in `core.ts` and are tested in `i18n.test.ts` (`bun test src/i18n`).
