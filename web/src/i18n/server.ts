import { cookies, headers } from "next/headers"
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./core"

/** Server-side locale: cookie, else Accept-Language among ru/uz/en, else ru. */
export async function getServerLocale(): Promise<Locale> {
  const [c, h] = await Promise.all([cookies(), headers()])
  return resolveLocale(c.get(LOCALE_COOKIE)?.value, h.get("accept-language"))
}
