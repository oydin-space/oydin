"use client"

import { Square, Volume2 } from "lucide-react"
import { Button, Text } from "@/components/ui"
import { makeT, type Locale } from "@/i18n/core"
import { useI18n, useT } from "@/i18n"
import type { PulseData } from "@/lib/core-api"
import type { Commitment, Debtor } from "@/lib/planning-api"
import { composeBrief } from "./brief-text"
import { speechLocale, useSpeech } from "./speech"

interface Props {
  pulse: PulseData
  payments: Commitment[]
  debtors: Debtor[]
}

const PILL = "min-h-11 rounded-pill border-[#F0D878] bg-[#FFFBEA] px-5 text-[#3b342a] hover:bg-white"

/** "Listen to the brief" pill: reads the morning brief aloud via SpeechSynthesis. */
export function ListenBrief({ pulse, payments, debtors }: Props) {
  const t = useT()
  const { locale } = useI18n()
  const { available, speaking, voices, speak, stop } = useSpeech()

  if (!available)
    return <Text variant="secondary" tone="muted" role="status">{t("biz.brief.unavailable")}</Text>

  const onPlay = () => {
    const lang: Locale = speechLocale(locale, voices)
    speak(composeBrief(makeT(lang), lang, { pulse, payments, debtors }), lang)
  }

  return speaking ? (
    <Button variant="secondary" className={PILL} icon={Square} onClick={stop} aria-live="polite">{t("biz.brief.stop")}</Button>
  ) : (
    <Button variant="secondary" className={PILL} icon={Volume2} onClick={onPlay}>{t("biz.brief.speak")}</Button>
  )
}
