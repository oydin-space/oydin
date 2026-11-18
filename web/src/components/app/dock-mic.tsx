"use client"

import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { EntrySheet } from "@/components/operations/entry-sheet"
import { CaptureView } from "@/components/capture/capture-view"
import { Icon } from "@/components/ui"
import type { Account } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { setPendingAttachment, type AttachmentKind } from "@/lib/pending-attachment"
import { haptic } from "@/lib/telegram"
import { VOICE_HREF } from "./nav"
import { useCoreT } from "./use-core-t"

/** Central dock "+": circular brand-yellow, bottom flush with the dock, top raised above it. Opens the full-screen camera capture view. */
export function DockMic({ onEntrySaved }: { onEntrySaved: () => void }) {
  const t = useCoreT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [entry, setEntry] = useState(0)
  const accounts = useApi<{ items: Account[] }>(open || entry ? "/accounts/" : null)
  const shotRef = useRef<HTMLInputElement>(null)

  const pick = (kind: AttachmentKind) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setPendingAttachment(file, kind)
    router.push("/app/chat?attach=1")
  }
  const choose = (ref: React.RefObject<HTMLInputElement | null>) => {
    haptic("select")
    setOpen(false)
    ref.current?.click()
  }

  return (
    <li className="relative flex w-[72px] shrink-0 self-stretch justify-center">
      <button
        type="button"
        aria-label={t("core.nav.add")}
        aria-haspopup="dialog"
        onClick={() => {
          haptic("select")
          setOpen(true)
        }}
        className="press focus-ring absolute bottom-0 grid size-16 place-items-center rounded-pill bg-brand text-white shadow-[0_10px_24px_-8px_#e0b400,0_0_0_5px_color-mix(in_srgb,var(--background)_55%,transparent)]"
      >
        <Icon icon={Plus} size={24} />
      </button>
      <input ref={shotRef} type="file" accept="image/*" hidden onChange={pick("screenshot")} />
      <CaptureView
        open={open}
        onClose={() => setOpen(false)}
        onPhoto={(file) => {
          setOpen(false)
          setPendingAttachment(file, "photo")
          router.push("/app/chat?attach=1")
        }}
        onGallery={() => choose(shotRef)}
        onVoice={() => {
          haptic("select")
          setOpen(false)
          router.push(VOICE_HREF)
        }}
        onTyped={() => {
          haptic("select")
          setOpen(false)
          setEntry((n) => n + 1)
        }}
      />
      {entry ? <EntrySheet key={entry} accounts={accounts.data?.items ?? []} seed={{ values: { direction: "out" } }} onClose={() => setEntry(0)} onSaved={() => { setEntry(0); onEntrySaved() }} /> : null}
    </li>
  )
}
