"use client";

import { useEffect, useState } from "react";
import { AmountText, Card, Input, ListGroup, ListRow, ProgressBar, Section, SkeletonCard, StatusBanner, Text } from "@/components/ui";
import { getSeasonality, isoDay, periodReport, type PeriodReport } from "@/lib/planning-api";
import { LoadView, useLoad, usePlanFormat, usePlanT, type PlanKey } from "./plan-support";

export function SeasonPanel() {
  const t = usePlanT();
  const f = usePlanFormat();
  const season = useLoad(getSeasonality);
  const now = new Date();
  const [from, setFrom] = useState(isoDay(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(isoDay(now));
  const [debounced, setDebounced] = useState({ from, to });
  useEffect(() => {
    const h = setTimeout(() => setDebounced({ from, to }), 400);
    return () => clearTimeout(h);
  }, [from, to]);
  const report = useLoad<PeriodReport | null>(() => (debounced.from && debounced.to && debounced.from <= debounced.to ? periodReport(debounced.from, debounced.to) : Promise.resolve(null)), [debounced]);
  const monthName = (m: number) => new Intl.DateTimeFormat(f.locale, { month: "long" }).format(new Date(2025, m - 1, 15));

  return (
    <div className="flex flex-col gap-5">
      <Section title={t("season.title")}>
        <Text variant="secondary" tone="muted" className="px-1">
          {t("season.hint")}
        </Text>
        <LoadView res={season} skeleton={<SkeletonCard />}>
          {(s) =>
            s.status === "insufficient_history" ? (
              <StatusBanner kind="info" title={t("season.notEnough")}>
                {t("season.notEnoughText", { months: s.months, needed: s.needed })}
              </StatusBanner>
            ) : (
              <Card className="flex flex-col gap-3">
                {s.factors.map((x) => (
                  <div key={x.month} className="flex items-center gap-3">
                    <Text variant="secondary" className="w-24 shrink-0 capitalize">
                      {monthName(x.month)}
                    </Text>
                    <div className="min-w-0 flex-1">
                      <ProgressBar value={Math.min(x.factor / 2, 1)} label={monthName(x.month)} />
                    </div>
                    <Text variant="secondary" weight="semibold" className="w-12 shrink-0 text-right">
                      ×{x.factor.toFixed(2)}
                    </Text>
                  </div>
                ))}
              </Card>
            )
          }
        </LoadView>
      </Section>

      <Section title={t("season.reportTitle")}>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("season.from")} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <Input label={t("season.to")} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        <LoadView res={report} skeleton={<SkeletonCard />}>
          {(r) =>
            r === null ? null : (
              <>
                <ListGroup>
                  {(
                    [
                      ["revenue", r.revenue],
                      ["expenses", -r.expenses],
                      ["profit", r.profit],
                      ["cashChange", r.cash_change],
                      ["draws", -r.owner_draws],
                      ["contributions", r.owner_contributions],
                    ] as const
                  ).map(([k, v]) => (
                    <ListRow key={k} title={t(`season.r.${k}` as PlanKey)} trailing={<AmountText value={v} signed={k !== "revenue"} locale={f.locale} mode="compact" />} />
                  ))}
                </ListGroup>
                {r.missing_data.length > 0 ? (
                  <StatusBanner kind="warning" title={t("season.missing")}>
                    {r.missing_data.map((m) => t(`season.missing.${m}` as PlanKey)).join(" · ")}
                  </StatusBanner>
                ) : null}
              </>
            )
          }
        </LoadView>
      </Section>
    </div>
  );
}
