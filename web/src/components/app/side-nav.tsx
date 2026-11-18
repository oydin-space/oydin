"use client"

import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { useState, useSyncExternalStore } from "react"
import { Logo, Wordmark } from "@/components/brand/logo"
import { Tooltip, TooltipProvider } from "@/components/ui"
import { useKitT } from "@/components/ui/kit-t"
import { cn } from "@/lib/utils"
import { useCoreT } from "./use-core-t"

export interface SideNavItem {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
}

const STORAGE_KEY = "oydin.sidebar.collapsed"

const listeners = new Set<() => void>()
function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}
function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Collapsed flag persisted in localStorage (server snapshot = expanded). `ready` (set on first user toggle) gates the width transition so the restored state never animates. */
function useCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false)
  const [ready, setReady] = useState(false)
  const toggle = () => {
    setReady(true)
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "0" : "1")
    } catch {}
    listeners.forEach((l) => l())
  }
  return { collapsed, ready, toggle }
}

/** Desktop sidebar: full width with labels, or a 72px icon rail with tooltips. Hidden below md. */
export function SideNav({ items, footer }: { items: SideNavItem[]; footer?: (collapsed: boolean) => React.ReactNode }) {
  const t = useCoreT()
  const kit = useKitT()
  const { collapsed, ready, toggle } = useCollapsed()
  const toggleLabel = t(collapsed ? "core.nav.expand" : "core.nav.collapse")
  const link = (href: string, label: string, I: LucideIcon, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "state-layer focus-ring flex min-h-11 items-center rounded-control text-body",
        collapsed ? "justify-center" : "gap-3 px-3",
        active ? "bg-muted font-semibold" : "text-muted-foreground",
      )}
    >
      <I className="size-5 shrink-0" aria-hidden />
      <span className={cn("whitespace-nowrap", collapsed && "sr-only")}>{label}</span>
    </Link>
  )
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <TooltipProvider>
      <aside
        data-collapsed={collapsed}
        className={cn(
          "hidden shrink-0 flex-col gap-4 overflow-hidden border-r border-border bg-card pt-8 pb-4 md:flex",
          collapsed ? "w-[72px] px-3" : "w-64 px-4",
          ready && "transition-[width,padding] duration-200 ease-out motion-reduce:transition-none",
        )}
      >
        <div className={cn("flex min-h-11 items-center", collapsed ? "justify-center" : "justify-between")}>
          {collapsed ? null : <Wordmark size={36} className="px-3" />}
          <Tooltip content={toggleLabel}>
            <button
              type="button"
              onClick={toggle}
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
              className="state-layer focus-ring grid size-11 shrink-0 place-items-center rounded-control text-muted-foreground"
            >
              <ToggleIcon className="size-5" aria-hidden />
            </button>
          </Tooltip>
        </div>
        {collapsed ? <Logo size={36} className="mx-auto" /> : null}
        <nav aria-label={kit("kit.nav.main")} className="flex-1">
          <ul className="flex flex-col gap-1">
            {items.map(({ href, label, icon: I, active }) => (
              <li key={href}>
                {collapsed ? <Tooltip content={label}>{link(href, label, I, active)}</Tooltip> : link(href, label, I, active)}
              </li>
            ))}
          </ul>
        </nav>
        <div className="overflow-hidden">{footer?.(collapsed)}</div>
      </aside>
    </TooltipProvider>
  )
}
