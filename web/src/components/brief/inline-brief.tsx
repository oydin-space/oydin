"use client"

import Link from "next/link"
import { CalendarClock, Maximize2, Wallet } from "lucide-react"
import { Icon, Skeleton, Text } from "@/components/ui"
import { useI18n, useT } from "@/i18n"
import { softSum } from "@/lib/format"
import { ListenBrief } from "./listen-brief"
import { useBriefOverview } from "./use-brief-overview"

/** Home chat lead: the compact "Утренняя сводка" card; the expand icon opens /app/brief. */
export function InlineBrief() {
  const t = useT()
  const { locale, formatDate } = useI18n()
  const { pulse, payments, debtors } = useBriefOverview()
  const p = pulse.data
  if (pulse.error) return null
  if (!p) return <Skeleton className="mx-2 h-[250px] rounded-[28px]" />
  const days = p.gap ? Math.max(Math.floor(p.runway_days ?? 0), 0) : 30
  return (
    <section aria-label={t("biz.home.briefTitle")} className="mx-2 flex flex-col gap-3.5 rounded-[28px] border border-[#F0D878] bg-gradient-to-b from-[#FFF6D0] to-[#FFE58A] p-4 text-[#3b342a] shadow-[0_8px_24px_-12px_rgba(120,90,0,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold leading-tight">{t("biz.home.briefTitle")}</h2>
          <p className="text-small text-[#3b342a]/65">{formatDate(new Date(), { hour: "numeric", minute: "2-digit", day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
        <Link href="/app/brief" aria-label={t("biz.brief.expand")} className="focus-ring press flex size-11 shrink-0 items-center justify-center rounded-pill border border-[#F0D878] bg-[#FFFBEA]">
          <Icon icon={Maximize2} size={20} />
        </Link>
      </div>
      <p className="border-l-[3px] border-[#3b342a]/20 pl-3 text-[16px] leading-snug text-[#3b342a]/85">{p.headline}</p>
      <ul className="flex flex-col gap-2 font-semibold text-[#3b342a]/80">
        {p.revenue_week ? (
          <li className="flex items-center gap-2.5">
            <Icon icon={Wallet} size={20} />
            {t("biz.brief.metricRevenue", { amount: softSum(p.revenue_week.amount, locale) })}
          </li>
        ) : null}
        <li className="flex items-center gap-2.5">
          <Icon icon={CalendarClock} size={20} />
          {t("biz.brief.metricRunway", { n: days })}
        </li>
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text variant="caption" className="text-[#3b342a]/60">{t("biz.brief.readTime")}</Text>
        <ListenBrief pulse={p} payments={payments} debtors={debtors} />
      </div>
    </section>
  )
}
