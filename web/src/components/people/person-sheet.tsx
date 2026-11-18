"use client";

import { useState } from "react";
import { Button, Dialog, Input, Select, TaskSheet, Textarea, toast } from "@/components/ui";
import { useT } from "@/i18n";
import { CURRENCIES, KINDS, PAY_TYPES, peopleApi, type PeopleLocation, type PersonInput, type Person, type PersonCurrency, type PayType, type PersonKind } from "@/lib/people-api";
import { peopleError } from "./format";

const NO_LOCATION = "none";
const AMOUNT = /^\d+(\.\d{1,2})?$/;

interface Draft {
  name: string;
  kind: PersonKind;
  pay_type: PayType;
  pay_amount: string;
  currency: PersonCurrency;
  location: string;
  role_title: string;
  started_on: string;
  ended_on: string;
  note: string;
}

const toDraft = (p: Person | null, kind: PersonKind): Draft => ({
  name: p?.name ?? "",
  kind: p?.kind ?? kind,
  pay_type: p?.pay_type ?? "monthly",
  pay_amount: p?.pay_amount ?? "",
  currency: p?.currency ?? "UZS",
  location: p?.location_id != null ? String(p.location_id) : NO_LOCATION,
  role_title: p?.role_title ?? "",
  started_on: p?.started_on ?? "",
  ended_on: p?.ended_on ?? "",
  note: p?.note ?? "",
});

/** Mount only while open so every opening starts from a fresh draft. */
export function PersonSheet({
  person,
  defaultKind,
  locations,
  onClose,
  onChanged,
}: {
  person: Person | null;
  defaultKind: PersonKind;
  locations: PeopleLocation[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const t = useT();
  const [draft, setDraft] = useState(() => toDraft(person, defaultKind));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };

  const paid = draft.pay_type !== "none";
  const amount = draft.pay_amount.trim().replace(",", ".");
  const errors = {
    name: draft.name.trim() ? undefined : t("people.err.name"),
    amount: paid && amount && !AMOUNT.test(amount) ? t("people.err.amount") : undefined,
    dates: draft.started_on && draft.ended_on && draft.ended_on < draft.started_on ? t("people.err.dates") : undefined,
  };
  const invalid = Boolean(errors.name || errors.amount || errors.dates);
  const [showErrors, setShowErrors] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
      toast.success(t("people.toast.saved"));
      onClose();
    } catch (e) {
      setError(peopleError(e, t));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (invalid) return setShowErrors(true);
    const body: PersonInput = {
      name: draft.name.trim(),
      kind: draft.kind,
      pay_type: draft.pay_type,
      pay_amount: paid && amount ? amount : null,
      currency: draft.currency,
      location_id: draft.location === NO_LOCATION ? null : Number(draft.location),
      role_title: draft.role_title.trim(),
      started_on: draft.started_on || null,
      ended_on: draft.ended_on || null,
      note: draft.note.trim(),
    };
    void run(() => (person ? peopleApi.update(person.id, body) : peopleApi.create(body)));
  }

  function remove() {
    if (!person) return;
    setBusy(true);
    setError(null);
    peopleApi.remove(person.id).then(
      async () => {
        await onChanged();
        toast.success(t("people.toast.deleted"));
        onClose();
      },
      (e) => {
        setError(peopleError(e, t));
        setConfirming(false);
        setBusy(false);
      },
    );
  }

  return (
    <>
      <TaskSheet
        open={!confirming}
        onOpenChange={(v) => !v && onClose()}
        title={person ? t("people.sheet.editTitle") : t("people.sheet.addTitle")}
        closeLabel={t("people.close")}
        dirty={dirty}
        submitLabel={t("people.save")}
        cancelLabel={t("people.cancel")}
        onSubmit={submit}
        submitting={busy}
      >
        <div className="flex flex-col gap-4">
          <Input label={t("people.field.name")} value={draft.name} onChange={(e) => set("name", e.target.value)} error={showErrors ? errors.name : undefined} required autoComplete="off" />
          <Select
            label={t("people.field.kind")}
            value={draft.kind}
            onValueChange={(v) => set("kind", v as PersonKind)}
            options={KINDS.map((k) => ({ value: k, label: t(`people.kindOne.${k}`) }))}
          />
          <Input label={t("people.field.roleTitle")} value={draft.role_title} onChange={(e) => set("role_title", e.target.value)} />
          <Select
            label={t("people.field.payType")}
            value={draft.pay_type}
            onValueChange={(v) => set("pay_type", v as PayType)}
            options={PAY_TYPES.map((p) => ({ value: p, label: t(`people.pay.${p}`) }))}
          />
          {paid ? (
            <div className="grid grid-cols-[1fr_8rem] gap-3">
              <Input
                label={t("people.field.payAmount")}
                value={draft.pay_amount}
                onChange={(e) => set("pay_amount", e.target.value)}
                inputMode="decimal"
                error={showErrors ? errors.amount : undefined}
              />
              <Select
                label={t("people.field.currency")}
                value={draft.currency}
                onValueChange={(v) => set("currency", v as PersonCurrency)}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
            </div>
          ) : null}
          <Select
            label={t("people.field.location")}
            value={draft.location}
            onValueChange={(v) => set("location", v)}
            options={[{ value: NO_LOCATION, label: t("people.field.noLocation") }, ...locations.map((l) => ({ value: String(l.id), label: l.name }))]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" label={t("people.field.startedOn")} value={draft.started_on} onChange={(e) => set("started_on", e.target.value)} />
            <Input type="date" label={t("people.field.endedOn")} value={draft.ended_on} onChange={(e) => set("ended_on", e.target.value)} error={showErrors ? errors.dates : undefined} />
          </div>
          <Textarea label={t("people.field.note")} value={draft.note} onChange={(e) => set("note", e.target.value)} rows={3} />
          {error ? (
            <p role="alert" className="text-small text-danger">
              {error}
            </p>
          ) : null}
          {person ? (
            <Button variant="destructive" onClick={() => setConfirming(true)} disabled={busy}>
              {t("people.delete")}
            </Button>
          ) : null}
        </div>
      </TaskSheet>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("people.delete.title", { name: person?.name ?? "" })}
        description={t("people.delete.hint")}
        closeLabel={t("people.close")}
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
              {t("people.cancel")}
            </Button>
            <Button variant="destructive" className="flex-1" loading={busy} onClick={remove}>
              {t("people.delete")}
            </Button>
          </>
        }
      />
    </>
  );
}
