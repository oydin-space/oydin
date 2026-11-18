import { auth } from "./auth"
import { beginner } from "./beginner"
import { billing } from "./billing"
import { biz } from "./biz"
import { catalog } from "./catalog"
import { chat } from "./chat"
import { core } from "./core"
import { kit } from "./kit"
import { meta } from "./meta"
import { modules } from "./modules"
import { money } from "./money"
import { offline } from "./offline"
import { onboarding } from "./onboarding"
import { people } from "./people"
import { plan } from "./plan"
import { publicPart } from "./public"
import { rollup } from "./rollup"
import { settings } from "./settings"

/** Per-slice dictionaries merged into ru.ts / uz.ts / en.ts. A new slice is added here only. */
export const parts = {
  ru: { ...auth.ru, ...beginner.ru, ...billing.ru, ...biz.ru, ...catalog.ru, ...chat.ru, ...core.ru, ...kit.ru, ...meta.ru, ...modules.ru, ...money.ru, ...offline.ru, ...onboarding.ru, ...people.ru, ...plan.ru, ...publicPart.ru, ...rollup.ru, ...settings.ru },
  uz: { ...auth.uz, ...beginner.uz, ...billing.uz, ...biz.uz, ...catalog.uz, ...chat.uz, ...core.uz, ...kit.uz, ...meta.uz, ...modules.uz, ...money.uz, ...offline.uz, ...onboarding.uz, ...people.uz, ...plan.uz, ...publicPart.uz, ...rollup.uz, ...settings.uz },
  en: { ...auth.en, ...beginner.en, ...billing.en, ...biz.en, ...catalog.en, ...chat.en, ...core.en, ...kit.en, ...meta.en, ...modules.en, ...money.en, ...offline.en, ...onboarding.en, ...people.en, ...plan.en, ...publicPart.en, ...rollup.en, ...settings.en },
} as const
