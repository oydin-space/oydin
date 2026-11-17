import { defaultLocale, dictionaries, speech, type Locale } from "./copy"

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function parseLocale(value: string | undefined): Locale {
  return value === "ru" || value === "uz" || value === "en" ? value : defaultLocale
}

/** Fills {{section.n}} tokens and the CTA/speech placeholders of a landing template. */
export function localize(template: string, locale: Locale): string {
  const dict = dictionaries[locale]
  const tg = process.env.NEXT_PUBLIC_TG_BOT_URL || "/app"
  return template
    .replace(/\{\{([\w.]+)\}\}/g, (_, key: string) => escapeHtml(dict[key] ?? dictionaries[defaultLocale][key] ?? ""))
    .replaceAll("__TG__", escapeHtml(tg))
    .replaceAll("__SPEECH__", escapeHtml(speech[locale].text))
    .replaceAll("__LANG__", speech[locale].lang)
}
