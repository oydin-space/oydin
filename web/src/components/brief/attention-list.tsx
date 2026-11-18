"use client"

import { AlertCircle } from "lucide-react"
import { AmountText, Icon } from "@/components/ui"
import { useI18n, useT } from "@/i18n"
import { todayIso } from "@/lib/core-api"
import type { Commitment } from "@/lib/planning-api"

/** "Требует внимания": upcoming or overdue outgoing payments; today/overdue ones need a decision. */
export function AttentionList({ payments }: { payments: Commitment[] }) {
  const t = useT()
  const { formatDate } = useI18n()
  if (!payments.length) return <p className="rounded-[24px] border border-border bg-card p-5 text-muted-foreground">{t("biz.brief.nothing")}</p>
  const today = todayIso()
  const day = (iso: string) => formatDate(new Date(`${iso}T00:00:00`), { day: "numeric", month: "long" })
  return (
    <ul className="flex flex-col gap-3">
      {payments.map((c) => {
        const urgent = c.next_date <= today
        return (
          <li key={c.id} className="flex flex-col gap-1.5 rounded-[24px] border border-border bg-card p-5">
            <h3 className="text-[19px] font-bold leading-snug">{t("biz.brief.pay", { title: c.title })} — <AmountText value={c.amount} /></h3>
            <p className="text-small text-muted-foreground">{c.next_date < today ? t("biz.brief.payOverdue") : t("biz.brief.payDue", { date: day(c.next_date) })}</p>
            {urgent ? (
              <p className="flex items-center gap-1.5 text-small font-semibold text-[#C0392B]">
                <Icon icon={AlertCircle} size={16} />
                {t("biz.brief.needDecision")} · {t("biz.brief.until", { date: day(c.next_date) })}
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
