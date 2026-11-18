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

/** Chunky "Listen to the brief" button: reads the morning brief aloud via SpeechSynthesis. */
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
    <Button size="lg" variant="secondary" block icon={Square} onClick={stop} aria-live="polite">{t("biz.brief.stop")}</Button>
  ) : (
    <Button size="lg" block icon={Volume2} onClick={onPlay}>{t("biz.brief.listen")}</Button>
  )
}
