import { en } from "./en"
import { ru, type Dict, type Key } from "./ru"
import { uz } from "./uz"

export type Locale = "ru" | "uz" | "en"
export const LOCALES: readonly Locale[] = ["ru", "uz", "en"]
export const DEFAULT_LOCALE: Locale = "ru"
export const LOCALE_COOKIE = "oydin_lang"
export const LOCALE_LABELS: Record<Locale, string> = { ru: "RU", uz: "UZ", en: "EN" }
export const LOCALE_NAMES: Record<Locale, string> = { ru: "Русский", uz: "Oʻzbekcha", en: "English" }

export const dictionaries: Record<Locale, Dict> = { ru, uz, en }
export type { Dict, Key }

export function parseLocale(value: string | null | undefined): Locale | null {
  if (!value) return null
  const v = value.toLowerCase().replace("_", "-")
  if (v === "uz" || v.startsWith("uz-")) return "uz" // uz-Cyrl is rendered in Latin too
  if (v === "ru" || v.startsWith("ru-")) return "ru"
  if (v === "en" || v.startsWith("en-")) return "en"
  return null
}

export interface DetectSources {
  cookie?: string | null
  telegram?: string | null
  navigator?: string | readonly string[] | null
}

/** Client side of the same rule (cookie → navigator.languages → ru); inside Telegram its language_code goes before navigator. */
export function detectLocale(s: DetectSources): Locale {
  const nav = typeof s.navigator === "string" ? [s.navigator] : [...(s.navigator ?? [])]
  return parseLocale(s.cookie) ?? parseLocale(s.telegram) ?? nav.map(parseLocale).find(Boolean) ?? DEFAULT_LOCALE
}

/** Single first-visit rule for every surface: cookie → Accept-Language (ru/uz/en, in q order) → ru. */
export function resolveLocale(cookie: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  const fromHeader = (acceptLanguage ?? "")
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";")
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="))
      return { tag, q: q ? Number(q.slice(2)) : 1, i }
    })
    .filter((x) => x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
    .map((x) => parseLocale(x.tag))
    .find(Boolean)
  return parseLocale(cookie) ?? fromHeader ?? DEFAULT_LOCALE
}

export function readCookie(source: string, name = LOCALE_COOKIE): string | null {
  const m = source.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${name}=`))
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null
}

export type Params = Record<string, string | number>

const PLURAL_ORDER: Record<Locale, Intl.LDMLPluralRule[]> = {
  ru: ["one", "few", "many"],
  uz: ["one", "other"],
  en: ["one", "other"],
}

function pickPlural(raw: string, locale: Locale, count: number): string {
  const forms = raw.split("|")
  if (forms.length === 1) return raw
  const cat = new Intl.PluralRules(locale === "uz" ? "uz" : locale).select(count)
  const order = PLURAL_ORDER[locale]
  const i = order.indexOf(cat)
  return forms[i === -1 ? forms.length - 1 : Math.min(i, forms.length - 1)]
}

/** Lookup with fallback to ru, then to the key itself. `{name}` interpolation; `a|b|c` plural forms picked by params.count. */
export function translate(locale: Locale, key: Key | (string & {}), params?: Params): string {
  const raw = (dictionaries[locale] as Record<string, string>)[key] ?? (dictionaries.ru as Record<string, string>)[key]
  if (raw === undefined) return key
  const text = typeof params?.count === "number" ? pickPlural(raw, locale, params.count) : raw.split("|")[0]
  return params ? text.replace(/\{(\w+)\}/g, (m, n: string) => (n in params ? String(params[n]) : m)) : text
}

export type TFunction = (key: Key, params?: Params) => string
export const makeT = (locale: Locale): TFunction => (key, params) => translate(locale, key, params)

// ---------- formatting ----------
const INTL: Record<Locale, string> = { ru: "ru-RU", uz: "uz-UZ", en: "en-US" }
const SUM_WORDS: Record<Locale, { k: string; m: string; b: string; sep: string }> = {
  ru: { k: "тыс.", m: "млн", b: "млрд", sep: "\u00a0" },
  uz: { k: "ming", m: "mln", b: "mlrd", sep: "\u00a0" },
  en: { k: "K", m: "M", b: "B", sep: "" },
}
const CUR: Record<Locale, string> = { ru: "сум", uz: "soʻm", en: "UZS" }

export function formatNumber(n: number, locale: Locale, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(INTL[locale], opts).format(n)
}

/** Friendly sum: 3_000_000 → "3 млн" / "3 mln" / "3M"; below 1 000 → grouped integer. Major units. */
export function formatSumShort(n: number, locale: Locale): string {
  const abs = Math.abs(n)
  const w = SUM_WORDS[locale]
  const [div, word] = abs >= 1e9 ? [1e9, w.b] : abs >= 1e6 ? [1e6, w.m] : abs >= 1e3 ? [1e3, w.k] : [1, ""]
  if (!word) return formatNumber(n, locale, { maximumFractionDigits: 0 })
  const v = Math.round((n / div) * 10) / 10
  return `${formatNumber(v, locale, { maximumFractionDigits: 1 })}${w.sep}${word}`
}

/** Exact money, major units: "1 250 000 сум". */
export function formatMoney(n: number, locale: Locale): string {
  return `${formatNumber(n, locale, { maximumFractionDigits: 0 })}\u00a0${CUR[locale]}`
}

const UZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"]

/** Intl's uz-UZ data renders months as "M12" in most engines, so Uzbek is assembled from our own month names. */
export function formatDate(d: Date | string | number, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }): string {
  const o = { timeZone: "Asia/Tashkent", ...opts }
  if (locale !== "uz" || !o.month || o.month === "numeric" || o.month === "2-digit") {
    return new Intl.DateTimeFormat(INTL[locale], o).format(new Date(d))
  }
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: o.timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(d))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const name = UZ_MONTHS[get("month") - 1]
  const month = o.month === "long" ? name : name.slice(0, 3)
  const head = o.day ? `${get("day")}-${month}` : month
  return o.year ? `${get("year")}-yil ${head}` : head
}
