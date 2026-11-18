"use client"

import { Mic } from "lucide-react"
import Link from "next/link"
import { Icon } from "@/components/ui"
import { haptic } from "@/lib/telegram"
import { VOICE_HREF } from "./nav"
import { useCoreT } from "./use-core-t"

/** Central dock button: circular brand-yellow, ~1/3 sunk into the dock. Opens the existing quick-entry screen in voice mode. */
export function DockMic() {
  const t = useCoreT()
  return (
    <li className="relative flex w-[72px] shrink-0 justify-center">
      <Link
        href={VOICE_HREF}
        aria-label={t("core.nav.voice")}
        onClick={() => haptic("select")}
        className="press focus-ring absolute -top-5 grid size-16 place-items-center rounded-pill bg-brand text-white shadow-[0_10px_24px_-8px_#e0b400,0_0_0_5px_color-mix(in_srgb,var(--background)_55%,transparent)]"
      >
        <Icon icon={Mic} size={24} />
      </Link>
    </li>
  )
}
