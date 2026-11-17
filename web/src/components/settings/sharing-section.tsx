"use client";

import { FileDown, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, FeedbackNotice, Input, ListGroup, ListRow, Section, Select } from "@/components/ui";
import { createShareLink, listShareLinks, revokeShareLink, type ShareLink, sharePdfUrl } from "@/lib/settings-api";
import { ResourceGate } from "./resource-gate";
import { SecretBox } from "./secret-box";
import { ConfirmDialog, FormSheet } from "./sheets";
import { useResource } from "./use-resource";
import { useST } from "./use-st";

const DAYS = ["7", "30", "90"] as const;
const DAY_MS = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function NewLink({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (l: ShareLink) => void }) {
  const { t, err } = useST();
  const [label, setLabel] = useState("");
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 30 * DAY_MS)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [days, setDays] = useState<string>("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const periodBad = !from || !to || from > to;

  async function submit() {
    if (periodBad) {
      setError(t("settings.sharing.periodInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const link = await createShareLink({ label: label.trim(), period_from: from, period_to: to, expires_at: new Date(Date.now() + Number(days) * DAY_MS).toISOString() });
      setLabel("");
      onOpenChange(false);
      onCreated(link);
    } catch (x) {
      setError(err(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={t("settings.sharing.new")} submitLabel={t("settings.common.create")} onSubmit={submit} submitting={busy} dirty={!!label}>
      <div className="flex flex-col gap-3">
        <Input label={t("settings.sharing.label")} placeholder={t("settings.sharing.labelPlaceholder")} value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" label={t("settings.sharing.from")} value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" label={t("settings.sharing.to")} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Select label={t("settings.sharing.expires")} value={days} onValueChange={setDays} options={DAYS.map((d) => ({ value: d, label: t(`settings.sharing.days${d}`) }))} />
        {error ? <FeedbackNotice kind="error">{error}</FeedbackNotice> : null}
      </div>
    </FormSheet>
  );
}

export function SharingSection() {
  const { t, err, formatDate } = useST();
  const { data, loading, error, reload } = useResource(listShareLinks);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ShareLink | null>(null);
  const [target, setTarget] = useState<ShareLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function revoke() {
    if (!target) return;
    setBusy(true);
    setProblem(null);
    try {
      await revokeShareLink(target.id);
      setTarget(null);
      toast(t("settings.sharing.revoked"));
      reload();
    } catch (x) {
      setProblem(err(x));
      setTarget(null);
    } finally {
      setBusy(false);
    }
  }

  const badge = (l: ShareLink) =>
    l.revoked_at ? <Badge tone="negative">{t("settings.sharing.revokedBadge")}</Badge> : new Date(l.expires_at) < new Date() ? <Badge tone="caution">{t("settings.sharing.expiredBadge")}</Badge> : <Badge tone="positive">{t("settings.sharing.active")}</Badge>;

  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("settings.sharing.title")}
        action={
          <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
            {t("settings.sharing.new")}
          </Button>
        }
      >
        <p className="text-small text-muted-foreground">{t("settings.sharing.hint")}</p>
        {created ? (
          <SecretBox title={t("settings.sharing.createdTitle")} label={t("settings.sharing.createdHint")} value={created.url}>
            <Button asChild size="sm" variant="secondary" icon={FileDown}>
              <a href={sharePdfUrl(created.url)} target="_blank" rel="noopener noreferrer">
                {t("settings.sharing.pdf")}
              </a>
            </Button>
          </SecretBox>
        ) : null}
        {problem ? <FeedbackNotice kind="error">{problem}</FeedbackNotice> : null}
        <ResourceGate loading={loading} error={error} onRetry={reload}>
          {data && data.length === 0 ? (
            <EmptyState title={t("settings.sharing.empty")} hint={t("settings.sharing.emptyHint")} />
          ) : (
            <ListGroup>
              {data?.map((l) => (
                <ListRow
                  key={l.id}
                  title={l.label || t("settings.sharing.noLabel")}
                  subtitle={`${t("settings.sharing.period", { from: formatDate(l.period_from), to: formatDate(l.period_to) })} · ${t("settings.sharing.until", { date: formatDate(l.expires_at) })} · ${t("settings.sharing.views", { count: l.views })}`}
                  status={badge(l)}
                  trailing={
                    l.revoked_at ? undefined : (
                      <Button size="sm" variant="ghost" onClick={() => setTarget(l)}>
                        {t("settings.common.revoke")}
                      </Button>
                    )
                  }
                />
              ))}
            </ListGroup>
          )}
        </ResourceGate>
      </Section>
      <NewLink
        open={creating}
        onOpenChange={setCreating}
        onCreated={(l) => {
          setCreated(l);
          reload();
        }}
      />
      <ConfirmDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)} title={t("settings.sharing.revokeTitle")} description={t("settings.sharing.revokeHint")} confirmLabel={t("settings.common.revoke")} busy={busy} onConfirm={revoke} />
    </div>
  );
}
