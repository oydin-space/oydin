"use client"

import { useT } from "@/i18n"
import type { Params } from "@/i18n/core"
import type { Key } from "@/i18n/ru"
import type { core } from "@/i18n/parts/core"

export type CoreKey = keyof typeof core.ru

/** `useT()` for the `core.*` slice: typed by the slice itself, so it compiles before the orchestrator merges it. */
export function useCoreT(): (key: CoreKey, params?: Params) => string {
  const t = useT()
  return (key, params) => t(key as Key, params)
}
