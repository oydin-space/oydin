"use client"

import { TrendingDown, TrendingUp } from "lucide-react"
import { Icon, Skeleton } from "@/components/ui"
import { useI18n, useT } from "@/i18n"
import { pct } from "@/lib/format"
import type { DayRevenue } from "./overview"

const W = 300
const H = 110
const PAD = 10

/** Weekly revenue: delta badge + yellow line by weekday. */
export function RevenueCard({ days, deltaPct, loading }: { days: DayRevenue[]; deltaPct: number | null | undefined; loading: boolean }) {
  const t = useT()
  const { locale, formatDate } = useI18n()
  const max = Math.max(...days.map((d) => d.amount), 1)
  const x = (i: number) => PAD + (days.length > 1 ? (i / (days.length - 1)) * (W - PAD * 2) : (W - PAD * 2) / 2)
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2)
  const line = days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.amount).toFixed(1)}`).join(" ")
  const empty = !loading && days.every((d) => d.amount === 0)
  const up = (deltaPct ?? 0) >= 0
  return (
    <section className="flex flex-col gap-3 rounded-[24px] border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[19px] font-bold leading-snug">{t("biz.brief.weekRevenue")}</h3>
          <p className="text-small text-muted-foreground">{t("biz.brief.weekRange")}</p>
        </div>
        {deltaPct != null ? (
          <span className={`flex items-center gap-1 text-[19px] font-bold ${up ? "text-[#2E8B57]" : "text-[#C0392B]"}`}>
            <Icon icon={up ? TrendingUp : TrendingDown} size={20} />
            {pct(Math.abs(deltaPct), 1, locale)}
          </span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="h-[130px] w-full rounded-2xl" />
      ) : empty ? (
        <p className="py-6 text-center text-small text-muted-foreground">{t("biz.brief.noRevenue")}</p>
      ) : (
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-[110px] w-full" preserveAspectRatio="none" aria-hidden="true">
            <path d={line} fill="none" stroke="#FFD62C" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <ul className="mt-1 flex justify-between px-[3%] text-caption text-muted-foreground">
            {days.map((d) => (
              <li key={d.date}>{formatDate(new Date(`${d.date}T00:00:00`), { weekday: "short" })}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
