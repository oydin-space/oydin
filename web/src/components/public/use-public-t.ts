"use client";

import { useCallback } from "react";
import { useLocale } from "@/i18n";
import { publicPart } from "@/i18n/parts/public";

export type PublicT = (key: string, params?: Record<string, string | number>) => string;

/** t() для ключей `public.*`: читает срез напрямую, поэтому работает до и после слияния в основной словарь. */
export function usePublicT(): PublicT {
  const [locale] = useLocale();
  return useCallback<PublicT>(
    (key, params) => {
      const dict = publicPart[locale] as Record<string, string>;
      const raw = dict[key] ?? (publicPart.ru as Record<string, string>)[key] ?? key;
      return params ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : raw;
    },
    [locale],
  );
}
