"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { useCoreT, type CoreKey } from "@/components/app/use-core-t"
import { Input, MoneyInput, SegmentedControl, Select, TaskSheet } from "@/components/ui"
import { api } from "@/lib/api"
import { currencyOf, todayIso } from "@/lib/core-api"
import type { Account, Direction, Purpose, Transaction, TransactionInput } from "@/lib/types"

export interface EntrySeed {
  /** Present when editing or confirming an existing entry. */
  id?: number
  /** Saving a draft also confirms it. */
  draft?: boolean
  values?: Partial<TransactionInput>
}

interface Props {
  accounts: Account[]
  seed: EntrySeed
  onClose: () => void
  onSaved: (tx: Transaction) => void
}

/** Add / edit sheet. Mount it only while open (key it per session): form state starts from `seed`. */
export function EntrySheet({ accounts, seed, onClose, onSaved }: Props) {
  const t = useCoreT()
  const v = seed.values ?? {}
  const initial = {
    amount: v.amount ?? null,
    direction: (v.direction ?? "out") as Direction,
    purpose: (v.purpose ?? "business") as Purpose,
    accountId: v.account_id != null ? String(v.account_id) : accounts.length === 1 ? String(accounts[0].id) : "",
    category: v.category ?? "",
    counterparty: v.counterparty ?? "",
    date: v.date ?? todayIso(),
    note: v.note ?? "",
  }
  const [form, setForm] = useState(initial)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const fieldsRef = useRef<HTMLDivElement>(null)
  const set = <K extends keyof typeof initial>(key: K, value: (typeof initial)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const editing = seed.id != null
  const accountId = form.accountId ? Number(form.accountId) : null
  const errors = {
    amount: !form.amount || form.amount <= 0 ? t("core.ops.errAmount") : undefined,
    account: accountId == null ? t("core.ops.errAccount") : undefined,
    category: !form.category.trim() ? t("core.ops.errCategory") : undefined,
  }
  const invalid = Boolean(errors.amount || errors.account || errors.category)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)

  // Keep an existing non-default value selectable (transfer, unclear, owner_*), otherwise just two choices.
  const directionOptions = [
    { value: "out" as Direction, label: t("core.ops.out") },
    { value: "in" as Direction, label: t("core.ops.in") },
    ...(initial.direction === "transfer" ? [{ value: "transfer" as Direction, label: t("core.ops.transfer") }] : []),
  ]
  const purposeOptions = [
    { value: "business" as Purpose, label: t("core.ops.purpose.business") },
    { value: "personal" as Purpose, label: t("core.ops.purpose.personal") },
    ...(initial.purpose !== "business" && initial.purpose !== "personal" ? [{ value: initial.purpose, label: t(`core.ops.purpose.${initial.purpose}` as CoreKey) }] : []),
  ]

  async function submit() {
    setAttempted(true)
    if (invalid || accountId == null || form.amount == null) {
      // Errors render (aria-invalid) on the next frame; then move focus to the first invalid field.
      requestAnimationFrame(() => fieldsRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    setSaving(true)
    const body: TransactionInput = {
      amount: form.amount,
      direction: form.direction,
      purpose: form.purpose,
      category: form.category.trim(),
      account_id: accountId,
      counterparty: form.counterparty.trim() || null,
      note: form.note,
      date: form.date,
    }
    try {
      const payload = seed.draft ? { ...body, status: "confirmed" } : body
      const tx = await api<Transaction>(editing ? `/transactions/${seed.id}/` : "/transactions/", { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) })
      toast.success(t("core.ops.saved"))
      onSaved(tx)
    } catch (e) {
      toast.error(t("core.ops.saveFailed", { message: e instanceof Error ? e.message : "" }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <TaskSheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={editing ? t("core.ops.formEdit") : t("core.ops.formAdd")}
      dirty={dirty}
      submitLabel={t("core.ops.save")}
      cancelLabel={t("core.cancel")}
      closeLabel={t("core.close")}
      discardTitle={t("core.discardTitle")}
      discardLabel={t("core.discard")}
      keepLabel={t("core.keepEditing")}
      onSubmit={submit}
      submitting={saving}
    >
      <div ref={fieldsRef} className="flex flex-col gap-4">
        <SegmentedControl label={t("core.ops.direction")} options={directionOptions} value={form.direction} onValueChange={(d) => set("direction", d)} />
        <MoneyInput label={t("core.ops.amount")} value={form.amount} onValueChange={(a) => set("amount", a)} currency={currencyOf(accounts, accountId)} error={attempted ? errors.amount : undefined} required />
        <Select
          label={t("core.ops.account")}
          placeholder={accounts.length ? t("core.ops.accountPlaceholder") : t("core.ops.noAccounts")}
          options={accounts.map((a) => ({ value: String(a.id), label: `${a.name} · ${a.currency}` }))}
          value={form.accountId || undefined}
          onValueChange={(id) => set("accountId", id)}
          error={attempted ? errors.account : undefined}
          required
        />
        <Input label={t("core.ops.category")} value={form.category} onChange={(e) => set("category", e.target.value)} error={attempted ? errors.category : undefined} required />
        <SegmentedControl label={t("core.ops.purpose")} options={purposeOptions} value={form.purpose} onValueChange={(p) => set("purpose", p)} />
        <Input label={t("core.ops.counterparty")} value={form.counterparty} onChange={(e) => set("counterparty", e.target.value)} />
        <Input label={t("core.ops.date")} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
        <Input label={t("core.ops.note")} value={form.note} onChange={(e) => set("note", e.target.value)} />
      </div>
    </TaskSheet>
  )
}
