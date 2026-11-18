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
import { cn } from "@/lib/utils"
import { PeriodSheet, usePeriodLabels } from "./period-picker"
import { useCoreT } from "./use-core-t"

/**
 * Mobile floating glass header: flower circle · [business switcher | period] pill · settings/avatar circle.
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
    <header data-hidden={flat} className="shell-float-top pointer-events-none absolute inset-x-0 top-0 z-20 md:hidden">
      <div aria-hidden="true" className="absolute inset-x-0 -bottom-3 top-0 bg-gradient-to-b from-background from-75% to-transparent" />
      <div className="pt-safe relative px-3">
        <div className="mx-auto flex max-w-lg items-center gap-3 pt-3">
          <Link
            href="/app"
            aria-label={t("core.nav.home.logo")}
            className="glass-liquid shell-float-top pointer-events-auto focus-ring press grid size-11 shrink-0 place-items-center rounded-pill"
            data-hidden={flat}
          >
            <span className="grid size-8 place-items-center rounded-pill bg-brand text-white">
              <Flower className="size-5" />
            </span>
          </Link>
          <div
            data-hidden={flat}
            className={cn("glass-liquid shell-float-top pointer-events-auto flex h-11 min-w-0 flex-1 items-center gap-1 rounded-pill pl-2 pr-1")}
          >
            <BusinessSwitcherMenu className="min-w-0 flex-1 truncate !px-1 [&_[role=img]]:hidden" />
            <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={t("core.period.open", { month: full(current) })}
              onClick={() => setOpen(true)}
              className="focus-ring press -my-0.5 flex h-11 min-w-11 shrink-0 items-center rounded-pill px-2 text-caption font-medium capitalize text-muted-foreground"
            >
              {period}
            </button>
            <OfflineBadge />
          </div>
          <Link
            href="/app/settings"
            aria-label={t("core.nav.settings.open")}
            data-hidden={flat}
            className="glass-liquid shell-float-top pointer-events-auto focus-ring press grid size-11 shrink-0 place-items-center rounded-pill"
          >
            {user?.name ? <Avatar name={user.name} size={32} /> : <Icon icon={Settings} size={20} />}
          </Link>
        </div>
      </div>
      <PeriodSheet open={open} onOpenChange={setOpen} />
    </header>
  )
}
