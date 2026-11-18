"use client"

import Link from "next/link"
import { Icon } from "@/components/ui"
import { haptic } from "@/lib/telegram"
import { cn } from "@/lib/utils"
import { DockMic } from "./dock-mic"
import { MORE_ICON, isActive, type NavEntry } from "./nav"
import { useCoreT } from "./use-core-t"

const tabClass = (active: boolean) =>
  cn("focus-ring press flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-pill text-caption font-medium", active ? "text-foreground" : "text-muted-foreground")

const pill = (active: boolean) => cn("motion-fast flex h-7 w-12 items-center justify-center rounded-pill transition-colors", active ? "bg-butter text-butter-ink" : "bg-transparent")

/**
 * Floating liquid-glass dock: Home · Operations · [mic] · Assistant · More. Overlays the app column (absolute),
 * so `main` pads for it only while `hidden` is false. The mic protrudes ~1/3 above the glass.
 */
export function BottomNav({ items, pathname, moreActive, onMore, hidden, onEntrySaved }: { items: readonly NavEntry[]; pathname: string; moreActive: boolean; onMore: () => void; hidden: boolean; onEntrySaved: () => void }) {
  const t = useCoreT()
  const tab = (e: NavEntry) => {
    const active = isActive(pathname, e.href)
    return (
      <li key={e.id} className="flex flex-1">
        <Link href={e.href} aria-current={active ? "page" : undefined} onClick={() => !active && haptic("select")} className={tabClass(active)}>
          <span className={pill(active)}>
            <Icon icon={e.icon} size={24} />
          </span>
          {t(e.label)}
        </Link>
      </li>
    )
  }
  return (
    <nav
      aria-label={t("core.nav.label")}
      data-hidden={hidden}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      className="shell-float pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom),var(--tg-bottom))] md:hidden"
    >
      <ul className="glass-liquid pointer-events-auto relative mx-auto flex max-w-md items-center rounded-[2rem] px-2">
        {items.filter((e) => e.dock !== "right").map(tab)}
        <DockMic onEntrySaved={onEntrySaved} />
        {items.filter((e) => e.dock === "right").map(tab)}
        <li className="flex flex-1">
          <button type="button" aria-haspopup="dialog" aria-current={moreActive ? "page" : undefined} onClick={onMore} className={tabClass(moreActive)}>
            <span className={pill(moreActive)}>
              <Icon icon={MORE_ICON} size={24} />
            </span>
            {t("core.nav.more")}
          </button>
        </li>
      </ul>
    </nav>
  )
}
