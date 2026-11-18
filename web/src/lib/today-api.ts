/** GET /api/planning/today/: how much can be taken today and what the answer is made of. All money is integer UZS. */
export interface TodayItem {
  date: string | null
  title: string
  kind: string
  amount: number
  source: "obligation" | "order" | "average"
  ref_id: number | null
  /** Only on averaged lines. */
  days?: number
  per_day?: number
}

export interface TodayAnswer {
  as_of: string
  until: string
  until_reason: "salary_rent" | "friday" | "param"
  balance: number
  can_take: number
  verdict: "ok" | "tight" | "gap"
  low: { date: string; balance: number }
  gap: { date: string; amount: number } | null
  tax_reserve: number
  items: TodayItem[]
  totals: { inflow: number; outflow: number; end_balance: number }
}
