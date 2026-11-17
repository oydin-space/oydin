"use client";

import { useCallback } from "react";
import { useI18n } from "@/i18n";
import { settings } from "@/i18n/parts/settings";
import { ApiError } from "@/lib/api";

export type SKey = keyof typeof settings.ru;
type Params = Record<string, string | number>;

// uz/en обязаны содержать те же ключи, что и ru: иначе ошибка компиляции.
settings.uz satisfies Record<SKey, string>;
settings.en satisfies Record<SKey, string>;

const isKey = (k: string): k is SKey => k in settings.ru;

/**
 * Словарь раздела лежит в i18n/parts/settings.ts и пока не слит в ru/uz/en.ts, поэтому `useT()` его ключей
 * не знает (ни по типам, ни в рантайме). Здесь поиск идёт прямо по части; после слияния поведение то же.
 */
export function useST() {
  const { locale, formatDate, formatNumber } = useI18n();
  const t = useCallback(
    (key: SKey, params?: Params) => {
      const raw: string = settings[locale][key] ?? settings.ru[key];
      return params ? raw.replace(/\{(\w+)\}/g, (m, n: string) => (n in params ? String(params[n]) : m)) : raw;
    },
    [locale],
  );
  /** Текст ошибки: код бэка → http_<status> → общая фраза. */
  const err = useCallback(
    (e: unknown): string => {
      if (e instanceof ApiError) {
        const byCode = `settings.err.${e.message}`;
        if (isKey(byCode)) return t(byCode);
        const byStatus = `settings.err.http_${e.status}`;
        if (isKey(byStatus)) return t(byStatus);
      }
      return t("settings.common.generic");
    },
    [t],
  );
  return { t, err, locale, formatDate, formatNumber };
}
