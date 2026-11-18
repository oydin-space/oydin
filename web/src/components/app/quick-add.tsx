"use client"

import { ArrowDownLeft, ArrowUpRight, MessageCircle } from "lucide-react"
import Link from "next/link"
import { useCoreT } from "@/components/app/use-core-t"
import { Button } from "@/components/ui"
import { useT } from "@/i18n"
import type { Direction } from "@/lib/types"

interface Props {
  onEntry: (direction: Direction) => void
}

const CHUNKY = "min-h-14 px-3"

/** Quick actions: add income, add expense, ask Oydin. Voice lives in the dock mic. */
export function QuickAdd({ onEntry }: Props) {
  const t = useCoreT()
  const tb = useT()

  return (
    <section aria-label={t("core.dash.quickTitle")} className="grid grid-cols-2 gap-3">
      <Button size="lg" icon={ArrowDownLeft} className={CHUNKY} onClick={() => onEntry("in")}>{t("core.ops.in")}</Button>
      <Button size="lg" variant="secondary" icon={ArrowUpRight} className={CHUNKY} onClick={() => onEntry("out")}>{t("core.ops.out")}</Button>
      <Button size="lg" variant="secondary" asChild className={`${CHUNKY} col-span-2`}>
        <Link href="/app/chat">
          <MessageCircle className="size-5" strokeWidth={1.75} aria-hidden="true" />
          {tb("biz.home.qaAsk")}
        </Link>
      </Button>
    </section>
  )
}
