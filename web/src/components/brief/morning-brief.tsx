"use client"

import { CalendarClock, Wallet } from "lucide-react"
import { useCoreT } from "@/components/app/use-core-t"
import { runwayText } from "@/components/app/pulse-hero"
import { AmountText, Icon, Text } from "@/components/ui"
import { useI18n, useT } from "@/i18n"
import type { PulseData } from "@/lib/core-api"
import type { Commitment, Debtor } from "@/lib/planning-api"
import { ListenBrief } from "./listen-brief"

interface Props {
  pulse: PulseData
  payments: Commitment[]
  debtors: Debtor[]
}

/** Home lead: the "Утренняя сводка" card, same design as the landing phone mockup. */
export function MorningBrief({ pulse, payments, debtors }: Props) {
  const t = useT()
  const tc = useCoreT()
  const { locale, formatDate } = useI18n()
  const today = formatDate(new Date(), { day: "numeric", month: "long", year: "numeric" })
  return (
    <section aria-label={t("biz.home.briefTitle")} className="flex flex-col gap-4 rounded-[28px] border border-[#F0D878] bg-gradient-to-b from-[#FFF6D0] to-[#FFE58A] p-5 text-[#3b342a] shadow-[0_8px_24px_-12px_rgba(120,90,0,0.35)] md:p-7">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[26px] font-bold leading-tight md:text-[32px]">{t("biz.home.briefTitle")}</h2>
        <p className="text-small text-[#3b342a]/65">{today}</p>
      </div>
      <p className="border-l-[3px] border-[#3b342a]/20 pl-4 text-[19px] leading-snug text-[#3b342a]/85 md:text-[22px]">{pulse.headline}</p>
      <ul className="flex flex-col gap-2.5 font-semibold text-[#3b342a]/80">
        <li className="flex items-center gap-2.5">
          <Icon icon={Wallet} size={20} />
          <span>{tc("core.dash.balance")}: <AmountText value={pulse.balance} /></span>
        </li>
        <li className="flex items-center gap-2.5">
          <Icon icon={CalendarClock} size={20} />
          <span>{runwayText(pulse, tc, locale)}</span>
        </li>
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text variant="caption" className="text-[#3b342a]/60">{t("biz.brief.readTime")}</Text>
        <ListenBrief pulse={pulse} payments={payments} debtors={debtors} />
      </div>
    </section>
  )
}
