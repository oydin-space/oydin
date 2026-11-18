"use client"

import { HandCoins } from "lucide-react"
import Link from "next/link"
import { AmountText, Button, Card, Icon, Section, Text } from "@/components/ui"
import { useI18n, useT } from "@/i18n"
import type { Commitment, Debtor } from "@/lib/planning-api"
import { todayIso } from "@/lib/core-api"
import { owedTotal } from "./brief-text"

/** Payments due this week, plus a shortcut to remind debtors. Links go to existing Plan tabs. */
export function UpcomingCard({ payments, debtors }: { payments: Commitment[]; debtors: Debtor[] }) {
  const t = useT()
  const { formatDate } = useI18n()
  const owed = owedTotal(debtors)
  const today = todayIso()
  return (
    <Section icon="wallet" title={t("biz.brief.upcomingTitle")} action={<Link href="/app/plan?tab=commitments" className="focus-ring inline-flex min-h-11 items-center px-2 text-small font-semibold">{t("biz.brief.all")}</Link>}>
      <Card className="flex flex-col gap-3">
        {payments.length ? (
          <ul className="flex flex-col">
            {payments.slice(0, 4).map((c) => (
              <li key={c.id} className="flex min-h-11 items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <Text weight="semibold" className="truncate">{c.title}</Text>
                  <Text variant="caption" tone={c.next_date < today ? "danger" : "muted"}>
                    {c.next_date < today ? t("biz.brief.overdue") : formatDate(c.next_date, { day: "numeric", month: "long" })}
                  </Text>
                </div>
                <AmountText value={c.amount} />
              </li>
            ))}
          </ul>
        ) : (
          <Text variant="secondary" tone="muted">{t("biz.brief.noPayments")}</Text>
        )}
        {owed > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex min-w-0 items-center gap-2">
              <Icon icon={HandCoins} />
              <Text variant="secondary">{t("biz.brief.owed", { count: debtors.length })} <AmountText value={owed} /></Text>
            </div>
            <Button size="sm" variant="secondary" asChild><Link href="/app/plan?tab=debtors">{t("biz.brief.remind")}</Link></Button>
          </div>
        ) : null}
      </Card>
    </Section>
  )
}
