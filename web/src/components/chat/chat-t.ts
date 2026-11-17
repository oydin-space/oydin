"use client";

import { useCallback } from "react";
import { translate, useI18n, type Locale } from "@/i18n";
import type { chat } from "@/i18n/parts/chat";

export type ChatKey = keyof (typeof chat)["ru"];

/** t() для частей `chat.ui.*`/`chat.tools.*`: до слияния частей типы Key их не знают (как usePlanT). */
export function useChatT() {
  const { locale } = useI18n();
  return useCallback((key: ChatKey, params?: Record<string, string | number>) => translate(locale as Locale, key as never, params), [locale]);
}
