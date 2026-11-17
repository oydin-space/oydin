"use client";

import { useI18n } from "@/i18n";

type Params = Record<string, string | number>;

/** t для ключей offline.*: слайс подмешивается в словари оркестратором, поэтому типизация ключей здесь ослаблена. */
export function useOfflineT(): (key: string, params?: Params) => string {
  const { t } = useI18n();
  return t as unknown as (key: string, params?: Params) => string;
}
