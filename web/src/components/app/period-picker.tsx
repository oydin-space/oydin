"use client"

import { CalendarDays, Check } from "lucide-react"
import { useState } from "react"
import { Icon, ListGroup, ListRow, Sheet } from "@/components/ui"
import { useLocale } from "@/i18n"
import { monthName } from "@/lib/format"
import { setPeriod, usePeriod, type Period } from "@/lib/period"
import { useCoreT } from "./use-core-t"

/** Localized period names (month, "month year") for the current UI language. */
export function usePeriodLabels() {
  const [locale] = useLocale()
  const month = (p: Period) => monthName(p.month, locale, p.year)
  return { month, full: (p: Period) => `${month(p)} ${p.year}` }
}

/** Bottom sheet with the last 12 months; selecting one sets the global period. */
export function PeriodSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useCoreT()
  const current = usePeriod()
  const { full } = usePeriodLabels()
  const today = new Date()
  const months: Period[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("core.period.title")} closeLabel={t("core.close")}>
      <ListGroup>
        {months.map((m) => {
          const active = m.year === current.year && m.month === current.month
          return (
            <ListRow
              key={`${m.year}-${m.month}`}
              title={<span className="capitalize">{full(m)}</span>}
              trailing={active ? <Icon icon={Check} size={20} /> : undefined}
              onClick={() => {
                setPeriod(m)
                onOpenChange(false)
              }}
            />
          )
        })}
      </ListGroup>
    </Sheet>
  )
}

/** Desktop period button (the mobile one lives in the top bar pill). */
export function PeriodButton({ className }: { className?: string }) {
  const t = useCoreT()
  const current = usePeriod()
  const { full } = usePeriodLabels()
  const [open, setOpen] = useState(false)
  return (
    <div className={className}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={t("core.period.open", { month: full(current) })}
        onClick={() => setOpen(true)}
        className="focus-ring press inline-flex h-11 items-center gap-2 rounded-pill border border-border bg-card px-4 text-small font-medium capitalize"
      >
        <Icon icon={CalendarDays} size={20} />
        {full(current)}
      </button>
      <PeriodSheet open={open} onOpenChange={setOpen} />
    </div>
  )
}
