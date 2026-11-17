"use client";

import { useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import { AmountText, Badge, Button, Card, Checkbox, Input, ListGroup, MoneyInput, Section, SegmentedControl, SkeletonCard, StatusBanner, Switch, TaskSheet, Text } from "@/components/ui";
import { createTaxReminder, deleteTaxReminder, getTaxReserve, listTaxReminders, patchTaxReminder, saveTaxReserve, today, type TaxMethod, type TaxPeriod, type TaxReminder, type TaxReserve } from "@/lib/planning-api";
import { ConfirmDelete } from "./confirm-delete";
import { LoadView, useAction, useLoad, usePlanFormat, usePlanT } from "./plan-support";

export function TaxPanel({ canWrite }: { canWrite: boolean }) {
  const t = usePlanT();
  return (
    <div className="flex flex-col gap-5">
      <StatusBanner kind="info" title={t("tax.notAdvice")}>
        {t("tax.notAdviceText")}
      </StatusBanner>
      <ReserveSection canWrite={canWrite} />
      <RemindersSection canWrite={canWrite} />
    </div>
  );
}

interface ReserveDraft {
  enabled: boolean;
  method: TaxMethod;
  period: TaxPeriod;
  fixed: number | null;
  percent: string;
}

function ReserveSection({ canWrite }: { canWrite: boolean }) {
  const t = usePlanT();
  const f = usePlanFormat();
  const res = useLoad(getTaxReserve);
  const { busy, run } = useAction();
  const [draft, setDraft] = useState<ReserveDraft | null>(null);

  const edit = (r: TaxReserve) => setDraft({ enabled: r.enabled, method: r.method, period: r.period, fixed: r.fixed_amount, percent: r.percent ?? "" });
  const save = async (r: TaxReserve) => {
    if (!draft) return;
    const ok = await run(
      () =>
        saveTaxReserve({
          enabled: draft.enabled,
          method: draft.method,
          period: draft.period,
          fixed_amount: draft.method === "fixed" ? (draft.fixed ?? 0) : null,
          percent: draft.method === "percent" ? draft.percent.trim() || "0" : null,
          confirmed_amount: r.confirmed_amount,
          base_categories: r.base_categories,
        }),
      t("tax.reserveSaved"),
    );
    if (ok) {
      setDraft(null);
      res.reload();
    }
  };

  return (
    <Section
      title={t("tax.reserveTitle")}
      action={
        canWrite && res.data ? (
          <Button size="sm" variant="secondary" icon={Settings2} onClick={() => edit(res.data!)}>
            {t("tax.configure")}
          </Button>
        ) : null
      }
    >
      <LoadView res={res} skeleton={<SkeletonCard />}>
        {(r) => (
          <>
            <Card tint={r.enabled ? "lavender" : undefined} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Text variant="secondary" tone="muted">
                  {t("tax.period", { from: f.date(r.period_from), to: f.date(r.period_to) })}
                </Text>
                <Badge tone={r.enabled ? "positive" : "neutral"}>{r.enabled ? t("tax.on") : t("tax.off")}</Badge>
              </div>
              {r.enabled ? (
                <>
                  <AmountText value={r.reserved} locale={f.locale} className="text-hero font-bold" />
                  <Text variant="secondary">{r.method === "fixed" ? t("tax.byFixed") : t("tax.byPercent", { percent: r.percent ?? "0", base: String(r.base_amount) })}</Text>
                  <Text variant="caption" tone="muted">
                    {r.provenance === "accountant_confirmed" ? t("tax.confirmedByAccountant") : t("tax.setByYou")}
                  </Text>
                </>
              ) : (
                <Text variant="body" tone="muted">
                  {t("tax.offHint")}
                </Text>
              )}
            </Card>
            <TaskSheet
              open={draft !== null}
              onOpenChange={(o) => !o && setDraft(null)}
              title={t("tax.reserveTitle")}
              description={t("tax.sheetHint")}
              closeLabel={t("common.close")}
              submitLabel={t("common.save")}
              cancelLabel={t("common.cancel")}
              discardTitle={t("common.discardTitle")}
              discardLabel={t("common.discard")}
              keepLabel={t("common.keep")}
              submitting={busy}
              onSubmit={() => void save(r)}
            >
              {draft ? (
                <div className="flex flex-col gap-3">
                  <label className="flex min-h-row items-center justify-between gap-3">
                    <Text variant="body">{t("tax.enable")}</Text>
                    <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} aria-label={t("tax.enable")} />
                  </label>
                  <SegmentedControl<TaxMethod>
                    label={t("tax.method")}
                    options={[
                      { value: "fixed", label: t("tax.fixed") },
                      { value: "percent", label: t("tax.percent") },
                    ]}
                    value={draft.method}
                    onValueChange={(v) => setDraft({ ...draft, method: v })}
                  />
                  {draft.method === "fixed" ? (
                    <MoneyInput label={t("tax.fixedAmount")} value={draft.fixed} onValueChange={(v) => setDraft({ ...draft, fixed: v })} currency="UZS" locale={f.locale} />
                  ) : (
                    <Input label={t("tax.percentLabel")} hint={t("tax.percentHint")} inputMode="decimal" value={draft.percent} onChange={(e) => setDraft({ ...draft, percent: e.target.value.replace(",", ".") })} trailing="%" />
                  )}
                  <SegmentedControl<TaxPeriod>
                    label={t("tax.periodLabel")}
                    options={[
                      { value: "month", label: t("tax.month") },
                      { value: "quarter", label: t("tax.quarter") },
                    ]}
                    value={draft.period}
                    onValueChange={(v) => setDraft({ ...draft, period: v })}
                  />
                </div>
              ) : null}
            </TaskSheet>
          </>
        )}
      </LoadView>
    </Section>
  );
}

interface ReminderDraft {
  id: number | null;
  title: string;
  kind: "payment" | "report";
  due: string;
  amount: number | null;
  notify: boolean;
  confirmed: boolean;
  originalDue: string;
}
const blank: ReminderDraft = { id: null, title: "", kind: "payment", due: "", amount: null, notify: false, confirmed: false, originalDue: "" };

function RemindersSection({ canWrite }: { canWrite: boolean }) {
  const t = usePlanT();
  const f = usePlanFormat();
  const res = useLoad(listTaxReminders);
  const { busy, run } = useAction();
  const [draft, setDraft] = useState<ReminderDraft | null>(null);
  const [removing, setRemoving] = useState<TaxReminder | null>(null);

  const open = (r?: TaxReminder) => setDraft(r ? { id: r.id, title: r.title, kind: r.kind, due: r.due_date, amount: r.amount, notify: r.notify_telegram, confirmed: false, originalDue: r.due_date } : blank);
  const dateChanged = draft !== null && (draft.id == null || draft.due !== draft.originalDue);
  const valid = draft !== null && draft.title.trim() !== "" && draft.due !== "" && (!dateChanged || draft.confirmed);

  const save = async () => {
    if (!draft || !valid) return;
    const body = { title: draft.title.trim(), kind: draft.kind, due_date: draft.due, amount: draft.amount, notify_telegram: draft.notify, ...(dateChanged ? { confirmed: true as const } : {}) };
    const ok = await run(() => (draft.id == null ? createTaxReminder(body) : patchTaxReminder(draft.id, body)), t("tax.reminderSaved"));
    if (ok) {
      setDraft(null);
      res.reload();
    }
  };
  const toggle = async (r: TaxReminder) => {
    if (await run(() => patchTaxReminder(r.id, { status: r.status === "done" ? "planned" : "done" }))) res.reload();
  };
  const remove = async () => {
    if (!removing) return;
    if (await run(() => deleteTaxReminder(removing.id), t("tax.reminderDeleted"))) {
      setRemoving(null);
      res.reload();
    }
  };

  return (
    <Section
      title={t("tax.remindersTitle")}
      action={
        canWrite ? (
          <Button size="sm" icon={Plus} onClick={() => open()}>
            {t("common.add")}
          </Button>
        ) : null
      }
    >
      <Text variant="secondary" tone="muted" className="px-1">
        {t("tax.remindersHint")}
      </Text>
      <LoadView res={res} isEmpty={(d) => d.items.length === 0} empty={{ title: t("tax.remindersEmpty"), hint: t("tax.remindersEmptyHint") }}>
        {(d) => (
          <ListGroup>
            {d.items.map((r) => (
              <ReminderRow key={r.id} r={r} canWrite={canWrite} onEdit={() => open(r)} onToggle={() => void toggle(r)} onRemove={() => setRemoving(r)} />
            ))}
          </ListGroup>
        )}
      </LoadView>

      <TaskSheet
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id == null ? t("tax.addReminder") : t("tax.editReminder")}
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
            <Input label={t("tax.reminderName")} value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
            <SegmentedControl<"payment" | "report">
              label={t("tax.kind")}
              options={[
                { value: "payment", label: t("tax.kindPayment") },
                { value: "report", label: t("tax.kindReport") },
              ]}
              value={draft.kind}
              onValueChange={(v) => setDraft({ ...draft, kind: v })}
            />
            <Input label={t("tax.dueDate")} type="date" value={draft.due} min={draft.id == null ? today() : undefined} onChange={(e) => setDraft({ ...draft, due: e.target.value, confirmed: false })} required />
            <MoneyInput label={t("tax.amountOptional")} value={draft.amount} onValueChange={(v) => setDraft({ ...draft, amount: v })} currency="UZS" locale={f.locale} />
            <label className="flex min-h-row items-center justify-between gap-3">
              <Text variant="body">{t("tax.notify")}</Text>
              <Switch checked={draft.notify} onCheckedChange={(v) => setDraft({ ...draft, notify: v })} aria-label={t("tax.notify")} />
            </label>
            {dateChanged ? (
              <label className="flex min-h-row items-start gap-3">
                <Checkbox checked={draft.confirmed} onCheckedChange={(v) => setDraft({ ...draft, confirmed: v === true })} aria-label={t("tax.confirmDate")} className="mt-1" />
                <Text variant="secondary">{t("tax.confirmDate")}</Text>
              </label>
            ) : null}
          </div>
        ) : null}
      </TaskSheet>
      <ConfirmDelete open={removing !== null} title={t("tax.confirmDelete", { name: removing?.title ?? "" })} busy={busy} onConfirm={() => void remove()} onClose={() => setRemoving(null)} />
    </Section>
  );
}

function ReminderRow({ r, canWrite, onEdit, onToggle, onRemove }: { r: TaxReminder; canWrite: boolean; onEdit: () => void; onToggle: () => void; onRemove: () => void }) {
  const t = usePlanT();
  const f = usePlanFormat();
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Text variant="body" className="truncate">
            {r.title}
          </Text>
          <Text variant="secondary" tone="muted">
            {r.kind === "payment" ? t("tax.kindPayment") : t("tax.kindReport")} · {f.dateLong(r.due_date)}
          </Text>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {r.amount != null ? <AmountText value={r.amount} locale={f.locale} mode="compact" className="font-medium" /> : null}
          <Badge tone={r.status === "done" ? "positive" : "neutral"}>{r.status === "done" ? t("tax.done") : t("tax.planned")}</Badge>
        </div>
      </div>
      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={onToggle}>
            {r.status === "done" ? t("tax.reopen") : t("tax.markDone")}
          </Button>
          <Button size="sm" variant="secondary" onClick={onEdit}>
            {t("common.edit")}
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove}>
            {t("common.delete")}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
