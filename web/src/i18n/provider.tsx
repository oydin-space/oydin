"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react"
import {
  DEFAULT_LOCALE, LOCALE_COOKIE, detectLocale, formatDate, formatMoney, formatNumber, formatSumShort, makeT, readCookie,
  type Locale, type TFunction,
} from "./core"

interface I18n {
  locale: Locale
  setLocale: (next: Locale) => void
  t: TFunction
  formatNumber: (n: number, o?: Intl.NumberFormatOptions) => string
  formatSumShort: (n: number) => string
  formatMoney: (n: number) => string
  formatDate: (d: Date | string | number, o?: Intl.DateTimeFormatOptions) => string
}

const Ctx = createContext<I18n | null>(null)

export function persistLocale(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  document.documentElement.lang = next
}

const listeners = new Set<() => void>()
const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => void listeners.delete(cb)
}

function detectClient(): Locale {
  return detectLocale({
    cookie: readCookie(document.cookie),
    telegram: (window as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } } }).Telegram?.WebApp?.initDataUnsafe?.user?.language_code,
    navigator: navigator.languages?.length ? navigator.languages : navigator.language,
  })
}

/** `initial` comes from the server cookie (no flash). Without it the client detects after hydration. */
export function I18nProvider({ initial, children }: { initial?: Locale; children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, detectClient, () => initial ?? DEFAULT_LOCALE)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    persistLocale(next)
    listeners.forEach((l) => l())
  }, [])

  const value = useMemo<I18n>(
    () => ({
      locale, setLocale, t: makeT(locale),
      formatNumber: (n, o) => formatNumber(n, locale, o),
      formatSumShort: (n) => formatSumShort(n, locale),
      formatMoney: (n) => formatMoney(n, locale),
      formatDate: (d, o) => formatDate(d, locale, o),
    }),
    [locale, setLocale],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18n {
  const v = useContext(Ctx)
  if (!v) throw new Error("useI18n must be used inside <I18nProvider>")
  return v
}

/** `const t = useT(); t("nav.operations")` */
export const useT = (): TFunction => useI18n().t
export const useLocale = () => {
  const { locale, setLocale } = useI18n()
  return [locale, setLocale] as const
}
