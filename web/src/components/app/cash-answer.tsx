"use client"

import { CalendarDays, ChevronDown, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { useCoreT, type CoreKey } from "@/components/app/use-core-t"
import { AmountText, ErrorState, Icon, Skeleton, Text } from "@/components/ui"
import { useI18n } from "@/i18n"
import { dayMonth, money } from "@/lib/format"
import { todayIso } from "@/lib/core-api"
import type { TodayAnswer, TodayItem } from "@/lib/today-api"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

import { addDays, hideLowLine, isValidUntil, MAX_DAYS } from "@/components/app/cash-answer-logic"
const weekday = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).getDay()
}

export function CashAnswerSkeleton() {
  return <Skeleton className="h-[220px] w-full rounded-[28px]" aria-hidden="true" />
}

function Line({ label, hint, value, strong }: { label: string; hint?: string; value: number; strong?: boolean }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <Text variant="secondary" weight={strong ? "bold" : "regular"} className="break-words">{label}</Text>
        {hint ? <Text variant="caption" tone="muted">{hint}</Text> : null}
      </div>
      <AmountText value={value} signed={!strong} tone={strong ? "none" : "auto"} className={cn("shrink-0 text-small", strong && "font-bold")} />
    </li>
  )
}

/** The owner's main question and its one worked answer: how much is free to take until the salary/rent date. */
export function CashAnswer({ until, onUntil }: { until: string | null; onUntil: (iso: string) => void }) {
  const t = useCoreT()
  const { locale } = useI18n()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const today = todayIso()
  const res = useApi<TodayAnswer>(`/planning/today/${until ? `?until=${until}` : ""}`)
  const a = res.data
  const date = (iso: string) => dayMonth(iso, locale)
  const itemHint = (i: TodayItem) => (i.source === "average" && i.per_day != null && i.days != null ? t("core.cash.perDay", { perDay: money(i.per_day, locale), days: i.days }) : i.date ? date(i.date) : undefined)

  let content: React.ReactNode
  if (res.error) content = <ErrorState message={t("core.cash.err")} onRetry={res.reload} retryLabel={t("core.retry")} />
  else if (!a || res.loading) content = <CashAnswerSkeleton />
  else {
    const gap = a.verdict === "gap" && a.gap
    const hasLines = a.items.length > 0
    content = (
      <>
        {gap ? (
          <div className="flex items-start gap-3 rounded-2xl bg-warning/15 p-3">
            <Icon icon={TriangleAlert} size={20} className="mt-0.5 shrink-0 text-foreground" />
            <div className="min-w-0">
              <Text variant="body" weight="bold">{t("core.cash.gap", { date: date(gap.date), amount: money(gap.amount, locale) })}</Text>
              <Text variant="caption" tone="muted" className="mt-1">{t("core.cash.gapHint")}</Text>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <AmountText value={a.can_take} className="text-[40px] font-bold leading-none md:text-[52px]" />
            <Text variant="caption" tone="muted">{t(a.verdict === "tight" ? "core.cash.tight" : "core.cash.ok")}</Text>
          </div>
        )}
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="focus-ring -mx-1 inline-flex min-h-11 items-center gap-2 self-start rounded-pill px-3 text-small font-semibold">
          {t(open ? "core.cash.less" : "core.cash.more")}
          <Icon icon={ChevronDown} size={16} className={cn("transition-transform", open && "rotate-180")} />
        </button>
        {open ? (
          <div className="flex flex-col">
            <ul className="divide-y divide-border">
              <Line label={t("core.cash.balance")} hint={date(a.as_of)} value={a.balance} strong />
              {a.items.map((i, n) => (
                <Line key={`${i.source}-${i.ref_id ?? i.kind}-${n}`} label={i.title} hint={itemHint(i) === i.title ? undefined : itemHint(i)} value={i.amount} />
              ))}
              {hasLines ? null : (
                <li className="py-2.5"><Text variant="caption" tone="muted">{t("core.cash.empty")}</Text></li>
              )}
              <Line label={t("core.cash.end")} hint={date(a.until)} value={a.totals.end_balance} strong />
              {hideLowLine(a.low, a.until, a.totals.end_balance) ? null : <Line label={t("core.cash.low")} hint={date(a.low.date)} value={a.low.balance} strong />}
              <Line label={t("core.cash.tax")} value={-a.tax_reserve} />
            </ul>
          </div>
        ) : null}
      </>
    )
  }

  const shown = until ?? a?.until
  return (
    <section className="flex flex-col gap-3 rounded-[28px] border border-border bg-card p-5 md:p-6">
      <h2 className="text-section font-semibold leading-snug">
        {shown ? t(until || (a && a.until_reason !== "salary_rent") ? "core.cash.askNeutral" : "core.cash.ask", { when: t(`core.cash.w${weekday(shown)}` as CoreKey), date: date(shown) }) : <Skeleton className="h-12 w-full" aria-hidden="true" />}
      </h2>
      <label className="focus-within:ring-2 relative inline-flex min-h-11 w-full max-w-xs items-center gap-2 self-start rounded-pill bg-muted px-4 text-caption font-medium">
        <Icon icon={CalendarDays} size={16} className="shrink-0" />
        <span className="text-muted-foreground">{t("core.cash.chip")}</span>
        <input
          type="date"
          aria-label={t("core.cash.chipHint")}
          min={addDays(today, 1)}
          max={addDays(today, MAX_DAYS)}
          value={draft ?? shown ?? ""}
          onChange={(e) => { const v = e.target.value; setDraft(v); if (isValidUntil(v, today)) onUntil(v) }}
          onBlur={() => setDraft(null)}
          className="min-h-11 min-w-0 flex-1 bg-transparent text-right outline-none"
        />
      </label>
      {content}
    </section>
  )
}
