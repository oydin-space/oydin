"use client"

import Link from "next/link"
import { Icon } from "@/components/ui"
import { haptic } from "@/lib/telegram"
import { cn } from "@/lib/utils"
import { MORE_ICON, isActive, type NavEntry } from "./nav"
import { useCoreT } from "./use-core-t"

const tabClass = (active: boolean) =>
  cn("focus-ring press flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-caption font-medium", active ? "text-foreground" : "text-muted-foreground")

const pill = (active: boolean) => cn("motion-fast flex h-7 w-14 items-center justify-center rounded-pill transition-colors", active ? "bg-butter text-butter-ink" : "bg-transparent")

/**
 * Mobile tab bar for up to five destinations (kit TabBar is fixed at four columns): primary entries + "More".
 * In the app column (not fixed), so the scrolling `main` stays above it and the safe-area inset is respected.
 */
export function BottomNav({ items, pathname, moreActive, onMore }: { items: readonly NavEntry[]; pathname: string; moreActive: boolean; onMore: () => void }) {
  const t = useCoreT()
  return (
    <nav aria-label={t("core.nav.label")} className="pb-safe glass relative z-10 border-t border-border md:hidden">
      <ul className="mx-auto flex max-w-lg px-1">
        {items.map((e) => {
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
        })}
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
