"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, ClipboardCheck, CalendarDays, StickyNote, TrendingDown, TrendingUp } from "lucide-react";
import { AmountText, Badge, Card, Icon, Input, ListGroup, ListRow, Button, Section, Select, SkeletonCard, Text, FeedbackNotice } from "@/components/ui";
import { MoneyInput } from "@/components/ui";
import { api } from "@/lib/api";
import { cashExpected, listAccounts, saveCashClose, today, type CashClose } from "@/lib/planning-api";
import { LoadView, type Loaded, useAction, useLoad, usePlanFormat, usePlanT } from "./plan-support";

export function ClosePanel() {
  const t = usePlanT();
  const accounts = useLoad(listAccounts);
  const history = useLoad(() => api<{ items: CashClose[] }>("/cash-close/"));
  return (
    <div className="flex flex-col gap-5">
      <LoadView res={accounts} skeleton={<SkeletonCard />} isEmpty={(d) => d.items.length === 0} empty={{ title: t("close.noAccounts") }}>
        {(d) => <CloseForm accounts={d.items} onSaved={history.reload} />}
      </LoadView>
      <HistorySection res={history} />
    </div>
  );
}

function CloseForm({ accounts, onSaved }: { accounts: { id: number; name: string; currency: "UZS" | "USD" }[]; onSaved: () => void }) {
  const t = usePlanT();
  const f = usePlanFormat();
  const { busy, run } = useAction();
  const [accountId, setAccountId] = useState(String(accounts[0].id));
  const [date, setDate] = useState(today());
  const [counted, setCounted] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [expected, setExpected] = useState<{ key: string; value: number | null; failed: boolean } | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const account = accounts.find((a) => String(a.id) === accountId) ?? accounts[0];
  const wanted = `${accountId}|${date}`;

  useEffect(() => {
    let cancelled = false;
    cashExpected(Number(accountId), date)
      .then((r) => !cancelled && setExpected({ key: wanted, value: r.expected, failed: false }))
      .catch(() => !cancelled && setExpected({ key: wanted, value: null, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [accountId, date, wanted]);

  const current = expected?.key === wanted ? expected : null;
  const diff = current?.value != null && counted != null ? counted - current.value : null;

  const submit = async () => {
    if (counted == null) return;
    const ok = await run(() => saveCashClose({ account_id: account.id, date, counted, note: note.trim() || undefined }, key), t("close.saved"));
    if (ok) {
      setCounted(null);
      setNote("");
      setKey(crypto.randomUUID());
      onSaved();
    }
  };

  return (
    <Card title={t("close.title")} description={t("close.hint")}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {accounts.length > 1 ? <Select label={t("close.account")} options={accounts.map((a) => ({ value: String(a.id), label: `${a.name} · ${a.currency}` }))} value={accountId} onValueChange={setAccountId} /> : null}
        <Input label={t("close.date")} type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} leading={<Icon icon={CalendarDays} size={16} />} />
        <div className="flex items-baseline justify-between gap-3 rounded-control bg-muted px-3 py-3">
          <Text variant="secondary" tone="muted">
            {t("close.expected")}
          </Text>
          {current ? current.failed ? <Text variant="secondary" tone="danger">{t("close.expectedFailed")}</Text> : <AmountText value={current.value} currency={account.currency} locale={f.locale} className="text-body font-semibold" /> : <span className="h-5 w-24 animate-pulse rounded-control bg-border" aria-hidden="true" />}
        </div>
        <MoneyInput label={t("close.counted")} value={counted} onValueChange={setCounted} currency={account.currency} locale={f.locale} required />
        {diff != null ? <Difference diff={diff} currency={account.currency} /> : null}
        <Input label={t("close.note")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} leading={<Icon icon={StickyNote} size={16} />} />
        <Button type="submit" icon={Check} loading={busy} disabled={counted == null}>
          {t("close.save")}
        </Button>
      </form>
    </Card>
  );
}

function Difference({ diff, currency }: { diff: number; currency: "UZS" | "USD" }) {
  const t = usePlanT();
  const f = usePlanFormat();
  return diff === 0 ? (
    <FeedbackNotice>{t("close.match")}</FeedbackNotice>
  ) : (
    <div className="flex items-center justify-between gap-2">
      <Badge tone={diff < 0 ? "negative" : "caution"} icon={<Icon icon={diff < 0 ? TrendingDown : TrendingUp} size={16} />}>{diff < 0 ? t("close.short") : t("close.over")}</Badge>
      <AmountText value={diff} currency={currency} locale={f.locale} signed className="text-body font-semibold" />
    </div>
  );
}

function HistorySection({ res }: { res: Loaded<{ items: CashClose[] }> }) {
  const t = usePlanT();
  const f = usePlanFormat();
  const sorted = useMemo(() => (res.data ? [...res.data.items].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id) : []), [res.data]);
  return (
    <Section title={t("close.history")}>
      <LoadView res={res} isEmpty={(d) => d.items.length === 0} empty={{ title: t("close.empty"), hint: t("close.emptyHint") }}>
        {() => (
          <ListGroup>
            {sorted.map((c) => (
              <ListRow
                key={c.id}
                leading={<Icon icon={ClipboardCheck} className="text-muted-foreground" />}
                title={f.dateLong(c.date)}
                subtitle={c.note || undefined}
                status={c.difference === 0 ? <Badge tone="positive" icon={<Icon icon={CheckCircle2} size={16} />}>{t("close.match")}</Badge> : <Badge tone={c.difference < 0 ? "negative" : "caution"} icon={<Icon icon={c.difference < 0 ? TrendingDown : TrendingUp} size={16} />}>{c.difference < 0 ? t("close.short") : t("close.over")}</Badge>}
                trailing={<AmountText value={c.difference} currency={c.currency} locale={f.locale} mode="compact" signed />}
              />
            ))}
          </ListGroup>
        )}
      </LoadView>
    </Section>
  );
}
