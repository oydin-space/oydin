"use client";

import { useState } from "react";
import { Calculator, CalendarCheck, CalendarDays, CalendarX, CheckCircle2, CircleAlert, Coins, Tag, TriangleAlert, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, Icon, Input, ListGroup, ListRow, MoneyInput, Section, SegmentedControl, Switch, Text, AmountText } from "@/components/ui";
import { checkAfford, today, type AffordResult, type Frequency, type Verdict } from "@/lib/planning-api";
import type { Currency } from "@/lib/types";
import { useErrorText, usePlanFormat, usePlanT, type PlanKey } from "./plan-support";

const VERDICT = {
  yes: { tint: "mint", icon: CheckCircle2, tone: "positive" },
  risky: { tint: "butter", icon: CircleAlert, tone: "caution" },
  no: { tint: "rose", icon: XCircle, tone: "negative" },
} as const;

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const t = usePlanT();
  const v = VERDICT[verdict];
  return (
    <Badge tone={v.tone} icon={<Icon icon={v.icon} size={16} />}>
      {t(`afford.verdict.${verdict}` as PlanKey)}
    </Badge>
  );
}

export function AffordPanel() {
  const t = usePlanT();
  const f = usePlanFormat();
  const errorText = useErrorText();
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState<Currency>("UZS");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [freq, setFreq] = useState<Frequency>("monthly");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AffordResult | null>(null);

  const submit = async () => {
    if (!amount || amount <= 0) return;
    setBusy(true);
    try {
      setResult(await checkAfford({ amount, currency, title: title.trim() || undefined, date: date || undefined, recurring: recurring ? freq : undefined }));
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card title={t("afford.title")} description={t("afford.hint")}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <SegmentedControl<Currency>
            label={t("afford.currency")}
            options={[
              { value: "UZS", label: "UZS" },
              { value: "USD", label: "USD" },
            ]}
            value={currency}
            onValueChange={setCurrency}
          />
          <MoneyInput label={t("afford.amount")} value={amount} onValueChange={setAmount} currency={currency} locale={f.locale} required />
          <Input label={t("afford.what")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("afford.whatPlaceholder")} leading={<Icon icon={Tag} size={16} />} />
          <Input label={t("afford.date")} hint={t("afford.dateHint")} type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} leading={<Icon icon={CalendarDays} size={16} />} />
          <label className="flex min-h-row items-center justify-between gap-3">
            <Text variant="body">{t("afford.recurring")}</Text>
            <Switch checked={recurring} onCheckedChange={setRecurring} aria-label={t("afford.recurring")} />
          </label>
          {recurring ? (
            <SegmentedControl<Frequency>
              label={t("afford.frequency")}
              options={[
                { value: "weekly", label: t("freq.weekly") },
                { value: "monthly", label: t("freq.monthly") },
              ]}
              value={freq}
              onValueChange={setFreq}
            />
          ) : null}
          <Button type="submit" icon={Calculator} loading={busy} disabled={!amount || amount <= 0}>
            {t("afford.check")}
          </Button>
        </form>
      </Card>
      {result ? <AffordResultView r={result} currency={currency} /> : null}
    </div>
  );
}

function AffordResultView({ r, currency }: { r: AffordResult; currency: Currency }) {
  const t = usePlanT();
  const f = usePlanFormat();
  const v = VERDICT[r.verdict];
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <Card tint={v.tint} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Icon icon={v.icon} size={24} />
          <Text as="h3" variant="section" weight="semibold">
            {t(`afford.verdict.${r.verdict}` as PlanKey)}
          </Text>
        </div>
        <Text variant="body">{r.explanation}</Text>
      </Card>

      <Section title={t("afford.effect")}>
        <ListGroup>
          <ListRow leading={<Icon icon={Wallet} className="text-muted-foreground" />} title={t("afford.minBalance")} subtitle={t("afford.onDate", { date: f.date(r.min_balance_date) })} trailing={<AmountText value={r.min_balance_after} locale={f.locale} mode="compact" tone="auto" />} />
          <ListRow leading={<Icon icon={r.gap_date ? CalendarX : CalendarCheck} className="text-muted-foreground" />} title={t("afford.gap")} trailing={r.gap_date ? <Badge tone="negative" icon={<Icon icon={TriangleAlert} size={16} />}>{f.date(r.gap_date)}</Badge> : <Badge tone="positive" icon={<Icon icon={CheckCircle2} size={16} />}>{t("afford.noGap")}</Badge>} />
          {currency !== "UZS" ? <ListRow leading={<Icon icon={Coins} className="text-muted-foreground" />} title={t("afford.inUzs")} trailing={<AmountText value={r.amount_uzs} locale={f.locale} mode="compact" />} /> : null}
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
        <Card>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-small text-muted-foreground">
            {r.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Card>
      </Section>
    </div>
  );
}
