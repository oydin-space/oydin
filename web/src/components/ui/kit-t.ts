"use client";

import { useCallback } from "react";
import { useI18n, type Locale } from "@/i18n";
import { kit } from "@/i18n/parts/kit";

export type KitKey = keyof (typeof kit)["ru"];

/** Текущий язык интерфейса; вне I18nProvider — RU. */
export function useKitLocale(): Locale {
  try {
    return useI18n().locale; // eslint-disable-line react-hooks/rules-of-hooks
  } catch {
    return "ru";
  }
}

/** t() для ключей `kit.*`; вне I18nProvider безопасно падает на RU. */
export function useKitT() {
  const locale = useKitLocale();
  return useCallback((key: KitKey): string => (kit[locale] as Record<string, string>)[key] ?? kit.ru[key], [locale]);
}
