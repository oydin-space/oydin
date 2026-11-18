"use client";

import { useCallback, useMemo, useState } from "react";
import { Calculator, CheckCircle2, CircleAlert, Save, TriangleAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session-provider";
import { Badge, Button, Card, EmptyState, ErrorState, Icon, Input, ListGroup, ListRow, MoneyInput, PAGE_WIDTH, PageHeader, Section, SkeletonList, Text } from "@/components/ui";
import { translate, useI18n, type Locale } from "@/i18n";
import { ApiError } from "@/lib/api";
import { checkMoneyAfford, getSplit, saveSplit, type AffordMoneyResult, type MoneyVerdict, type OwnerSplitData } from "./money-api";
import { getBudgetPace, getElapsed, largestRemainder } from "./money-math";
import { useLoad } from "./plan-support";
import { SegmentedBar } from "./segmented-bar";
import type { money } from "@/i18n/parts/money";

type MoneyKey = keyof typeof money.en extends `money.${infer K}` ? K : never;
type Params = Record<string, string | number>;

function useMoneyT() {
  const { locale } = useI18n();
  return useCallback((key: MoneyKey, params?: Params) => translate(locale as Locale, `money.${key}` as never, params), [locale]);
}

const VERDICT = {
  yes: { tint: "mint", icon: CheckCircle2, tone: "positive" },
  risky: { tint: "butter", icon: CircleAlert, tone: "caution" },
  no: { tint: "rose", icon: XCircle, tone: "negative" },
} as const;

export function MoneyView() {
  const t = useMoneyT();
  const { user } = useSession();
  const allowed = user?.role === "owner" || user?.role === "accountant";
  const res = useLoad(getSplit);
  if (!allowed) return <EmptyState title={t("forbidden.title")} hint={t("forbidden.hint")} />;

  return (
    <div className={`${PAGE_WIDTH} flex flex-col gap-5`}>
      <PageHeader title={t("title")} hint={t("hint")} />
      {res.forbidden ? (
        <EmptyState title={t("forbidden.title")} hint={t("forbidden.hint")} />
      ) : res.loading ? (
        <SkeletonList rows={4} />
      ) : res.error || !res.data ? (
        <ErrorState message={t("loadError")} onRetry={res.reload} />
      ) : (
        <>
          <SplitCard data={res.data} canEdit={user?.role === "owner"} onSaved={res.reload} />
          <OwnerFlows data={res.data} />
          <AffordCard />
        </>
      )}
    </div>
  );
}

const SEGMENT_CLASS = { afloat: "bg-foreground", development: "bg-primary", owner: "bg-mint" } as const;

function SplitCard({ data, canEdit, onSaved }: { data: OwnerSplitData; canEdit: boolean; onSaved: () => void }) {
  const t = useMoneyT();
  const { formatMoney } = useI18n();
  const [ownerPct, setOwnerPct] = useState(data.owner.pct);
  const [busy, setBusy] = useState(false);
  const dirty = ownerPct !== data.owner.pct;
  const cantCompute = data.development.amount === null || data.owner.amount === null;
  const free = (data.development.amount ?? 0) + (data.owner.amount ?? 0);
  const [dev, own] = largestRemainder(free, [100 - ownerPct, ownerPct]);
  const rows = [
    { id: "afloat", label: t("split.afloat"), amount: data.afloat.amount, pct: null as number | null },
    { id: "development", label: t("split.development"), amount: dev, pct: 100 - ownerPct },
    { id: "owner", label: t("split.owner"), amount: own, pct: ownerPct },
  ] as const;
  const empty = data.balance === 0 && data.afloat.needed === 0;

  const save = async () => {
    setBusy(true);
    try {
      await saveSplit(100 - ownerPct, ownerPct);
      toast.success(t("share.saved"));
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError && e.message === "demo_tenant" ? t("share.demo") : e instanceof ApiError && e.message === "forbidden" ? t("share.ownerOnly") : t("err.generic"));
    } finally {
      setBusy(false);
    }
  };

  if (empty) return <EmptyState title={t("split.empty.title")} hint={t("split.empty.hint")} />;

  return (
    <Card title={t("split.title")} description={t("split.netHint")} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Text variant="secondary" tone="muted">{t("split.net")}</Text>
        <span className="text-display font-bold tabular-nums">{formatMoney(data.net)}</span>
        <Text variant="secondary" tone="muted">{t("split.setAside", { tax: formatMoney(data.tax_reserve), envelopes: formatMoney(data.envelopes) })}</Text>
      </div>

      {cantCompute ? (
        <Text variant="secondary">{t("split.cantCompute")}</Text>
      ) : data.net > 0 ? (
        <>
          <SegmentedBar label={t("split.title")} segments={rows.map((r) => ({ label: r.label, value: r.amount, className: SEGMENT_CLASS[r.id] }))} />
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id} className="flex min-h-11 items-center gap-3">
                <span aria-hidden className={`size-3 shrink-0 rounded-full ${SEGMENT_CLASS[r.id]}`} />
                <span className="flex-1 text-body">
                  {r.label}
                  {r.pct !== null ? <span className="text-muted-foreground"> · {r.pct}%</span> : null}
                </span>
                <span className="font-semibold tabular-nums">{formatMoney(r.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {data.shortfall > 0 ? (
        <Card tint="rose" className="flex items-start gap-2">
          <Icon icon={TriangleAlert} size={20} className="mt-0.5 shrink-0" />
          <Text>{t("split.shortfall", { amount: formatMoney(data.shortfall) })}</Text>
        </Card>
      ) : null}

      <Afloat data={data} />

      <Section title={t("share.title")}>
        <div className="flex flex-col gap-3">
          <Text variant="secondary" tone="muted">{t("share.hint")}</Text>
          {!data.configured ? <Text variant="secondary">{t("split.notSet")}</Text> : null}
          <label className="flex flex-col gap-2">
            <span className="text-small font-medium">{t("share.slider")}</span>
            <input type="range" min={0} max={100} step={5} value={ownerPct} disabled={!canEdit} onChange={(e) => setOwnerPct(Number(e.target.value))} className="h-11 w-full accent-[#3b342a]" />
          </label>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-small font-medium">
            <span>{t("share.development", { pct: 100 - ownerPct })}</span>
            <span>{t("share.owner", { pct: ownerPct })}</span>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button icon={Save} loading={busy} disabled={!dirty} onClick={save}>{t("share.save")}</Button>
              {dirty ? <Text variant="secondary" tone="muted">{t("share.unsaved")}</Text> : null}
            </div>
          ) : (
            <Text variant="secondary" tone="muted">{t("share.ownerOnly")}</Text>
          )}
        </div>
      </Section>
    </Card>
  );
}

function Afloat({ data }: { data: OwnerSplitData }) {
  const t = useMoneyT();
  const { formatMoney, formatDate } = useI18n();
  const a = data.afloat;
  return (
    <Section title={`${t("split.afloat")} · ${formatMoney(a.needed)}`}>
      <Text variant="secondary" tone="muted" className="mb-2">{t("split.afloatHint", { days: data.horizon_days })}</Text>
      {a.payroll_unconverted.length ? (
        <Text variant="secondary" className="mb-2">{t("split.unconverted", { list: a.payroll_unconverted.join(", ") })}</Text>
      ) : null}
      <ListGroup>
        <ListRow title={t("split.payroll")} trailing={<span className="tabular-nums">{formatMoney(a.payroll)}</span>} />
        <ListRow title={t("split.obligations")} trailing={<span className="tabular-nums">{formatMoney(a.obligations)}</span>} />
      </ListGroup>
      {a.items.length ? (
        <ListGroup className="mt-3">
          {a.items.map((it, i) => (
            <ListRow
              key={`${it.kind}-${i}`}
              title={it.title}
              subtitle={it.date ? formatDate(it.date) : undefined}
              status={it.overdue ? <Badge tone="negative">{t("split.overdue")}</Badge> : undefined}
              trailing={<span className="tabular-nums">{formatMoney(it.amount)}</span>}
            />
          ))}
        </ListGroup>
      ) : (
        <Text variant="secondary" tone="muted" className="mt-2">{t("split.noItems")}</Text>
      )}
    </Section>
  );
}

function OwnerFlows({ data }: { data: OwnerSplitData }) {
  const t = useMoneyT();
  const { formatMoney } = useI18n();
  const m = data.owner_money;
  const pace = useMemo(() => {
    if (m.draw_month <= 0 || data.owner.amount === null) return null;
    const now = new Date();
    const elapsed = getElapsed(new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1), now);
    return getBudgetPace({ budget: m.draw_month + data.owner.amount, elapsed, spent: m.draw_month });
  }, [m.draw_month, data.owner.amount]);

  return (
    <Card title={t("owner.title")} description={t("owner.hint")} className="flex flex-col gap-3">
      {m.draw_month === 0 && m.contribution_month === 0 ? (
        <Text variant="secondary" tone="muted">{t("owner.none")}</Text>
      ) : (
        <ListGroup>
          <ListRow title={t("owner.draw")} trailing={<span className="font-semibold tabular-nums">{formatMoney(m.draw_month)}</span>} />
          <ListRow title={t("owner.contribution")} trailing={<span className="font-semibold tabular-nums">{formatMoney(m.contribution_month)}</span>} />
        </ListGroup>
      )}
      {pace ? (
        <div className="flex flex-col gap-1" aria-live="polite">
          <Badge tone={pace.status === "on-track" || pace.status === "under" ? "positive" : pace.status === "at-risk" ? "caution" : "negative"} className="self-start">
            {t(`pace.${pace.status}` as MoneyKey)}
          </Badge>
          <Text variant="secondary" tone="muted">{t("pace.line", { projected: formatMoney(Math.round(pace.projected)), budget: formatMoney(pace.budget) })}</Text>
        </div>
      ) : null}
    </Card>
  );
}

function AffordCard() {
  const t = useMoneyT();
  const { formatMoney, formatDate } = useI18n();
  const [amount, setAmount] = useState<number | null>(null);
  const [reserve, setReserve] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [r, setR] = useState<AffordMoneyResult | null>(null);

  const submit = async () => {
    if (!amount || amount <= 0) return;
    setBusy(true);
    setError(null);
    try {
      setR(await checkMoneyAfford({ amount, currency: "UZS", date: date || undefined, reserve: reserve || undefined }));
    } catch (e) {
      setR(null);
      setError(e instanceof ApiError && e.message === "no_rate" ? t("err.noRate") : e instanceof ApiError && e.status === 400 ? e.message || t("err.invalid") : t("err.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t("afford.title")} description={t("afford.hint")} className="flex flex-col gap-4">
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <MoneyInput label={t("afford.amount")} value={amount} onValueChange={setAmount} currency="UZS" required />
        <Input label={t("afford.date")} hint={t("afford.dateHint")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <MoneyInput label={t("afford.reserve")} hint={t("afford.reserveHint")} value={reserve} onValueChange={setReserve} currency="UZS" />
        <Button type="submit" icon={Calculator} loading={busy} disabled={!amount || amount <= 0}>{t("afford.check")}</Button>
      </form>
      <div aria-live="polite" className="flex flex-col gap-4">
        {error ? <Text tone="danger">{error}</Text> : null}
        {r ? <AffordAnswer r={r} formatMoney={formatMoney} formatDate={formatDate} /> : null}
      </div>
    </Card>
  );
}

function AffordAnswer({ r, formatMoney, formatDate }: { r: AffordMoneyResult; formatMoney: (n: number) => string; formatDate: (d: string) => string }) {
  const t = useMoneyT();
  const v = VERDICT[r.verdict];
  const n = r.numbers;
  return (
    <>
      <Card tint={v.tint} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Icon icon={v.icon} size={24} />
          <span className="text-section font-semibold">{t(`afford.${r.verdict}` as MoneyKey)}</span>
        </div>
        <Text>{r.explanation}</Text>
        {r.verdict !== "yes" ? (
          <Text className="font-medium">{r.earliest_date ? t("afford.when", { date: formatDate(r.earliest_date) }) : t("afford.never")}</Text>
        ) : null}
      </Card>
      <Section title={t("afford.numbers")}>
        <ListGroup>
          <ListRow title={t("afford.balance")} trailing={<span className="tabular-nums">{formatMoney(n.balance_now)}</span>} />
          <ListRow title={t("afford.buffer")} trailing={<span className="tabular-nums">{formatMoney(n.buffer)}</span>} />
          <ListRow title={t("afford.lowest")} trailing={<span className="tabular-nums">{formatMoney(r.min_balance_after)}</span>} />
          <ListRow title={t("afford.max")} trailing={<span className="tabular-nums">{formatMoney(n.max_affordable)}</span>} />
          {r.gap_date ? <ListRow title={t("afford.gap")} trailing={<Badge tone="negative">{formatDate(r.gap_date)}</Badge>} /> : null}
        </ListGroup>
      </Section>
      {r.alternatives.length ? (
        <Section title={t("afford.alternatives")}>
          <ListGroup>
            {r.alternatives.map((a, i) => (
              <ListRow key={i} title={a.title} status={<VerdictBadge verdict={a.verdict} />} />
            ))}
          </ListGroup>
        </Section>
      ) : null}
      <Section title={t("afford.assumptions")}>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-small text-muted-foreground">
          {r.assumptions.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </Section>
    </>
  );
}

function VerdictBadge({ verdict }: { verdict: MoneyVerdict }) {
  const t = useMoneyT();
  const v = VERDICT[verdict];
  return <Badge tone={v.tone} icon={<Icon icon={v.icon} size={16} />}>{t(`afford.${verdict}` as MoneyKey)}</Badge>;
}
