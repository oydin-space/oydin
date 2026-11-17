"use client";

import { useCallback } from "react";
import { useI18n } from "@/i18n";
import { auth } from "@/i18n/parts/auth";

export type AKey = keyof typeof auth.ru;
type Params = Record<string, string | number>;

// uz/en обязаны содержать те же ключи, что и ru: иначе ошибка компиляции.
auth.uz satisfies Record<AKey, string>;
auth.en satisfies Record<AKey, string>;

/** Словарь входа лежит в i18n/parts/auth.ts и пока не слит в ru/uz/en.ts: поиск идёт прямо по части. */
export function useAT() {
  const { locale } = useI18n();
  const t = useCallback(
    (key: AKey, params?: Params) => {
      const raw: string = auth[locale][key] ?? auth.ru[key];
      return params ? raw.replace(/\{(\w+)\}/g, (m, n: string) => (n in params ? String(params[n]) : m)) : raw;
    },
    [locale],
  );
  return { t, locale };
}
