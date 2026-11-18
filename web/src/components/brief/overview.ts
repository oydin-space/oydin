import type { ForecastResponse, PulseData } from "@/lib/core-api"
import type { Transaction } from "@/lib/types"

export const RUNWAY_DAYS = 30

export interface RunwaySplit {
  reserve: number
  covered: number
  gap: number
  total: number
}

/** Days of the 30-day horizon: own cash (reserve), covered by expected income, uncovered gap. */
export function runwaySplit(pulse: PulseData, points: ForecastResponse["points"]): RunwaySplit {
  const covered = pulse.gap ? Math.min(Math.max(Math.floor(pulse.runway_days ?? 0), 0), RUNWAY_DAYS) : RUNWAY_DAYS
  const outflows = points.map((p) => p.outflow).filter((v) => v > 0)
  const avgOut = outflows.length ? outflows.reduce((a, b) => a + b, 0) / outflows.length : 0
  const reserve = avgOut > 0 ? Math.min(covered, Math.floor(Math.max(pulse.balance, 0) / avgOut)) : covered
  return { reserve, covered: covered - reserve, gap: RUNWAY_DAYS - covered, total: RUNWAY_DAYS }
}

const iso = (d: Date) => d.toLocaleDateString("sv-SE")

/** ISO date of this week's Monday. */
export function weekStart(now = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return iso(d)
}

export interface DayRevenue {
  date: string
  amount: number
}

/** Confirmed business income per day, Monday through today. */
export function weekRevenue(items: Transaction[], now = new Date()): DayRevenue[] {
  const start = new Date(`${weekStart(now)}T00:00:00`)
  const days: DayRevenue[] = []
  for (const d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) days.push({ date: iso(d), amount: 0 })
  for (const tx of items) {
    if (tx.direction !== "in" || tx.status !== "confirmed" || tx.purpose === "personal" || tx.purpose === "owner_contribution") continue
    const day = days.find((x) => x.date === tx.date)
    if (day) day.amount += tx.amount
  }
  return days
}
