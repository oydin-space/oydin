"use client"

import { useCoreT, type CoreKey } from "@/components/app/use-core-t"
import { AmountText, Badge, Card, ProgressRing, StatTile, Text } from "@/components/ui"
import type { PulseData } from "@/lib/core-api"

const TONE = { calm: "positive", watch: "caution", risk: "negative" } as const

export function PulseHero({ pulse }: { pulse: PulseData }) {
  const t = useCoreT()
  const metric = (key: string) => pulse.metrics.find((m) => m.key === key)?.value
  const ownerTake = metric("owner_take")
  const profit = metric("profit")
  return (
    <div className="flex flex-col gap-3">
      <Card tint="mint">
        <div className="flex items-center gap-4">
          <ProgressRing value={pulse.score / 100} label={t("core.dash.pulseLabel", { score: String(pulse.score) })} size={72}>
            <Text variant="body" weight="bold">{pulse.score}</Text>
          </ProgressRing>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Badge tone={TONE[pulse.tone as keyof typeof TONE] ?? "neutral"}>{t(`core.dash.tone.${pulse.tone}` as CoreKey)}</Badge>
            <Text variant="secondary" tone="muted">{t("core.dash.safe")}</Text>
            <AmountText value={pulse.safe_to_spend} className="text-page font-semibold" />
          </div>
        </div>
        <Text variant="caption" tone="muted" className="mt-3">{t("core.dash.safeHint")}</Text>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <StatTile tint="sky" label={t("core.dash.balance")} value={pulse.balance} />
        {ownerTake != null ? <StatTile tint="lavender" label={t("core.dash.ownerTake")} value={ownerTake} /> : null}
        {profit != null ? <StatTile tint="peach" label={t("core.dash.profit")} value={profit} /> : null}
        {pulse.tax_reserved != null ? <StatTile tint="rose" label={t("core.dash.taxReserved")} value={pulse.tax_reserved} /> : null}
        {pulse.cash_difference != null ? <StatTile tint="butter" label={t("core.dash.cashDifference")} value={pulse.cash_difference} /> : null}
      </div>
      <Text variant="secondary" tone="muted" className="px-1">
        {t("core.dash.runway", { count: pulse.runway_days })} · {t("core.dash.promises", { kept: String(pulse.promises.kept), total: String(pulse.promises.total) })}
      </Text>
    </div>
  )
}
