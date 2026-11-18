"use client"

import { Check, FilePenLine, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useCoreT } from "@/components/app/use-core-t"
import { AmountText, Button, Card, Icon, Section, Text } from "@/components/ui"
import { api } from "@/lib/api"
import { currencyOf } from "@/lib/core-api"
import type { Account, Transaction } from "@/lib/types"
import { txSigned, txTitle } from "./tx-row"

interface Props {
  drafts: Transaction[]
  accounts: Account[]
  onEdit: (tx: Transaction) => void
  onChanged: () => void
}

export function DraftsSection({ drafts, accounts, onEdit, onChanged }: Props) {
  const t = useCoreT()
  const [busy, setBusy] = useState<number | null>(null)

  async function run(tx: Transaction, action: "confirm" | "discard") {
    setBusy(tx.id)
    try {
      if (action === "confirm") await api(`/transactions/${tx.id}/`, { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) })
      else await api(`/transactions/${tx.id}/`, { method: "DELETE" })
      toast.success(t(action === "confirm" ? "core.ops.confirmed" : "core.ops.discarded"))
      onChanged()
    } catch (e) {
      toast.error(t("core.ops.saveFailed", { message: e instanceof Error ? e.message : "" }))
    } finally {
      setBusy(null)
    }
  }

  if (!drafts.length) return null
  return (
    <Section title={t("core.ops.draftsTitle")}>
      <Text variant="secondary" tone="muted">{t("core.ops.draftsHint")}</Text>
      <div className="flex flex-col gap-3">
        {drafts.map((tx) => (
          <Card key={tx.id} tint="butter">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Icon icon={FilePenLine} className="text-muted-foreground" />
                <div className="min-w-0">
                  <Text variant="body" className="truncate">{txTitle(tx, t("core.ops.uncategorized"))}</Text>
                  <Text variant="caption" tone="muted" className="truncate">{tx.category}</Text>
                </div>
              </div>
              <AmountText value={txSigned(tx)} currency={currencyOf(accounts, tx.account_id)} signed tone="auto" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" icon={Check} loading={busy === tx.id} onClick={() => run(tx, "confirm")}>{t("core.ops.confirm")}</Button>
              <Button size="sm" variant="secondary" icon={Pencil} onClick={() => onEdit(tx)}>{t("core.ops.formEdit")}</Button>
              <Button size="sm" variant="ghost" icon={Trash2} disabled={busy === tx.id} onClick={() => run(tx, "discard")}>{t("core.ops.discardDraft")}</Button>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  )
}
