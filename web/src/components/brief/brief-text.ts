import { formatDate, formatMoney, type Locale, type TFunction } from "@/i18n/core"
import { todayIso, type PulseData } from "@/lib/core-api"
import type { Commitment, Debtor } from "@/lib/planning-api"

export const UPCOMING_DAYS = 7
const MAX_SPOKEN = 3

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString("sv-SE")
}

/** Active outgoing commitments due within the next week (overdue included), soonest first. */
export function upcomingPayments(items: Commitment[]): Commitment[] {
  const limit = addDays(todayIso(), UPCOMING_DAYS)
  return items.filter((c) => c.active && c.direction === "out" && c.next_date <= limit).sort((a, b) => a.next_date.localeCompare(b.next_date))
}

export const owedTotal = (debtors: Debtor[]) => debtors.reduce((sum, d) => sum + Math.max(d.balance, 0), 0)

interface BriefInput {
  pulse: PulseData
  payments: Commitment[]
  debtors: Debtor[]
}

/** Morning-brief script built from the same data as the Home cards; every sentence is an i18n template. */
export function composeBrief(t: TFunction, locale: Locale, { pulse, payments, debtors }: BriefInput): string {
  const money = (n: number) => formatMoney(n, locale)
  const day = (iso: string) => formatDate(iso, locale, { day: "numeric", month: "long" })
  const parts = [
    t("biz.brief.say.intro"),
    t("biz.brief.say.balance", { amount: money(pulse.balance) }),
    pulse.safe_to_spend > 0 ? t("biz.brief.say.safe", { amount: money(pulse.safe_to_spend) }) : t("biz.brief.say.safeNone"),
    pulse.gap ? t("biz.brief.say.gap", { date: day(pulse.gap.date), amount: money(pulse.gap.amount) }) : t("biz.brief.say.noGap"),
  ]
  if (payments.length) {
    const list = payments.slice(0, MAX_SPOKEN).map((c) => t("biz.brief.say.item", { title: c.title, amount: money(c.amount), date: day(c.next_date) }))
    parts.push(t("biz.brief.say.payments", { count: payments.length, list: list.join("; ") }))
  } else parts.push(t("biz.brief.say.noPayments"))
  const owed = owedTotal(debtors)
  if (owed > 0) parts.push(t("biz.brief.say.debtors", { count: debtors.length, amount: money(owed) }))
  return parts.join(" ")
}
