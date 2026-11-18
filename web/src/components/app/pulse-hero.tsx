"use client"

import { CalendarClock, CheckCircle2, ShieldCheck, TriangleAlert, Eye } from "lucide-react"
import { useCoreT, type CoreKey, type CoreT } from "@/components/app/use-core-t"
import { AmountText, Badge, Icon, ProgressRing, Skeleton, StatTile, Text, type StatTileProps } from "@/components/ui"
import { useI18n } from "@/i18n"
import type { PulseData } from "@/lib/core-api"
import { dayMonth, pct, softSum, type FormatLocale } from "@/lib/format"

const TONE_ICON = { calm: ShieldCheck, watch: Eye, risk: TriangleAlert } as const
const TONE = { calm: "positive", watch: "caution", risk: "negative" } as const


/** One runway figure for the whole Home: with a gap it is "until the gap date", the same forecast the gap card uses. */
export function runwayText(pulse: PulseData, t: CoreT, locale: FormatLocale): string {
  const count = pulse.runway_days
  return pulse.gap ? t("core.homep.runwayGap", { count, date: dayMonth(pulse.gap.date, locale) }) : t("core.dash.runway", { count })
}

/** Why "safe to spend" is smaller than the balance (shown when it is 0). */
function safeReason(pulse: PulseData, t: CoreT, locale: FormatLocale): string | null {
  const amount = softSum(pulse.reserved_upcoming ?? pulse.balance, locale)
  switch (pulse.safe_reason) {
    case "gap":
      return pulse.gap ? t("core.homep.safeGap", { amount, date: dayMonth(pulse.gap.date, locale) }) : null
    case "reserved":
      return t("core.homep.safeReserved", { amount })
    case "tax":
      return t("core.homep.safeTax")
    case "empty":
      return t("core.homep.safeEmpty")
    default:
      return null
  }
}

export function PulseHeroSkeleton() {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <Skeleton className="size-[72px] rounded-pill" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-9 w-3/4" />
      </div>
    </div>
  )
}

/** Above the fold: safe-to-spend number and a one-line status. */
export function PulseHero({ pulse }: { pulse: PulseData }) {
  const t = useCoreT()
  const { locale } = useI18n()
  const reason = pulse.safe_to_spend > 0 ? null : safeReason(pulse, t, locale)
  return (
    <div className="flex items-center gap-4">
      <div className="flex shrink-0 flex-col items-center gap-1">
        <ProgressRing value={pulse.score / 100} label={t("core.dash.pulseLabel", { score: String(pulse.score) })} size={72}>
          <Text variant="body" weight="bold">{pulse.score}</Text>
        </ProgressRing>
        <Text variant="caption" tone="muted" weight="semibold" aria-hidden="true">{t("core.homep.pulse")}</Text>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <Badge className="self-start" icon={<Icon icon={TONE_ICON[pulse.tone as keyof typeof TONE_ICON] ?? ShieldCheck} size={16} />} tone={TONE[pulse.tone as keyof typeof TONE] ?? "neutral"}>{t(`core.dash.tone.${pulse.tone}` as CoreKey)}</Badge>
        <Text variant="secondary" className="text-foreground/80">{t("core.dash.safe")}</Text>
        <AmountText value={pulse.safe_to_spend} className="text-page font-semibold" />
        {reason ? <Text variant="caption" tone="muted">{reason}</Text> : null}
      </div>
    </div>
  )
}

/** Below the fold: balance and other metrics. */
export function PulseDetails({ pulse }: { pulse: PulseData }) {
  const t = useCoreT()
  const { locale } = useI18n()
  const metric = (key: string) => pulse.metrics.find((m) => m.key === key)?.value
  const week = pulse.revenue_week
  const optional: StatTileProps[] = [
    week
      ? {
          tint: "mint", icon: "trending-up", label: t("core.homep.weekRevenue"), value: week.amount,
          delta: week.delta_pct == null ? null : week.amount - week.prev_amount,
          deltaLabel: week.delta_pct == null ? t("core.homep.weekNoPrev") : t("core.homep.weekDelta", { pct: `${week.delta_pct > 0 ? "+" : ""}${pct(week.delta_pct, 0, locale)}` }),
        }
      : { label: "", value: null },
    { tint: "lavender", icon: "hand-coins", label: t("core.dash.ownerTake"), value: metric("owner_take") ?? null },
    { tint: "peach", icon: "trending-up", label: t("core.dash.profit"), value: metric("profit") ?? null },
    { tint: "rose", icon: "landmark", label: t("core.dash.taxReserved"), value: pulse.tax_reserved ?? null },
    { tint: "butter", icon: "scale", label: t("core.dash.cashDifference"), value: pulse.cash_difference ?? null },
  ]
  const tiles: StatTileProps[] = [{ tint: "sky", icon: "wallet", label: t("core.dash.balance"), value: pulse.balance }, ...optional.filter((tile) => tile.value != null)]
  return (
    <div className="flex flex-col gap-3">
      <Text variant="caption" tone="muted" className="px-1">{t("core.dash.safeHint")}</Text>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile, i) => (
          <StatTile key={tile.label} {...tile} className={i === 0 || (i === tiles.length - 1 && i % 2 === 1) ? "col-span-2" : undefined} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
        <Text variant="secondary" className="text-foreground/80 inline-flex items-center gap-1.5">
          <Icon icon={CalendarClock} size={16} />
          {runwayText(pulse, t, locale)}
        </Text>
        <Text variant="secondary" className="text-foreground/80 inline-flex items-center gap-1.5">
          <Icon icon={CheckCircle2} size={16} />
          {t("core.dash.promises", { kept: String(pulse.promises.kept), total: String(pulse.promises.total) })}
        </Text>
      </div>
    </div>
  )
}
