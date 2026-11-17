"use client"

import { usePathname, useRouter } from "next/navigation"
import { Fragment, useEffect, useState } from "react"
import { BusinessSwitcherMenu } from "@/components/business/business-switcher-menu"
import { useSession } from "@/components/providers/session-provider"
import { AppHeader, Sidebar, Text } from "@/components/ui"
import { OfflineBadge } from "@/components/offline"
import { applyTelegramTheme } from "@/lib/telegram"
import { BottomNav } from "./bottom-nav"
import { MoreSheet } from "./more-sheet"
import { isActive, primaryFor, secondaryFor } from "./nav"
import { useCoreT } from "./use-core-t"

/** Role-aware shell: sidebar ≥768px, header + 5-tab bar below. Pages render straight into `main`. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useCoreT()
  const path = usePathname()
  const router = useRouter()
  const { user } = useSession()
  const [moreOpen, setMoreOpen] = useState(false)

  const primary = primaryFor(user?.role)
  const secondary = secondaryFor(user?.role)
  const sidebarItems = [...primary, ...secondary].map((e) => ({ href: e.href, label: t(e.label), icon: e.icon, active: isActive(path, e.href) }))
  const moreActive = secondary.some((e) => isActive(path, e.href))

  useEffect(() => applyTelegramTheme(), [])
  useEffect(() => {
    if (user?.role === "seller" && path === "/app") router.replace("/app/operations")
  }, [user?.role, path, router])
  // Keyboard: visualViewport shrinks the app instead of pushing the page.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement.style
    const on = () => {
      root.setProperty("--app-h", `${Math.round(vv.height)}px`)
      if (vv.offsetTop > 0) window.scrollTo(0, 0)
    }
    on()
    vv.addEventListener("resize", on)
    vv.addEventListener("scroll", on)
    return () => {
      vv.removeEventListener("resize", on)
      vv.removeEventListener("scroll", on)
      root.removeProperty("--app-h")
    }
  }, [])

  return (
    <div className="flex h-[var(--app-h,100dvh)] flex-col md:flex-row">
      <Sidebar
        items={sidebarItems}
        className="pt-safe"
        header={<Text variant="section" weight="bold" as="span" className="px-3">Oydin</Text>}
        footer={<BusinessSwitcherMenu />}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader className="md:hidden" leading={<BusinessSwitcherMenu />} trailing={<OfflineBadge />} />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 md:px-8 md:pt-8 [&:has(>[data-fill])]:overflow-hidden [&:has(>[data-fill])]:pb-0">
          <Fragment key={user?.active_business_id ?? 0}>{children}</Fragment>
        </main>
        <BottomNav items={primary} pathname={path} moreActive={moreActive} onMore={() => setMoreOpen(true)} />
      </div>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} items={secondary} />
    </div>
  )
}
