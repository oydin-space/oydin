"use client"

import { CalendarDays, Plus, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useCoreT } from "@/components/app/use-core-t"
import { Button, EmptyState, ErrorState, FilterBar, Icon, Input, ListGroup, PAGE_WIDTH, PageHeader, SkeletonList, Text } from "@/components/ui"
import { groupByDate } from "@/lib/core-api"
import { dayMonth } from "@/lib/format"
import { periodRange, usePeriod } from "@/lib/period"
import { useI18n } from "@/i18n"
import { useApi } from "@/lib/use-api"
import type { Account, Transaction } from "@/lib/types"
import { DraftsSection } from "./drafts-section"
import { EntrySheet, type EntrySeed } from "./entry-sheet"
import { TxRow } from "./tx-row"

export function OperationsView() {
  const t = useCoreT()
  const { locale } = useI18n()
  const range = periodRange(usePeriod())
  const [purpose, setPurpose] = useState("all")
  const [q, setQ] = useState("")
  const [dq, setDq] = useState("")
  const [sheet, setSheet] = useState<{ n: number; seed: EntrySeed } | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDq(q.trim()), 300)
    return () => clearTimeout(id)
  }, [q])

  const params = new URLSearchParams({ status: "confirmed", limit: "100", from: range.from, to: range.to })
  if (purpose !== "all") params.set("purpose", purpose)
  if (dq) params.set("q", dq)
  const list = useApi<{ items: Transaction[] }>(`/transactions/?${params}`)
  const drafts = useApi<{ items: Transaction[] }>("/transactions/?status=draft&limit=50")
  const accounts = useApi<{ items: Account[] }>("/accounts/")
  const accs = useMemo(() => accounts.data?.items ?? [], [accounts.data])
  const groups = useMemo(() => groupByDate(list.data?.items ?? []), [list.data])

  const reload = () => {
    list.reload()
    drafts.reload()
  }
  const open = (seed: EntrySeed) => setSheet((s) => ({ n: (s?.n ?? 0) + 1, seed }))
  const edit = (tx: Transaction, draft = false) =>
    open({
      id: tx.id,
      draft,
      values: { amount: tx.amount, direction: tx.direction, purpose: tx.purpose, category: tx.category, account_id: tx.account_id, counterparty: tx.counterparty, note: tx.note, date: tx.date },
    })

  const options = (["all", "business", "personal", "unclear"] as const).map((v) => ({ value: v, label: v === "all" ? t("core.ops.all") : t(`core.ops.purpose.${v}`) }))
  const filtered = purpose !== "all" || dq !== ""

  let body: React.ReactNode
  if (list.error) body = <ErrorState message={list.error} onRetry={list.reload} retryLabel={t("core.retry")} />
  else if (list.loading && !list.data) body = <SkeletonList rows={6} />
  else if (!groups.length)
    body = (
      <EmptyState
        title={filtered ? t("core.ops.emptyFiltered") : t("core.ops.empty")}
        hint={filtered ? t("core.ops.emptyFilteredHint") : t("core.ops.emptyHint")}
        action={filtered ? undefined : <Button icon={Plus} onClick={() => open({})}>{t("core.ops.add")}</Button>}
      />
    )
  else
    body = (
      <div className="flex flex-col gap-4">
        {groups.map(({ date, items }) => (
          <div key={date} className="flex flex-col gap-1">
            <Text variant="caption" tone="muted" className="flex items-center gap-1.5 px-4"><Icon icon={CalendarDays} size={16} />{dayMonth(date, locale)}</Text>
            <ListGroup>
              {items.map((tx) => (
                <TxRow key={tx.id} tx={tx} accounts={accs} onOpen={(x) => edit(x)} />
              ))}
            </ListGroup>
          </div>
        ))}
      </div>
    )

  return (
    <div className={`${PAGE_WIDTH} flex flex-col gap-4 pb-6`}>
      <PageHeader title={t("core.ops.title")} hint={t("core.ops.hint")} actions={<Button icon={Plus} onClick={() => open({})}>{t("core.ops.add")}</Button>} />
      <DraftsSection drafts={drafts.data?.items ?? []} accounts={accs} onEdit={(tx) => edit(tx, true)} onChanged={reload} />
      <Input label={t("core.ops.search")} placeholder={t("core.ops.searchExample")} value={q} onChange={(e) => setQ(e.target.value)} leading={<Icon icon={Search} size={16} />} />
      <FilterBar label={t("core.ops.filter")} options={options} value={purpose} onValueChange={setPurpose} />
      {body}
      {sheet ? <EntrySheet key={sheet.n} accounts={accs} seed={sheet.seed} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); reload() }} /> : null}
    </div>
  )
}
