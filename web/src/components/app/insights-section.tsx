"use client"

import { useCoreT } from "@/components/app/use-core-t"
import { EvidenceCard, Section } from "@/components/ui"
import type { Insight } from "@/lib/types"

const CONF = { high: "positive", medium: "caution", low: "negative" } as const

export function InsightsSection({ items: all }: { items: Insight[] }) {
  const t = useCoreT()
  // Staff cards are not about the cash-gap forecast; the backend still produces them.
  const items = all.filter((i) => !i.id.startsWith("staff-"))
  if (!items.length) return null
  return (
    <Section icon="lightbulb" title={t("core.dash.insightsTitle")}>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((i) => {
          return (
            <EvidenceCard
              icon="lightbulb"
              key={i.id}
              claim={i.title}
              items={[]}
              source={`${i.body} ${t("core.dash.insightSource", { source: i.source })}`}
              confidence={{ label: t(`core.dash.conf.${i.confidence}`), tone: CONF[i.confidence] }}
            />
          )
        })}
      </div>
    </Section>
  )
}
