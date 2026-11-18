export const MAX_DAYS = 90

export const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d + n).toLocaleDateString("sv-SE")
}

/** A typed date counts only when complete and within tomorrow..today+MAX_DAYS (ISO strings compare lexically). */
export const isValidUntil = (v: string, today: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= addDays(today, 1) && v <= addDays(today, MAX_DAYS)

/** The "lowest point" row is redundant when it is the end line itself. */
export const hideLowLine = (low: { date: string; balance: number }, until: string, endBalance: number) =>
  low.date === until && low.balance === endBalance
