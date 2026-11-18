"use client"

import { useT } from "@/i18n"
import type { RunwaySplit } from "./overview"

const SEGMENTS = [
  { key: "reserve", color: "bg-[#B9B2A3]", label: "biz.brief.seg.reserve" },
  { key: "covered", color: "bg-[#5BB97A]", label: "biz.brief.seg.covered" },
  { key: "gap", color: "bg-[#FFD62C]", label: "biz.brief.seg.gap" },
] as const

/** "Хватает на N из 30 дней": segmented bar reserve / covered / gap. */
export function RunwayCard({ split }: { split: RunwaySplit }) {
  const t = useT()
  const ok = split.total - split.gap
  return (
    <section className="flex flex-col gap-4 rounded-[24px] border border-border bg-card p-5">
      <h3 className="text-[19px] font-bold leading-snug">{t("biz.brief.runwayTitle", { n: ok })}</h3>
      <div role="img" aria-label={SEGMENTS.map((s) => t(s.label, { n: split[s.key] })).join(", ")} className="flex h-3 gap-1 overflow-hidden rounded-pill">
        {SEGMENTS.map((s) => (split[s.key] ? <span key={s.key} className={`${s.color} rounded-pill`} style={{ flexGrow: split[s.key] }} /> : null))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-small text-muted-foreground">
        {SEGMENTS.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-2.5 rounded-full ${s.color}`} />
            {t(s.label, { n: split[s.key] })}
          </li>
        ))}
      </ul>
    </section>
  )
}
