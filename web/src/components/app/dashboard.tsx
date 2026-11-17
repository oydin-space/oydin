"use client"

import { useMemo, useState } from "react"
import { useCoreT } from "@/components/app/use-core-t"
import { EntrySheet, type EntrySeed } from "@/components/operations/entry-sheet"
import { Card, CashChart, ErrorState, PageHeader, Section, SkeletonCard, SkeletonChart } from "@/components/ui"
import { useI18n } from "@/i18n"
import { cashPoints, isEmptyBusiness, todayIso, type ForecastResponse, type PulseData } from "@/lib/core-api"
import type { Account, Insight, Transaction } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { FirstSteps } from "./first-steps"
import { GapCallout } from "./gap-callout"
import { InsightsSection } from "./insights-section"
import { PulseHero } from "./pulse-hero"
import { QuickAdd } from "./quick-add"

export function Dashboard() {
  const t = useCoreT()
  const { formatDate } = useI18n()
  const pulse = useApi<PulseData>("/dashboard/pulse/")
  const insights = useApi<{ items: Insight[] }>("/insights/")
  const accounts = useApi<{ items: Account[] }>("/accounts/")
  const forecast = useApi<ForecastResponse>("/forecast/?days=30")
  const recent = useApi<{ items: Transaction[] }>("/transactions/?limit=1")
  const [sheet, setSheet] = useState<{ n: number; seed: EntrySeed } | null>(null)
  const open = (seed: EntrySeed = {}) => setSheet((s) => ({ n: (s?.n ?? 0) + 1, seed }))

  const points = useMemo(() => {
    const f = forecast.data?.points ?? []
    return pulse.data && f.length ? cashPoints(todayIso(), pulse.data.balance, f, formatDate) : []
  }, [forecast.data, pulse.data, formatDate])

  const reload = () => {
    pulse.reload()
    insights.reload()
    forecast.reload()
    recent.reload()
  }
  const accs = accounts.data?.items ?? []
  const ready = pulse.data && accounts.data && recent.data
  const empty = ready && isEmptyBusiness(accs, recent.data!.items.length)

  let body: React.ReactNode
  if (pulse.error) body = <ErrorState message={pulse.error} onRetry={reload} retryLabel={t("core.retry")} />
  else if (!ready)
    body = (
      <div className="flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonChart />
        <SkeletonCard />
      </div>
    )
  else if (empty) body = <FirstSteps onEntry={() => open()} />
  else
    body = (
      <div className="flex flex-col gap-6">
        <PulseHero pulse={pulse.data!} />
        <GapCallout gap={pulse.data!.gap} />
        {points.length ? (
          <Section title={t("core.dash.cashTitle")}>
            <Card>
              <CashChart points={points} label={t("core.dash.cashLabel")} todayLabel={t("core.today")} />
            </Card>
          </Section>
        ) : null}
        <QuickAdd onDraft={(draft) => open({ values: draft })} onManual={() => open()} />
        <InsightsSection items={insights.data?.items ?? []} />
      </div>
    )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-6">
      <PageHeader title={t("core.dash.title")} hint={t("core.dash.hint")} />
      {body}
      {sheet ? <EntrySheet key={sheet.n} accounts={accs} seed={sheet.seed} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); reload() }} /> : null}
    </div>
  )
}
