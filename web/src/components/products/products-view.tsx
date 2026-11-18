"use client"

import { useState } from "react"
import { useCoreT } from "@/components/app/use-core-t"
import { useSession } from "@/components/providers/session-provider"
import { Info, Plus, Receipt, Tag, TrendingUp } from "lucide-react"
import { AmountText, Badge, Button, Card, EmptyState, ErrorState, Icon, Input, MoneyInput, PAGE_WIDTH, PageHeader, ProgressBar, SkeletonList, TaskSheet, Text } from "@/components/ui"
import { post } from "@/lib/api"
import type { Product } from "@/lib/types"
import { useApi } from "@/lib/use-api"

export function ProductsView() {
  const t = useCoreT()
  const { data, loading, error, reload } = useApi<{ items: Product[] }>("/products/")
  const items = data?.items ?? []
  const { user } = useSession()
  const canAdd = user?.role === "owner" && !user.businesses.find((b) => b.id === user.active_business_id)?.is_demo
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [price, setPrice] = useState<number | null>(null)
  const [cost, setCost] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const close = () => { setOpen(false); setName(""); setPrice(null); setCost(null); setFormError(null) }
  async function save() {
    setBusy(true)
    setFormError(null)
    try {
      await post("/products/", { name: name.trim(), price, unit_cost: cost })
      close()
      reload()
    } catch {
      setFormError(t("core.prod.saveFailed"))
    } finally {
      setBusy(false)
    }
  }
  const addButton = <Button icon={Plus} onClick={() => setOpen(true)}>{t("core.prod.add")}</Button>

  let body: React.ReactNode
  if (error) body = <ErrorState message={error} onRetry={reload} retryLabel={t("core.retry")} />
  else if (loading && !data) body = <SkeletonList rows={4} />
  else if (!items.length) body = <EmptyState title={t("core.prod.empty")} hint={t("core.prod.emptyHint")} action={canAdd ? addButton : undefined} />
  else
    body = (
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((p) => {
          // Cost and margins are stripped from the payload for roles that must not see them.
          const hasMargin = p.margin_pct != null
          return (
            <Card key={p.id} title={p.name}>
              <div className="flex items-baseline justify-between gap-3">
                <Text variant="secondary" tone="muted" className="flex items-center gap-2"><Icon icon={Tag} size={16} />{t("core.prod.price")}</Text>
                <AmountText value={p.price} />
              </div>
              {p.unit_cost != null ? (
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <Text variant="secondary" tone="muted" className="flex items-center gap-2"><Icon icon={Receipt} size={16} />{t("core.prod.cost")}</Text>
                  <span className="flex items-center gap-2">
                    {p.cost_is_estimate ? <Badge tone="caution" icon={<Icon icon={Info} size={16} />}>{t("core.prod.estimate")}</Badge> : null}
                    <AmountText value={p.unit_cost} />
                  </span>
                </div>
              ) : null}
              {hasMargin ? (
                <div className="mt-3 flex flex-col gap-1">
                  <ProgressBar value={Math.max(0, Math.min(1, p.margin_pct / 100))} label={t("core.prod.marginLabel", { name: p.name })} />
                  <Text variant="caption" tone="muted" className="flex items-center gap-1.5">
                    <Icon icon={TrendingUp} size={16} />
                    <span>
                      {t("core.prod.margin", { pct: String(Math.round(p.margin_pct)) })}
                      {p.markup_pct != null ? ` · ${t("core.prod.markup", { pct: String(Math.round(p.markup_pct)) })}` : ""}
                    </span>
                  </Text>
                </div>
              ) : null}
            </Card>
          )
        })}
      </div>
    )

  return (
    <div className={`${PAGE_WIDTH} flex flex-col gap-4 pb-6`}>
      <PageHeader title={t("core.prod.title")} hint={t("core.prod.hint")} actions={canAdd ? addButton : undefined} />
      {body}
      <TaskSheet
        open={open}
        onOpenChange={(o) => { if (!o) close() }}
        title={t("core.prod.add")}
        closeLabel={t("core.prod.close")}
        submitLabel={t("core.prod.save")}
        cancelLabel={t("core.prod.cancel")}
        dirty={name !== "" || price != null || cost != null}
        submitting={busy}
        submitDisabled={!name.trim() || !price || cost == null}
        onSubmit={() => void save()}
      >
        <div className="flex flex-col gap-3">
          <Input label={t("core.prod.name")} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} required />
          <MoneyInput label={t("core.prod.price")} value={price} onValueChange={setPrice} currency="UZS" required />
          <MoneyInput label={t("core.prod.cost")} value={cost} onValueChange={setCost} currency="UZS" required />
          {formError ? <p role="alert" className="text-caption text-danger">{formError}</p> : null}
        </div>
      </TaskSheet>
    </div>
  )
}
