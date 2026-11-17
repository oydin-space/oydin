import type { Account, Pulse, Transaction } from "./types"

/** Pulse plus optional fields the backend may add; the kit never shows them when absent. */
export type PulseData = Pulse & { tax_reserved?: number | null; cash_difference?: number | null }

export interface ForecastResponse {
  points: { date: string; balance: number; inflow: number; outflow: number }[]
}

export interface TxGroup {
  date: string
  items: Transaction[]
}

/** Items arrive newest first; keep order, bucket by ISO date. */
export function groupByDate(items: Transaction[]): TxGroup[] {
  const groups: TxGroup[] = []
  for (const tx of items) {
    const last = groups[groups.length - 1]
    if (last && last.date === tx.date) last.items.push(tx)
    else groups.push({ date: tx.date, items: [tx] })
  }
  return groups
}

/** Cash chart points: today's balance as the "actual" anchor, then the forecast line. */
export function cashPoints(today: string, balance: number, forecast: ForecastResponse["points"], fmt: (iso: string) => string) {
  return [{ date: fmt(today), actual: balance, forecast: balance }, ...forecast.filter((p) => p.date !== today).map((p) => ({ date: fmt(p.date), forecast: p.balance }))]
}

/** A business with no accounts or no entries gets the first-steps checklist instead of an empty dashboard. */
export const isEmptyBusiness = (accounts: Account[], transactions: number) => accounts.length === 0 || transactions === 0

export const currencyOf = (accounts: Account[], accountId: number | null) => accounts.find((a) => a.id === accountId)?.currency ?? "UZS"

export const todayIso = () => new Date().toLocaleDateString("sv-SE")
