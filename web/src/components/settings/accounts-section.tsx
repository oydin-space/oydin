"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { AmountText, Badge, Button, EmptyState, FeedbackNotice, Input, ListGroup, ListRow, MoneyInput, PlainCard, Section, Select, SkeletonList } from "@/components/ui";
import { type AccountKind, createAccount } from "@/lib/auth-api";
import { fetchRates, listAccounts } from "@/lib/settings-api";
import type { Currency } from "@/lib/types";
import { FormSheet } from "./sheets";
import { ResourceGate } from "./resource-gate";
import { useResource } from "./use-resource";
import { useST } from "./use-st";

const KINDS: AccountKind[] = ["cash", "card", "bank"];
const CURRENCIES: Currency[] = ["UZS", "USD"];

function RateCard() {
  const { t, locale, formatDate } = useST();
  const { data, loading, error, reload } = useResource(fetchRates);
  return (
    <ResourceGate loading={loading} error={error} onRetry={reload} skeleton={<SkeletonList rows={1} />}>
      {data ? (
        <PlainCard title={t("settings.accounts.rateTitle")}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body font-medium">{t("settings.accounts.rateLine", { rate: Number(data.USD).toLocaleString(locale === "en" ? "en-US" : "ru-RU") })}</span>
            <Badge tone={data.stale ? "caution" : "positive"}>{data.stale ? t("settings.accounts.rateStale") : t("settings.accounts.rateFresh")}</Badge>
          </div>
          <p className="mt-1 text-small text-muted-foreground">{t("settings.accounts.rateMeta", { date: formatDate(data.date) })}</p>
          {data.stale ? <p className="mt-1 text-small">{t("settings.accounts.rateStaleHint")}</p> : null}
        </PlainCard>
      ) : null}
    </ResourceGate>
  );
}

function AddAccount({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const { t, err, locale } = useST();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("cash");
  const [currency, setCurrency] = useState<Currency>("UZS");
  const [opening, setOpening] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setTouched(true);
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createAccount({ name: name.trim(), kind, currency, opening_balance: opening ?? 0 });
      setName("");
      setOpening(null);
      setTouched(false);
      onOpenChange(false);
      onCreated();
    } catch (x) {
      setError(err(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("settings.accounts.add")}
      submitLabel={t("settings.common.create")}
      onSubmit={submit}
      submitting={busy}
      dirty={!!name || opening != null}
    >
      <div className="flex flex-col gap-3">
        <Input label={t("settings.accounts.name")} placeholder={t("settings.accounts.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} error={touched && !name.trim() ? t("settings.profile.nameRequired") : undefined} required />
        <Select
          label={t("settings.accounts.kind")}
          value={kind}
          onValueChange={(v) => setKind(KINDS.find((k) => k === v) ?? "cash")}
          options={KINDS.map((k) => ({ value: k, label: t(`settings.accounts.kind.${k}`) }))}
        />
        <Select
          label={t("settings.accounts.currency")}
          value={currency}
          onValueChange={(v) => setCurrency(CURRENCIES.find((c) => c === v) ?? "UZS")}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
        <MoneyInput label={t("settings.accounts.opening")} value={opening} onValueChange={setOpening} currency={currency} locale={locale} />
        {error ? <FeedbackNotice kind="error">{error}</FeedbackNotice> : null}
      </div>
    </FormSheet>
  );
}

export function AccountsSection() {
  const { t, locale } = useST();
  const { user } = useSession();
  const { data, loading, error, reload } = useResource(listAccounts);
  const [adding, setAdding] = useState(false);
  const canWrite = user?.role === "owner";

  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("settings.accounts.title")}
        action={
          canWrite ? (
            <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>
              {t("settings.accounts.add")}
            </Button>
          ) : undefined
        }
      >
        <p className="mb-2 text-small text-muted-foreground">{t("settings.accounts.hint")}{canWrite ? "" : ` ${t("settings.accounts.noWrite")}`}</p>
        <ResourceGate loading={loading} error={error} onRetry={reload}>
          {data && data.length === 0 ? (
            <EmptyState title={t("settings.accounts.empty")} hint={t("settings.accounts.emptyHint")} />
          ) : (
            <ListGroup>
              {data?.map((a) => (
                <ListRow
                  key={a.id}
                  title={a.name}
                  status={<Badge>{t(`settings.accounts.kind.${a.kind}`)}</Badge>}
                  trailing={a.balance == null ? undefined : <AmountText value={a.balance} currency={a.currency} locale={locale} />}
                />
              ))}
            </ListGroup>
          )}
        </ResourceGate>
      </Section>
      <RateCard />
      {canWrite ? <AddAccount open={adding} onOpenChange={setAdding} onCreated={reload} /> : null}
    </div>
  );
}
