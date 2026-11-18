"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCheck, CalendarClock, Clock, Pause, Pencil, Plus, Repeat, Tag, Trash2 } from "lucide-react";
import { AmountText, Badge, Button, Card, Icon, Input, MoneyInput, Select, SegmentedControl, SkeletonCard, Switch, TaskSheet, Text } from "@/components/ui";
import { confirmCommitment, createCommitment, deleteCommitment, listAccounts, listCommitments, patchCommitment, today, type Account, type Commitment, type Frequency } from "@/lib/planning-api";
import { ConfirmDelete } from "./confirm-delete";
import { LoadView, useAction, useLoad, usePlanFormat, usePlanT } from "./plan-support";

interface Draft {
  id: number | null;
  title: string;
  category: string;
  direction: "in" | "out";
  amount: number | null;
  accountId: string;
  frequency: Frequency;
  nextDate: string;
  active: boolean;
}

export function CommitmentsPanel() {
  const t = usePlanT();
  const f = usePlanFormat();
  const res = useLoad(listCommitments);
  const accounts = useLoad(listAccounts);
  const { busy, run } = useAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<Commitment | null>(null);
  const accs: Account[] = accounts.data?.items ?? [];
  const accName = (id: number) => accs.find((a) => a.id === id)?.name ?? "";

  const open = (c?: Commitment) =>
    setDraft(
      c
        ? { id: c.id, title: c.title, category: c.category, direction: c.direction, amount: c.amount, accountId: String(c.account_id), frequency: c.frequency, nextDate: c.next_date, active: c.active }
        : { id: null, title: "", category: "", direction: "out", amount: null, accountId: accs[0] ? String(accs[0].id) : "", frequency: "monthly", nextDate: today(), active: true },
    );
  const valid = draft !== null && draft.title.trim() !== "" && !!draft.amount && draft.accountId !== "" && draft.nextDate !== "";
  const save = async () => {
    if (!draft || !valid) return;
    const body = { title: draft.title.trim(), category: draft.category.trim(), direction: draft.direction, amount: draft.amount!, account_id: Number(draft.accountId), frequency: draft.frequency, next_date: draft.nextDate, active: draft.active };
    if (await run(() => (draft.id == null ? createCommitment(body) : patchCommitment(draft.id, body)), t("commitments.saved"))) {
      setDraft(null);
      res.reload();
    }
  };
  const confirm = async (c: Commitment) => {
    if (await run(() => confirmCommitment(c.id), t("commitments.confirmed"))) res.reload();
  };
  const remove = async () => {
    if (!removing) return;
    if (await run(() => deleteCommitment(removing.id), t("commitments.deleted"))) {
      setRemoving(null);
      res.reload();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Button icon={Plus} onClick={() => open()} className="self-start" disabled={accs.length === 0}>
          {t("commitments.add")}
        </Button>
        <Text variant="secondary" tone="muted">
          {t("commitments.hint")}
        </Text>
      </div>
      <LoadView res={res} skeleton={<SkeletonCard />} isEmpty={(d) => d.items.length === 0} empty={{ title: t("commitments.empty"), hint: t("commitments.emptyHint") }}>
        {(d) => (
          <div className="grid gap-3 md:grid-cols-2">
            {d.items.map((c) => (
              <Card key={c.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Icon icon={c.direction === "out" ? ArrowUpRight : ArrowDownLeft} className="mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <Text variant="body" weight="semibold" className="truncate">
                        {c.title}
                      </Text>
                      <Text variant="caption" tone="muted" className="flex items-center gap-1.5">
                        <Icon icon={Repeat} size={16} className="shrink-0" />
                        <span>
                          {c.frequency === "weekly" ? t("freq.weekly") : t("freq.monthly")} · {t("commitments.next", { date: f.dateLong(c.next_date) })}
                          {accName(c.account_id) ? ` · ${accName(c.account_id)}` : ""}
                        </span>
                      </Text>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <AmountText value={c.direction === "out" ? -c.amount : c.amount} signed locale={f.locale} mode="compact" className="font-semibold" />
                    {!c.active ? <Badge icon={<Icon icon={Pause} size={16} />}>{t("commitments.paused")}</Badge> : c.due ? <Badge tone="caution" icon={<Icon icon={Clock} size={16} />}>{t("commitments.due")}</Badge> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.active ? (
                    <Button size="sm" icon={CheckCheck} variant={c.due ? "primary" : "secondary"} loading={busy} onClick={() => void confirm(c)}>
                      {c.direction === "out" ? t("commitments.confirmOut") : t("commitments.confirmIn")}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="secondary" icon={Pencil} onClick={() => open(c)}>
                    {t("common.edit")}
                  </Button>
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setRemoving(c)}>
                    {t("common.delete")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </LoadView>

      <TaskSheet
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id == null ? t("commitments.add") : t("commitments.edit")}
        closeLabel={t("common.close")}
        submitLabel={t("common.save")}
        cancelLabel={t("common.cancel")}
        discardTitle={t("common.discardTitle")}
        discardLabel={t("common.discard")}
        keepLabel={t("common.keep")}
        dirty={draft !== null && draft.title !== ""}
        submitting={busy}
        submitDisabled={!valid}
        onSubmit={() => void save()}
      >
        {draft ? (
          <div className="flex flex-col gap-3">
            <SegmentedControl<"in" | "out">
              label={t("commitments.direction")}
              options={[
                { value: "out", label: t("commitments.out") },
                { value: "in", label: t("commitments.in") },
              ]}
              value={draft.direction}
              onValueChange={(v) => setDraft({ ...draft, direction: v })}
            />
            <Input label={t("commitments.name")} value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
            <Input label={t("commitments.category")} value={draft.category} maxLength={60} onChange={(e) => setDraft({ ...draft, category: e.target.value })} leading={<Icon icon={Tag} size={16} />} />
            <Select label={t("commitments.account")} options={accs.map((a) => ({ value: String(a.id), label: `${a.name} · ${a.currency}` }))} value={draft.accountId} onValueChange={(v) => setDraft({ ...draft, accountId: v })} />
            <MoneyInput label={t("commitments.amount")} value={draft.amount} onValueChange={(v) => setDraft({ ...draft, amount: v })} currency={accs.find((a) => String(a.id) === draft.accountId)?.currency ?? "UZS"} locale={f.locale} required />
            <SegmentedControl<Frequency>
              label={t("commitments.frequency")}
              options={[
                { value: "weekly", label: t("freq.weekly") },
                { value: "monthly", label: t("freq.monthly") },
              ]}
              value={draft.frequency}
              onValueChange={(v) => setDraft({ ...draft, frequency: v })}
            />
            <Input label={t("commitments.nextDate")} type="date" value={draft.nextDate} onChange={(e) => setDraft({ ...draft, nextDate: e.target.value })} required leading={<Icon icon={CalendarClock} size={16} />} />
            <label className="flex min-h-row items-center justify-between gap-3">
              <Text variant="body">{t("commitments.active")}</Text>
              <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} aria-label={t("commitments.active")} />
            </label>
          </div>
        ) : null}
      </TaskSheet>
      <ConfirmDelete open={removing !== null} title={t("commitments.confirmDelete", { name: removing?.title ?? "" })} busy={busy} onConfirm={() => void remove()} onClose={() => setRemoving(null)} />
    </div>
  );
}
