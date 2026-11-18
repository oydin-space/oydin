"use client"

import { Camera, CameraOff, FlipHorizontal2, Image as ImageIcon, Mic, Pencil, X, Zap, ZapOff } from "lucide-react"
import { Dialog } from "radix-ui"
import { useCoreT } from "@/components/app/use-core-t"
import { Icon, Spinner, toast } from "@/components/ui"
import { cn } from "@/lib/utils"
import { useCamera } from "./use-camera"

const GLASS = "press focus-ring grid shrink-0 place-items-center rounded-pill bg-black/35 text-white backdrop-blur-md disabled:opacity-40"

type Props = {
  open: boolean
  onClose: () => void
  /** A frame (or nothing went wrong) -> same photo flow as the file input. */
  onPhoto: (file: File) => void
  onGallery: () => void
  onVoice: () => void
  onTyped: () => void
}

/** Full-screen camera (centered 9:16-ish modal on desktop): live preview, shutter, voice, gallery and typed entry. */
export function CaptureView({ open, onClose, onPhoto, onGallery, onVoice, onTyped }: Props) {
  const t = useCoreT()
  const [videoRef, cam] = useCamera(open)
  const live = cam.status === "live"

  const shoot = async () => {
    const file = await cam.capture()
    if (file) onPhoto(file)
    else toast.error(t("core.cam.failed"))
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-[kit-overlay-in_var(--dur-base)_var(--ease-enter)] data-[state=closed]:animate-[kit-overlay-out_var(--dur-base)_var(--ease-exit)]" />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-stretch justify-center md:items-center md:p-6">
          <Dialog.Content
            aria-describedby={undefined}
            className="pointer-events-auto relative flex h-full w-full flex-col overflow-hidden bg-black text-white outline-none data-[state=open]:animate-[kit-overlay-in_var(--dur-base)_var(--ease-enter)] data-[state=closed]:animate-[kit-overlay-out_var(--dur-base)_var(--ease-exit)] md:h-[min(860px,100%)] md:max-w-[480px] md:rounded-3xl"
          >
            <Dialog.Title className="sr-only">{t("core.cam.title")}</Dialog.Title>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={cn("absolute inset-0 size-full object-cover transition-opacity duration-300", live ? "opacity-100" : "opacity-0", cam.facing === "user" && "-scale-x-100")}
            />

            {cam.status === "starting" ? (
              <div className="absolute inset-0 grid place-items-center" role="status">
                <span className="flex items-center gap-2 text-sm text-white/80">
                  <Spinner variant="ring" size={20} />
                  {t("core.cam.starting")}
                </span>
              </div>
            ) : null}
            {cam.status === "denied" || cam.status === "unsupported" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
                <span className="grid size-16 place-items-center rounded-pill bg-white/10">
                  <Icon icon={CameraOff} size={24} />
                </span>
                <p className="text-lg font-semibold">{t(cam.status === "denied" ? "core.cam.deniedTitle" : "core.cam.unsupportedTitle")}</p>
                <p className="max-w-xs text-sm text-white/70">{t(cam.status === "denied" ? "core.cam.deniedHint" : "core.cam.unsupportedHint")}</p>
              </div>
            ) : null}

            <div className="relative z-10 flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
              <Dialog.Close className={cn(GLASS, "size-11")} aria-label={t("core.close")}>
                <Icon icon={X} size={24} />
              </Dialog.Close>
              <div className="flex gap-2">
                {live && cam.canTorch ? (
                  <button type="button" className={cn(GLASS, "size-11", cam.torch && "bg-brand text-black")} aria-pressed={cam.torch} aria-label={t(cam.torch ? "core.cam.torchOff" : "core.cam.torchOn")} onClick={() => void cam.toggleTorch()}>
                    <Icon icon={cam.torch ? Zap : ZapOff} size={20} />
                  </button>
                ) : null}
                {cam.canFlip ? (
                  <button type="button" className={cn(GLASS, "size-11")} aria-label={t("core.cam.flip")} onClick={cam.flip}>
                    <Icon icon={FlipHorizontal2} size={20} />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="relative z-10 mt-auto flex flex-col gap-4 bg-gradient-to-t from-black/60 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <button type="button" onClick={onGallery} className="press focus-ring flex min-h-14 min-w-11 flex-col items-center justify-self-start gap-1 rounded-2xl px-2 text-xs font-medium text-center">
                  <Icon icon={ImageIcon} size={20} />
                  {t("core.cam.gallery")}
                </button>
                <button
                  type="button"
                  disabled={!live}
                  onClick={() => void shoot()}
                  aria-label={t("core.cam.shutter")}
                  className="press focus-ring grid size-[76px] place-items-center rounded-pill border-4 border-white p-1 disabled:opacity-40"
                >
                  <span className="grid size-full place-items-center rounded-pill bg-white text-black">
                    <Icon icon={Camera} size={24} />
                  </span>
                </button>
                <button type="button" onClick={onTyped} className="press focus-ring flex min-h-14 min-w-11 flex-col items-center justify-self-end gap-1 rounded-2xl px-2 text-xs font-medium text-center">
                  <Icon icon={Pencil} size={20} />
                  {t("core.cam.typed")}
                </button>
              </div>
              <button type="button" onClick={onVoice} className="press focus-ring flex min-h-12 items-center justify-center gap-2 rounded-pill bg-brand px-5 font-semibold text-black">
                <Icon icon={Mic} size={20} />
                {t("core.cam.voice")}
              </button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
