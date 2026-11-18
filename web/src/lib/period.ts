"use client"

import { useSyncExternalStore } from "react"

export interface Period {
  year: number
  /** 0-based month */
  month: number
}

const now = new Date()
let current: Period = { year: now.getFullYear(), month: now.getMonth() }
const listeners = new Set<() => void>()

export function setPeriod(p: Period): void {
  current = p
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}

/** App-wide selected month (top bar picker). */
export const usePeriod = (): Period => useSyncExternalStore(subscribe, () => current, () => current)

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`

/** ISO date range of the month: { from: first day, to: last day }. */
export function periodRange(p: Period): { from: string; to: string } {
  return { from: iso(p.year, p.month, 1), to: iso(p.year, p.month, new Date(p.year, p.month + 1, 0).getDate()) }
}
