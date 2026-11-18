"use client"

import Link from "next/link"
import { Settings } from "lucide-react"
import { Flower } from "@/components/brand/flower"
import { BusinessSwitcherMenu } from "@/components/business/business-switcher-menu"
import { OfflineBadge } from "@/components/offline"
import { useSession } from "@/components/providers/session-provider"
import { Avatar, Icon } from "@/components/ui"
import { useLocale } from "@/i18n"
import { cn } from "@/lib/utils"
import { useCoreT } from "./use-core-t"

const INTL: Record<string, string> = { ru: "ru-RU", uz: "uz-UZ", en: "en-US" }

/**
 * Mobile floating glass header: flower circle · [business switcher | period] pill · settings/avatar circle.
 * `flat` (keyboard open) drops the elevation so it stops floating over the field.
 */
export function TopBar({ flat }: { flat: boolean }) {
  const t = useCoreT()
  const { user } = useSession()
  const [locale] = useLocale()
  const period = new Intl.DateTimeFormat(INTL[locale] ?? "ru-RU", { month: "long" }).format(new Date())

  return (
    <header data-hidden={flat} className="shell-float-top pointer-events-none absolute inset-x-0 top-0 z-20 md:hidden">
      <div className="pt-safe px-3">
        <div className="mx-auto flex max-w-lg items-center gap-2 pt-2">
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
            className={cn("glass-liquid shell-float-top pointer-events-auto flex h-11 min-w-0 flex-1 items-center gap-1 rounded-pill pl-1 pr-3")}
          >
            <BusinessSwitcherMenu className="min-w-0 flex-1 !px-1 [&_[role=img]]:hidden" />
            <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
            <span className="shrink-0 pl-1 text-caption font-medium capitalize text-muted-foreground">{period}</span>
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
    </header>
  )
}
