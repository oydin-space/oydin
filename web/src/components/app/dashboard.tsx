"use client"

import { useMemo, useState } from "react"
import { useCoreT } from "@/components/app/use-core-t"
import { EntrySheet, type EntrySeed } from "@/components/operations/entry-sheet"
import { Card, CashChart, ErrorState, PAGE_WIDTH, Section, SkeletonCard, SkeletonChart } from "@/components/ui"
import { useI18n } from "@/i18n"
import { cashPoints, isEmptyBusiness, todayIso, type ForecastResponse, type PulseData } from "@/lib/core-api"
import { dayMonth } from "@/lib/format"
import { periodRange, usePeriod } from "@/lib/period"
import type { SavedTool } from "@/lib/tools-api"
import type { Account, Insight, Transaction } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { MorningBrief } from "@/components/brief/morning-brief"
import { UpcomingCard } from "@/components/brief/upcoming-card"
import { useBriefData } from "@/components/brief/use-brief-data"
import { BriefCards, BriefCardsSkeleton } from "./brief-cards"
import { FirstSteps } from "./first-steps"
import { InsightsSection } from "./insights-section"
import { PeriodButton } from "./period-picker"
import { PulseDetails, PulseHero, PulseHeroSkeleton } from "./pulse-hero"
import { QuickAdd } from "./quick-add"

export function Dashboard() {
  const t = useCoreT()
  const { locale } = useI18n()
  const range = periodRange(usePeriod())
  const pulse = useApi<PulseData>(`/dashboard/pulse/?from=${range.from}&to=${range.to}`)
  const insights = useApi<{ items: Insight[] }>("/insights/")
  const accounts = useApi<{ items: Account[] }>("/accounts/")
  const forecast = useApi<ForecastResponse>("/forecast/?days=30")
  const recent = useApi<{ items: Transaction[] }>("/transactions/?limit=1")
  const tools = useApi<SavedTool[]>("/tools/")
  const brief = useBriefData()
  const [sheet, setSheet] = useState<{ n: number; seed: EntrySeed } | null>(null)
  const open = (seed: EntrySeed = {}) => setSheet((s) => ({ n: (s?.n ?? 0) + 1, seed }))

  const points = useMemo(() => {
    const f = forecast.data?.points ?? []
    return pulse.data && f.length ? cashPoints(todayIso(), pulse.data.balance, f, (iso) => dayMonth(iso, locale, "short")) : []
  }, [forecast.data, pulse.data, locale])

  const reload = () => {
    pulse.reload()
    insights.reload()
    forecast.reload()
    recent.reload()
    tools.reload()
  }
  const accs = accounts.data?.items ?? []
  const ready = pulse.data && accounts.data && recent.data
  const empty = ready && isEmptyBusiness(accs, recent.data!.items.length)
  const pinned = (Array.isArray(tools.data) ? tools.data : []).filter((x) => x.pinned)

  let body: React.ReactNode
  if (pulse.error) body = <ErrorState message={pulse.error} onRetry={reload} retryLabel={t("core.retry")} />
  else if (!ready)
    body = (
      <div className="flex flex-col gap-4">
        <PulseHeroSkeleton />
        <BriefCardsSkeleton />
        <SkeletonCard />
        <SkeletonChart />
      </div>
    )
  else if (empty) body = <FirstSteps onEntry={() => open()} />
  else
    body = (
      <div className="flex flex-col gap-4">
        <MorningBrief pulse={pulse.data!} payments={brief.payments} debtors={brief.debtors} />
        <PulseHero pulse={pulse.data!} />
        <QuickAdd onEntry={(direction) => open({ values: { direction } })} />
        <BriefCards pulse={pulse.data!} tools={pinned} />
        <div className="mt-2 flex flex-col gap-6">
          <UpcomingCard payments={brief.payments} debtors={brief.debtors} />
          <PulseDetails pulse={pulse.data!} />
          {points.length ? (
            <Section icon="wallet" title={t("core.dash.cashTitle")}>
              <Card>
                <CashChart points={points} label={t("core.dash.cashLabel")} todayLabel={t("core.today")} />
              </Card>
            </Section>
          ) : null}
          <InsightsSection items={insights.data?.items ?? []} />
        </div>
      </div>
    )

  return (
    <div className={`${PAGE_WIDTH} flex flex-col gap-4`}>
      <h1 className="sr-only">{t("core.dash.title")}</h1>
      <PeriodButton className="hidden justify-end md:flex" />
      {body}
      {sheet ? <EntrySheet key={sheet.n} accounts={accs} seed={sheet.seed} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); reload() }} /> : null}
    </div>
  )
}
