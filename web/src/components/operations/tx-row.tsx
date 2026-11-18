"use client"

import { useCoreT, type CoreKey } from "@/components/app/use-core-t"
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CircleHelp, UserRound } from "lucide-react"
import { AmountText, Badge, Icon, ListRow } from "@/components/ui"
import { currencyOf } from "@/lib/core-api"
import type { Account, Transaction } from "@/lib/types"

export function txTitle(tx: Transaction, fallback: string) {
  return tx.counterparty || tx.category || fallback
}

export function txSigned(tx: Transaction) {
  return tx.direction === "out" ? -tx.amount : tx.amount
}

export function TxRow({ tx, accounts, onOpen }: { tx: Transaction; accounts: Account[]; onOpen: (tx: Transaction) => void }) {
  const t = useCoreT()
  const account = accounts.find((a) => a.id === tx.account_id)
  const purposeLabel = t(`core.ops.purpose.${tx.purpose}` as CoreKey)
  const sub = [tx.category, account?.name].filter(Boolean).join(" · ")
  return (
    <ListRow
      title={txTitle(tx, t("core.ops.uncategorized"))}
      wrapTitle
      subtitle={sub ? <span className="line-clamp-2 whitespace-normal break-words">{sub}</span> : undefined}
      leading={<Icon icon={tx.direction === "in" ? ArrowDownLeft : tx.direction === "out" ? ArrowUpRight : ArrowLeftRight} className="text-muted-foreground" />}
      status={tx.purpose !== "business" ? <Badge tone={tx.purpose === "unclear" ? "caution" : "neutral"} icon={<Icon icon={tx.purpose === "unclear" ? CircleHelp : UserRound} size={16} />}>{purposeLabel}</Badge> : undefined}
      trailing={<AmountText value={txSigned(tx)} currency={currencyOf(accounts, tx.account_id)} signed tone={tx.direction === "transfer" ? "none" : "auto"} />}
      onClick={() => onOpen(tx)}
    />
  )
}
