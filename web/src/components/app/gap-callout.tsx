"use client"

import { AlertTriangle, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useCoreT } from "@/components/app/use-core-t"
import { AmountText, Icon, Text } from "@/components/ui"
import { useI18n } from "@/i18n"
import type { PulseData } from "@/lib/core-api"
import { PASTEL_BG } from "@/lib/tone"
import { cn } from "@/lib/utils"

/** Cash-gap alert as a compact card; the whole card opens the "can I afford it" planner. */
export function GapCallout({ gap, className }: { gap: PulseData["gap"]; className?: string }) {
  const t = useCoreT()
  const { formatDate } = useI18n()
  return (
    <Link href="/app/plan?tab=afford" className={cn("min-h-11", gap ? PASTEL_BG.rose : PASTEL_BG.mint, className)}>
      <div className="flex items-center gap-2">
        <Icon icon={gap ? AlertTriangle : CheckCircle2} />
        <Text variant="secondary" weight="semibold" className="line-clamp-2">
          {gap ? t("core.dash.gapTitle", { date: formatDate(gap.date) }) : t("core.dash.noGapTitle")}
        </Text>
      </div>
      <div className="flex flex-col">
        <Text variant="secondary" tone="muted" className="line-clamp-2">
          {gap ? (<>{t("core.dash.gapShort")}: <AmountText value={gap.amount} /></>) : t("core.dash.noGapBody")}
        </Text>
        <Text variant="caption" tone="muted">{t("core.dash.afford")}</Text>
      </div>
    </Link>
  )
}
