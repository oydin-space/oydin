"use client"

import { usePathname, useRouter } from "next/navigation"
import { Fragment, useEffect, useState } from "react"
import { Wordmark } from "@/components/brand/logo"
import { BusinessSwitcherMenu } from "@/components/business/business-switcher-menu"
import { useSession } from "@/components/providers/session-provider"
import { Sidebar } from "@/components/ui"
import { applyTelegramTheme } from "@/lib/telegram"
import { BottomNav } from "./bottom-nav"
import { MoreSheet } from "./more-sheet"
import { isActive, primaryFor, secondaryFor } from "./nav"
import { TopBar } from "./top-bar"
import { useCoreT } from "./use-core-t"
import { useKeyboardOpen } from "./use-keyboard-open"

/** Role-aware shell: sidebar ≥768px, header + 5-tab bar below. Pages render straight into `main`. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useCoreT()
  const path = usePathname()
  const router = useRouter()
  const { user } = useSession()
  const [moreOpen, setMoreOpen] = useState(false)
  const kbOpen = useKeyboardOpen()

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

  // --app-top / --app-dock: space taken by the floating top bar / dock (0 on desktop and while the keyboard is open). Literal classes for Tailwind.
  const vars = kbOpen
    ? "[--app-top:0px] [--app-dock:0px] md:[--app-top:0px]"
    : "[--app-top:calc(4.25rem+max(env(safe-area-inset-top),var(--tg-top)))] [--app-dock:calc(6.75rem+max(env(safe-area-inset-bottom),var(--tg-bottom)))] md:[--app-top:0px] md:[--app-dock:0px]"
  const mainPad = kbOpen ? "pb-6 [&:has(>[data-fill])]:pb-0" : "pb-[var(--app-dock)] md:pb-6 [&:has(>[data-fill])]:pb-[var(--app-dock)] md:[&:has(>[data-fill])]:pb-0"

  return (
    <div className={`flex h-[var(--app-h,100dvh)] flex-col md:flex-row ${vars}`}>
      <Sidebar
        items={sidebarItems}
        className="pt-safe md:pt-8!"
        header={<Wordmark size={36} className="px-3" />}
        footer={<BusinessSwitcherMenu />}
      />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar flat={kbOpen} />
        <main
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-[calc(4.25rem+max(env(safe-area-inset-top),var(--tg-top)))] md:px-8 md:pt-8 [&:has(>[data-fill])]:overflow-hidden ${mainPad}`}
        >
          <Fragment key={user?.active_business_id ?? 0}>{children}</Fragment>
        </main>
        <BottomNav items={primary} pathname={path} moreActive={moreActive} onMore={() => setMoreOpen(true)} hidden={kbOpen} />
      </div>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} items={secondary} />
    </div>
  )
}
