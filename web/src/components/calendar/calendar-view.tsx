"use client"

import { useMemo } from "react"
import { useCoreT, type CoreKey } from "@/components/app/use-core-t"
import { AmountText, Badge, Card, CashChart, EmptyState, EnvelopeProgress, ErrorState, ListGroup, ListRow, PageHeader, Section, SkeletonCard, SkeletonChart, SkeletonList, Text } from "@/components/ui"
import { cashPoints, todayIso, type ForecastResponse } from "@/lib/core-api"
import { useI18n } from "@/i18n"
import type { Envelope, Obligation } from "@/lib/types"
import { useApi } from "@/lib/use-api"

function ObligationBadge({ o }: { o: Obligation }) {
  const t = useCoreT()
  if (o.status === "paid") return <Badge tone="positive">{t("core.cal.paid")}</Badge>
  if (o.status === "overdue") return <Badge tone="negative">{t("core.cal.overdue")}</Badge>
  return <Badge tone={o.covered ? "positive" : "caution"}>{o.covered ? t("core.cal.covered") : t("core.cal.notCovered")}</Badge>
}

export function CalendarView() {
  const t = useCoreT()
  const { formatDate, formatSumShort } = useI18n()
  const forecast = useApi<ForecastResponse>("/forecast/?days=30")
  const obligations = useApi<{ items: Obligation[] }>("/obligations/")
  const envelopes = useApi<{ items: Envelope[] }>("/envelopes/")

  const points = useMemo(() => {
    const f = forecast.data?.points ?? []
    return f.length ? cashPoints(todayIso(), f[0].balance, f, formatDate) : []
  }, [forecast.data, formatDate])

  const error = forecast.error ?? obligations.error ?? envelopes.error
  const reload = () => {
    forecast.reload()
    obligations.reload()
    envelopes.reload()
  }
  const loading = (forecast.loading && !forecast.data) || (obligations.loading && !obligations.data) || (envelopes.loading && !envelopes.data)

  let body: React.ReactNode
  if (error) body = <ErrorState message={error} onRetry={reload} retryLabel={t("core.retry")} />
  else if (loading)
    body = (
      <div className="flex flex-col gap-4">
        <SkeletonChart />
        <SkeletonList rows={4} />
        <SkeletonCard />
      </div>
    )
  else {
    const obs = obligations.data?.items ?? []
    const envs = envelopes.data?.items ?? []
    body = (
      <div className="flex flex-col gap-6">
        {points.length ? (
          <Section title={t("core.cal.forecastTitle")}>
            <Card>
              <CashChart points={points} label={t("core.cal.forecastLabel")} todayLabel={t("core.today")} />
            </Card>
          </Section>
        ) : null}
        <Section title={t("core.cal.obligationsTitle")}>
          {obs.length ? (
            <ListGroup>
              {obs.map((o) => (
                <ListRow
                  key={o.id}
                  title={o.title}
                  subtitle={`${t(`core.cal.kind.${o.kind}` as CoreKey)} · ${t("core.cal.due", { date: formatDate(o.due_date) })}`}
                  status={<ObligationBadge o={o} />}
                  trailing={<AmountText value={o.amount} />}
                />
              ))}
            </ListGroup>
          ) : (
            <EmptyState title={t("core.cal.noObligations")} hint={t("core.cal.noObligationsHint")} />
          )}
        </Section>
        <Section title={t("core.cal.envelopesTitle")}>
          {envs.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {envs.map((e) => (
                <Card key={e.id} tint="mint">
                  <EnvelopeProgress label={t("core.cal.envelope", { title: e.title })} saved={e.saved} target={e.target} />
                  <Text variant="caption" tone="muted" className="mt-2">
                    {t("core.cal.due", { date: formatDate(e.due_date) })} · {t("core.cal.perDay", { amount: formatSumShort(e.daily) })}
                  </Text>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title={t("core.cal.noEnvelopes")} hint={t("core.cal.noEnvelopesHint")} />
          )}
        </Section>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-6">
      <PageHeader title={t("core.cal.title")} hint={t("core.cal.hint")} />
      {body}
    </div>
  )
}
