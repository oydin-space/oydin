"use client"

import { MessageCircle, PenLine } from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { useCoreT } from "@/components/app/use-core-t"
import { Icon, Text, VoiceButton } from "@/components/ui"
import { useT } from "@/i18n"
import { api } from "@/lib/api"
import { PASTEL_BG } from "@/lib/tone"
import type { TransactionInput, VoiceReply } from "@/lib/types"
import { cn } from "@/lib/utils"
import { recordVoice, voiceSupported } from "@/lib/voice"

type State = "idle" | "recording" | "processing" | "disabled"

interface Props {
  onDraft: (draft: TransactionInput) => void
  onManual: () => void
}

const TILE = "flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-card p-3 text-center text-foreground active:scale-[0.98] transition-transform"

/** Quick actions: voice, text entry, ask Oydin. A voice draft is never saved silently: it opens the entry sheet for confirmation. */
export function QuickAdd({ onDraft, onManual }: Props) {
  const t = useCoreT()
  const tb = useT()
  const [state, setState] = useState<State>(() => (voiceSupported() ? "idle" : "disabled"))
  const stop = useRef<AbortController | null>(null)

  async function press() {
    if (state === "recording") return stop.current?.abort()
    if (state !== "idle") return
    const ctl = new AbortController()
    stop.current = ctl
    setState("recording")
    try {
      const blob = await recordVoice(ctl.signal)
      setState("processing")
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm"
      const form = new FormData()
      form.append("audio", blob, `voice.${ext}`)
      const reply = await api<VoiceReply>("/ai/voice/", { method: "POST", body: form })
      if (reply.draft) {
        toast(t("core.voice.checkDraft"))
        onDraft(reply.draft)
      } else toast.error(t("core.voice.noDraft"))
    } catch {
      toast.error(t("core.voice.failed"))
    } finally {
      setState(voiceSupported() ? "idle" : "disabled")
    }
  }

  return (
    <section aria-label={t("core.dash.quickTitle")} className="grid grid-cols-3 gap-3">
      <div className={cn(TILE, PASTEL_BG.butter)}>
        <VoiceButton
          state={state}
          onPress={press}
          size={56}
          labels={{ idle: t("core.voice.idle"), recording: t("core.voice.recording"), processing: t("core.voice.processing"), disabled: t("core.voice.disabled") }}
        />
        <Text variant="caption" weight="semibold">{tb("biz.home.qaVoice")}</Text>
      </div>
      <button type="button" onClick={onManual} className={cn(TILE, PASTEL_BG.sky)}>
        <Icon icon={PenLine} />
        <Text variant="caption" weight="semibold">{tb("biz.home.qaText")}</Text>
      </button>
      <Link href="/app/chat" className={cn(TILE, PASTEL_BG.lavender)}>
        <Icon icon={MessageCircle} />
        <Text variant="caption" weight="semibold">{tb("biz.home.qaAsk")}</Text>
      </Link>
    </section>
  )
}
