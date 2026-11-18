"use client"

import { Calculator, Sun } from "lucide-react"
import Link from "next/link"
import { useCoreT } from "@/components/app/use-core-t"
import { AmountText, Icon, Skeleton, Text } from "@/components/ui"
import { useT } from "@/i18n"
import type { PulseData } from "@/lib/core-api"
import type { SavedTool } from "@/lib/tools-api"
import { PASTEL_BG } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { GapCallout } from "./gap-callout"

const CARD = "flex h-[132px] w-[78%] max-w-[300px] shrink-0 snap-start flex-col justify-between rounded-card border border-border p-4 text-foreground"

export function BriefCardsSkeleton() {
  return (
    <div className="-mx-4 flex gap-3 overflow-hidden px-4" aria-hidden="true">
      <Skeleton className="h-[132px] w-[78%] shrink-0 rounded-card" />
      <Skeleton className="h-[132px] w-[78%] shrink-0 rounded-card" />
    </div>
  )
}

/** Swipeable "morning brief" row: summary, pinned tools as mini cards, gap alert. */
export function BriefCards({ pulse, tools }: { pulse: PulseData; tools: SavedTool[] }) {
  const t = useCoreT()
  const tb = useT()
  return (
    <section aria-label={tb("biz.home.briefTitle")} className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1"><Icon icon={Sun} size={16} /><Text variant="secondary" tone="muted" weight="semibold">{tb("biz.home.briefTitle")}</Text></div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" tabIndex={0}>
        <article className={cn(CARD, PASTEL_BG.butter)}>
          <div className="flex items-center gap-2">
            <Icon icon={Sun} />
            <Text variant="secondary" weight="semibold" className="line-clamp-2">{pulse.headline}</Text>
          </div>
          <Text variant="secondary" className="text-foreground/80">
            {t("core.dash.balance")}: <AmountText value={pulse.balance} /> · {t("core.dash.runway", { count: pulse.runway_days })}
          </Text>
        </article>
        <GapCallout gap={pulse.gap} className={CARD} />
        {tools.map((tool, i) => (
          <Link key={tool.id} href={`/app/tools/${tool.id}`} className={cn(CARD, PASTEL_BG[(["lavender", "sky", "peach", "mint"] as const)[i % 4]], "min-h-11")}>
            <Icon icon={Calculator} />
            <div className="flex min-w-0 flex-col">
              <Text variant="secondary" weight="semibold" className="line-clamp-2">{tool.title}</Text>
              <Text variant="caption" className="text-foreground/80">{tb("biz.home.toolOpen")}</Text>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
