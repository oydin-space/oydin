import { auth } from "./auth"
import { billing } from "./billing"
import { biz } from "./biz"
import { chat } from "./chat"
import { core } from "./core"
import { kit } from "./kit"
import { meta } from "./meta"
import { offline } from "./offline"
import { onboarding } from "./onboarding"
import { plan } from "./plan"
import { publicPart } from "./public"
import { settings } from "./settings"

/** Per-slice dictionaries merged into ru.ts / uz.ts / en.ts. A new slice is added here only. */
export const parts = {
  ru: { ...auth.ru, ...billing.ru, ...biz.ru, ...chat.ru, ...core.ru, ...kit.ru, ...meta.ru, ...offline.ru, ...onboarding.ru, ...plan.ru, ...publicPart.ru, ...settings.ru },
  uz: { ...auth.uz, ...billing.uz, ...biz.uz, ...chat.uz, ...core.uz, ...kit.uz, ...meta.uz, ...offline.uz, ...onboarding.uz, ...plan.uz, ...publicPart.uz, ...settings.uz },
  en: { ...auth.en, ...billing.en, ...biz.en, ...chat.en, ...core.en, ...kit.en, ...meta.en, ...offline.en, ...onboarding.en, ...plan.en, ...publicPart.en, ...settings.en },
} as const
