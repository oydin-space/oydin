"use client"

import Link from "next/link"
import { useCoreT } from "@/components/app/use-core-t"
import { AmountText, Button, StatusBanner } from "@/components/ui"
import { useI18n } from "@/i18n"
import type { PulseData } from "@/lib/core-api"

export function GapCallout({ gap }: { gap: PulseData["gap"] }) {
  const t = useCoreT()
  const { formatDate } = useI18n()
  const afford = (
    <Button asChild size="sm" variant="secondary">
      <Link href="/app/plan?tab=afford">{t("core.dash.afford")}</Link>
    </Button>
  )
  if (!gap) return <StatusBanner kind="success" title={t("core.dash.noGapTitle")} action={afford}>{t("core.dash.noGapBody")}</StatusBanner>
  return (
    <StatusBanner kind="warning" title={t("core.dash.gapTitle", { date: formatDate(gap.date) })} action={afford}>
      {t("core.dash.gapShort")}: <AmountText value={gap.amount} /> · {gap.reason}
    </StatusBanner>
  )
}
