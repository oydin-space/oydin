"use client"

import Link from "next/link"
import { useState } from "react"
import { Settings } from "lucide-react"
import { Flower } from "@/components/brand/flower"
import { BusinessSwitcherMenu } from "@/components/business/business-switcher-menu"
import { OfflineBadge } from "@/components/offline"
import { useSession } from "@/components/providers/session-provider"
import { Avatar, Icon } from "@/components/ui"
import { usePeriod } from "@/lib/period"
import { PeriodSheet, usePeriodLabels } from "./period-picker"
import { useCoreT } from "./use-core-t"

/**
 * Mobile floating header: one glass pill holding flower · business switcher | period · settings/avatar.
 * `flat` (keyboard open) drops the elevation so it stops floating over the field.
 */
export function TopBar({ flat }: { flat: boolean }) {
  const t = useCoreT()
  const { user } = useSession()
  const current = usePeriod()
  const [open, setOpen] = useState(false)
  const { month, full } = usePeriodLabels()
  const period = month(current)

  return (
    <header data-hidden={flat} className="pointer-events-none absolute inset-x-0 top-0 z-20 md:hidden">
      <div className="pt-safe relative px-3">
        <div
          data-hidden={flat}
          className="glass-liquid shell-float-top pointer-events-auto mx-auto mt-3 flex h-14 max-w-lg items-center gap-2 rounded-pill px-1.5"
        >
          <Link
            href="/app"
            aria-label={t("core.nav.home.logo")}
            className="focus-ring press grid size-11 shrink-0 place-items-center rounded-pill"
          >
            <span className="grid size-9 place-items-center rounded-pill bg-brand text-white">
              <Flower className="size-5" />
            </span>
          </Link>
          <BusinessSwitcherMenu className="min-w-0 flex-1 truncate !px-1 [&_[role=img]]:hidden" />
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={t("core.period.open", { month: full(current) })}
            onClick={() => setOpen(true)}
            className="focus-ring press flex h-11 min-w-11 shrink-0 items-center rounded-pill px-2 text-caption font-medium capitalize text-muted-foreground"
          >
            {period}
          </button>
          <OfflineBadge />
          <Link
            href="/app/settings"
            aria-label={t("core.nav.settings.open")}
            className="focus-ring press grid size-11 shrink-0 place-items-center rounded-pill"
          >
            {user?.name ? <Avatar name={user.name} size={32} /> : <Icon icon={Settings} size={20} />}
          </Link>
        </div>
      </div>
      <PeriodSheet open={open} onOpenChange={setOpen} />
    </header>
  )
}
