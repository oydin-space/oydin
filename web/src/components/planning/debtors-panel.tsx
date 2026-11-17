"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MessageSquareText } from "lucide-react";
import { AmountText, Badge, Button, Card, ListGroup, Section, SkeletonCard, StatusBanner, TaskSheet, Text, Textarea } from "@/components/ui";
import { draftDebtorReminder, listDebtorReminders, listDebtors, patchDebtorReminder, type Debtor, type DebtorReminder } from "@/lib/planning-api";
import { LoadView, useAction, useLoad, usePlanFormat, usePlanT } from "./plan-support";

export function DebtorsPanel({ canEdit }: { canEdit: boolean }) {
  const t = usePlanT();
  const debtors = useLoad(listDebtors);
  const reminders = useLoad(listDebtorReminders);
  const { busy, run } = useAction();
  const [editing, setEditing] = useState<DebtorReminder | null>(null);
  const [text, setText] = useState("");

  const draft = async (name: string) => {
    if (await run(() => draftDebtorReminder(name), t("debtors.drafted"))) reminders.reload();
  };
  const approve = async (r: DebtorReminder) => {
    if (await run(() => patchDebtorReminder(r.id, { status: "approved" }), t("debtors.approved"))) reminders.reload();
  };
  const saveText = async () => {
    if (!editing || !text.trim()) return;
    if (await run(() => patchDebtorReminder(editing.id, { text: text.trim() }), t("debtors.textSaved"))) {
      setEditing(null);
      reminders.reload();
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <StatusBanner kind="info" title={t("debtors.manualTitle")}>
        {t("debtors.manualText")}
      </StatusBanner>
      <Section title={t("debtors.title")}>
        <LoadView res={debtors} skeleton={<SkeletonCard />} isEmpty={(d) => d.items.length === 0} empty={{ title: t("debtors.empty"), hint: t("debtors.emptyHint") }}>
          {(d) => (
            <div className="grid gap-3 md:grid-cols-2">
              {d.items.map((x) => (
                <DebtorCard key={x.counterparty} d={x} busy={busy} onDraft={() => void draft(x.counterparty)} />
              ))}
            </div>
          )}
        </LoadView>
      </Section>
      <Section title={t("debtors.remindersTitle")}>
        <LoadView res={reminders} isEmpty={(d) => d.items.length === 0} empty={{ title: t("debtors.remindersEmpty"), hint: t("debtors.remindersEmptyHint") }}>
          {(d) => (
            <div className="grid gap-3 md:grid-cols-2">
              {d.items.map((r) => (
                <ReminderCard
                  key={r.id}
                  r={r}
                  canEdit={canEdit}
                  busy={busy}
                  onEdit={() => {
                    setEditing(r);
                    setText(r.text);
                  }}
                  onApprove={() => void approve(r)}
                />
              ))}
            </div>
          )}
        </LoadView>
      </Section>
      <TaskSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing?.counterparty ?? ""}
        description={t("debtors.editHint")}
        closeLabel={t("common.close")}
        submitLabel={t("common.save")}
        cancelLabel={t("common.cancel")}
        discardTitle={t("common.discardTitle")}
        discardLabel={t("common.discard")}
        keepLabel={t("common.keep")}
        dirty={editing !== null && text !== editing.text}
        submitting={busy}
        submitDisabled={!text.trim()}
        onSubmit={() => void saveText()}
      >
        <Textarea label={t("debtors.text")} value={text} rows={6} maxLength={1000} onChange={(e) => setText(e.target.value)} />
      </TaskSheet>
    </div>
  );
}

function DebtorCard({ d, busy, onDraft }: { d: Debtor; busy: boolean; onDraft: () => void }) {
  const t = usePlanT();
  const f = usePlanFormat();
  const [open, setOpen] = useState(false);
  const late = d.overdue_days > 0;
  const tone = !late ? "neutral" : d.overdue_days > 30 ? "negative" : "caution";
  return (
    <Card tint={late ? undefined : "mint"} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Text variant="body" weight="semibold" className="truncate">
            {d.counterparty}
          </Text>
          <Text variant="caption" tone="muted">
            {t("debtors.since", { date: f.dateLong(d.oldest_due_date) })}
          </Text>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <AmountText value={d.balance} locale={f.locale} mode="compact" className="font-semibold" />
          <Badge tone={tone}>{late ? t("debtors.overdue", { days: d.overdue_days }) : t("debtors.notDue")}</Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={MessageSquareText} loading={busy} onClick={onDraft}>
          {t("debtors.draft")}
        </Button>
        <Button size="sm" variant="ghost" icon={open ? ChevronUp : ChevronDown} onClick={() => setOpen(!open)} aria-expanded={open}>
          {t("debtors.entries", { n: d.entries.length })}
        </Button>
      </div>
      {open ? (
        <ListGroup>
          {d.entries.map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-2">
              <div className="min-w-0">
                <Text variant="secondary" className="truncate">
                  {e.title}
                </Text>
                <Text variant="caption" tone="muted">
                  {f.dateLong(e.due_date)}
                </Text>
              </div>
              <AmountText value={e.amount} locale={f.locale} mode="compact" />
            </li>
          ))}
        </ListGroup>
      ) : null}
    </Card>
  );
}

function ReminderCard({ r, canEdit, busy, onEdit, onApprove }: { r: DebtorReminder; canEdit: boolean; busy: boolean; onEdit: () => void; onApprove: () => void }) {
  const t = usePlanT();
  const f = usePlanFormat();
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <Text variant="body" weight="semibold" className="truncate">
          {r.counterparty}
        </Text>
        <Badge tone={r.status === "approved" ? "positive" : "caution"}>{r.status === "approved" ? t("debtors.statusApproved") : t("debtors.statusDraft")}</Badge>
      </div>
      <Text variant="secondary" className="whitespace-pre-wrap">
        {r.text}
      </Text>
      <div className="flex items-center justify-between gap-2">
        <AmountText value={r.amount} locale={f.locale} mode="compact" />
        {canEdit ? (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={onEdit}>
              {t("common.edit")}
            </Button>
            {r.status === "draft" ? (
              <Button size="sm" loading={busy} onClick={onApprove}>
                {t("debtors.approve")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
