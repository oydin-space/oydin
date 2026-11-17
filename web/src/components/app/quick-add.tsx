"use client"

import { Plus } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { useCoreT } from "@/components/app/use-core-t"
import { Button, Card, Text, VoiceButton } from "@/components/ui"
import { api } from "@/lib/api"
import type { TransactionInput, VoiceReply } from "@/lib/types"
import { recordVoice, voiceSupported } from "@/lib/voice"

type State = "idle" | "recording" | "processing" | "disabled"

interface Props {
  onDraft: (draft: TransactionInput) => void
  onManual: () => void
}

/** Voice + manual entry. A voice draft is never saved silently: it opens the entry sheet for confirmation. */
export function QuickAdd({ onDraft, onManual }: Props) {
  const t = useCoreT()
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
    <Card tint="sky" title={t("core.dash.quickTitle")}>
      <div className="flex items-center gap-4">
        <VoiceButton
          state={state}
          onPress={press}
          size={72}
          labels={{ idle: t("core.voice.idle"), recording: t("core.voice.recording"), processing: t("core.voice.processing"), disabled: t("core.voice.disabled") }}
        />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <Text variant="secondary" tone="muted">{t("core.dash.quickHint")}</Text>
          <Button size="sm" variant="secondary" icon={Plus} onClick={onManual}>{t("core.dash.manual")}</Button>
        </div>
      </div>
    </Card>
  )
}
