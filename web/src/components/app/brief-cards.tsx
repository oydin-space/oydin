"use client"

import { Calculator } from "lucide-react"
import Link from "next/link"
import { Icon, Skeleton, Text } from "@/components/ui"
import { useT } from "@/i18n"
import type { PulseData } from "@/lib/core-api"
import type { SavedTool } from "@/lib/tools-api"
import { PASTEL_BG } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { GapCallout } from "./gap-callout"

const CARD = "flex min-h-[112px] w-[78%] max-w-[300px] shrink-0 snap-start flex-col justify-between gap-2 rounded-[24px] border border-border p-4 text-foreground md:w-[300px]"

export function BriefCardsSkeleton() {
  return (
    <div className="-mx-4 flex gap-3 overflow-hidden px-4" aria-hidden="true">
      <Skeleton className="h-[112px] w-[78%] shrink-0 rounded-[24px]" />
      <Skeleton className="h-[112px] w-[78%] shrink-0 rounded-[24px]" />
    </div>
  )
}

/** Swipeable row under the morning brief: cash-gap check and pinned tools. */
export function BriefCards({ pulse, tools }: { pulse: PulseData; tools: SavedTool[] }) {
  const tb = useT()
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" tabIndex={0}>
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
  )
}
