"use client"

import { Camera, Image as ImageIcon, Mic, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { Icon, ListGroup, ListRow, Sheet } from "@/components/ui"
import { setPendingAttachment, type AttachmentKind } from "@/lib/pending-attachment"
import { haptic } from "@/lib/telegram"
import { VOICE_HREF } from "./nav"
import { useCoreT } from "./use-core-t"

/** Central dock "+": circular brand-yellow, bottom flush with the dock, top raised above it. Opens voice / photo / screenshot menu. */
export function DockMic() {
  const t = useCoreT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)
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
      <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={pick("photo")} />
      <input ref={shotRef} type="file" accept="image/*" hidden onChange={pick("screenshot")} />
      <Sheet open={open} onOpenChange={setOpen} title={t("core.nav.add")} closeLabel={t("core.close")}>
        <ListGroup>
          <ListRow
            title={t("core.add.voice")}
            leading={<Icon icon={Mic} />}
            onClick={() => {
              haptic("select")
              setOpen(false)
              router.push(VOICE_HREF)
            }}
          />
          <ListRow title={t("core.add.photo")} leading={<Icon icon={Camera} />} onClick={() => choose(photoRef)} />
          <ListRow title={t("core.add.screenshot")} leading={<Icon icon={ImageIcon} />} onClick={() => choose(shotRef)} />
        </ListGroup>
      </Sheet>
    </li>
  )
}
