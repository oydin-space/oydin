"use client"

import { useRouter } from "next/navigation"
import { Icon, ListGroup, ListRow, Sheet } from "@/components/ui"
import { haptic } from "@/lib/telegram"
import type { NavEntry } from "./nav"
import { useCoreT } from "./use-core-t"

export function MoreSheet({ open, onOpenChange, items }: { open: boolean; onOpenChange: (open: boolean) => void; items: readonly NavEntry[] }) {
  const t = useCoreT()
  const router = useRouter()
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("core.nav.more")} closeLabel={t("core.close")}>
      <ListGroup>
        {items.map((e) => (
          <ListRow
            key={e.id}
            title={t(e.label)}
            leading={<Icon icon={e.icon} />}
            chevron
            onClick={() => {
              haptic("select")
              onOpenChange(false)
              router.push(e.href)
            }}
          />
        ))}
      </ListGroup>
    </Sheet>
  )
}
