"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { AmountText, Badge, Button, Card, EmptyState, ErrorState, ListGroup, ListRow, Section, StatusBanner, Text } from "@/components/ui";
import { useI18n } from "@/i18n";
import { usePublicT } from "./use-public-t";
import { sharedPdfUrl, type SharedResult } from "@/lib/public-api";
import { PublicShell } from "./public-shell";
import { PublicTitle } from "./page-title";

const OBLIGATION_TONE = { planned: "neutral", paid: "positive", overdue: "negative" } as const;

export function SharedReportView({ token, result }: { token: string; result: SharedResult }) {
  const { locale, formatDate } = useI18n();
  const t = usePublicT();
  const home = (
    <Button asChild variant="secondary">
      <Link href="/">{t("public.shared.home")}</Link>
    </Button>
  );

  if (result.state !== "ok") {
    return (
      <PublicShell>
        {result.state === "notFound" ? <EmptyState title={t("public.shared.notFound")} hint={t("public.shared.notFoundHint")} action={home} /> : null}
        {result.state === "gone" ? <EmptyState title={t("public.shared.gone")} hint={t("public.shared.goneHint")} action={home} /> : null}
        {result.state === "rateLimited" ? <ErrorState message={t("public.shared.rate")} /> : null}
        {result.state === "error" ? <ErrorState message={t("public.shared.error")} /> : null}
      </PublicShell>
    );
  }

  const r = result.report;
  const p = r.period;
  const money = (v: number | null, signed = false) => <AmountText value={v} locale={locale} signed={signed} />;
  const date = (d: string) => formatDate(d, { dateStyle: "medium" });
  const kpis = [
    { label: t("public.shared.revenue"), value: p.revenue, tint: "mint" },
    { label: t("public.shared.expenses"), value: p.expenses, tint: "peach" },
    { label: t("public.shared.profit"), value: p.profit, tint: "butter" },
    { label: t("public.shared.cashChange"), value: p.cash_change, tint: "sky", signed: true },
  ] as const;

  return (
    <PublicShell>
      <PublicTitle title={t("public.shared.for", { name: r.business_name })} hint={t("public.shared.period", { from: date(p.period_from), to: date(p.period_to) })} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild icon={Download}>
            <a href={sharedPdfUrl(token)} download>{t("public.shared.pdf")}</a>
          </Button>
          <Text variant="caption" tone="muted">
            {t("public.shared.readonly")} {t("public.shared.generated", { date: formatDate(r.generated_at, { dateStyle: "medium", timeStyle: "short" }) })}
          </Text>
        </div>

        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <li key={k.label}>
              <Card tint={k.tint} className="flex h-full flex-col gap-1">
                <Text variant="caption" tone="muted">{k.label}</Text>
                <span className="text-section font-semibold">{money(k.value, "signed" in k && k.signed)}</span>
              </Card>
            </li>
          ))}
        </ul>
        {p.profit === null || p.missing_data.length ? <StatusBanner kind="warning" title={t("public.shared.profitMissing")} /> : null}
        <ListGroup>
          <ListRow title={t("public.shared.draws")} trailing={money(p.owner_draws)} />
          <ListRow title={t("public.shared.contributions")} trailing={money(p.owner_contributions)} />
        </ListGroup>

        {r.accounts.length ? (
          <Section title={t("public.shared.accounts")}>
            <ListGroup>
              {r.accounts.map((a) => (
                <ListRow key={a.id} title={a.name} subtitle={t(`public.shared.kind.${a.kind}`)} trailing={<AmountText value={a.balance} currency={a.currency} locale={locale} />} />
              ))}
            </ListGroup>
          </Section>
        ) : null}

        <Section title={t("public.shared.categories")}>
          {r.by_category.length ? (
            <ListGroup>
              {r.by_category.map((c) => (
                <ListRow
                  key={c.category}
                  title={c.category === "personal" ? t("public.shared.personal") : c.category}
                  subtitle={`${t("public.shared.in")}: ${c.inflow.toLocaleString(locale)} · ${t("public.shared.out")}: ${c.outflow.toLocaleString(locale)}`}
                  trailing={money(c.inflow - c.outflow, true)}
                />
              ))}
            </ListGroup>
          ) : (
            <EmptyState title={t("public.shared.empty")} />
          )}
        </Section>

        {r.obligations.length ? (
          <Section title={t("public.shared.obligations")}>
            <ListGroup>
              {r.obligations.map((o) => (
                <ListRow
                  key={o.id}
                  title={o.title}
                  subtitle={`${t("public.shared.due", { date: date(o.due_date) })} · ${o.covered ? t("public.shared.covered") : t("public.shared.notCovered")}`}
                  status={<Badge tone={OBLIGATION_TONE[o.status]}>{t(`public.shared.status.${o.status}`)}</Badge>}
                  trailing={money(o.amount)}
                />
              ))}
            </ListGroup>
          </Section>
        ) : null}

        {r.cash_closes.length ? (
          <Section title={t("public.shared.closes")}>
            <ListGroup>
              {r.cash_closes.map((c) => (
                <ListRow
                  key={c.id}
                  title={date(c.date)}
                  subtitle={`${t("public.shared.expected")}: ${c.expected.toLocaleString(locale)} · ${t("public.shared.counted")}: ${c.counted.toLocaleString(locale)}`}
                  trailing={<span><span className="sr-only">{t("public.shared.difference")}: </span>{money(c.difference, true)}</span>}
                />
              ))}
            </ListGroup>
          </Section>
        ) : null}

        <Text variant="caption" tone="muted">{r.disclaimer}</Text>
      </div>
    </PublicShell>
  );
}
