"use client";

import { MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { Button, Dialog, Icon, Input, ListGroup, ListRow, Section, TaskSheet, toast } from "@/components/ui";
import { useT } from "@/i18n";
import { peopleApi, type PeopleLocation, type PeopleSummary } from "@/lib/people-api";
import { peopleError } from "./format";

type Panel = { loc: PeopleLocation | null } | null;

function LocationSheet({ loc, onClose, onChanged }: { loc: PeopleLocation | null; onClose: () => void; onChanged: () => Promise<void> }) {
  const t = useT();
  const [name, setName] = useState(loc?.name ?? "");
  const [address, setAddress] = useState(loc?.address ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
      toast.success(done);
      onClose();
    } catch (e) {
      setError(peopleError(e, t));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (!name.trim()) return setShowErrors(true);
    const body = { name: name.trim(), address: address.trim() };
    void run(() => (loc ? peopleApi.updateLocation(loc.id, body) : peopleApi.createLocation(body)), t("people.toast.saved"));
  }

  return (
    <>
      <TaskSheet
        open={!confirming}
        onOpenChange={(v) => !v && onClose()}
        title={loc ? loc.name : t("people.locations.add")}
        closeLabel={t("people.close")}
        dirty={dirty}
        submitLabel={t("people.save")}
        cancelLabel={t("people.cancel")}
        onSubmit={submit}
        submitting={busy}
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t("people.locations.name")}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            error={showErrors && !name.trim() ? t("people.err.name") : undefined}
            required
            autoComplete="off"
          />
          <Input
            label={t("people.locations.address")}
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setDirty(true);
            }}
            autoComplete="off"
          />
          {error ? (
            <p role="alert" className="text-small text-danger">
              {error}
            </p>
          ) : null}
          {loc ? (
            <Button variant="destructive" onClick={() => setConfirming(true)} disabled={busy}>
              {t("people.delete")}
            </Button>
          ) : null}
        </div>
      </TaskSheet>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("people.delete.title", { name: loc?.name ?? "" })}
        description={t("people.locations.deleteHint")}
        closeLabel={t("people.close")}
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
              {t("people.cancel")}
            </Button>
            <Button variant="destructive" className="flex-1" loading={busy} onClick={() => loc && void run(() => peopleApi.removeLocation(loc.id), t("people.toast.deleted"))}>
              {t("people.delete")}
            </Button>
          </>
        }
      />
    </>
  );
}

export function LocationsManager({ locations, summary, onChanged }: { locations: PeopleLocation[]; summary: PeopleSummary; onChanged: () => Promise<void> }) {
  const t = useT();
  const [panel, setPanel] = useState<Panel>(null);
  const counts = new Map(summary.by_location.map((l) => [l.location_id, l.headcount]));
  return (
    <Section title={t("people.locations.title")} action={<Button variant="secondary" icon={Plus} onClick={() => setPanel({ loc: null })}>{t("people.locations.add")}</Button>}>
      {locations.length === 0 ? (
        <p className="text-small text-muted-foreground">{t("people.locations.empty")}</p>
      ) : (
        <ListGroup>
          {locations.map((l) => (
            <ListRow
              key={l.id}
              title={l.name}
              subtitle={l.address || undefined}
              leading={<Icon icon={MapPin} size={20} className="text-muted-foreground" />}
              trailing={<span className="text-small text-muted-foreground">{t("people.locations.people", { count: counts.get(l.id) ?? 0 })}</span>}
              chevron
              onClick={() => setPanel({ loc: l })}
            />
          ))}
        </ListGroup>
      )}
      {panel ? <LocationSheet key={panel.loc?.id ?? "new"} loc={panel.loc} onClose={() => setPanel(null)} onChanged={onChanged} /> : null}
    </Section>
  );
}
