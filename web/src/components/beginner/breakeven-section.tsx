"use client";

import { Button, Card, MoneyInput, StatusBanner, formatMoney } from "@/components/ui";
import { useLocale, useT } from "@/i18n";
import type { Breakeven } from "./beginner-api";

/** Та же формула, что на бэке (beginner.services.break_even): единиц = ⌈постоянные ÷ маржа⌉. */
export function breakEven(b: Breakeven) {
  if (b.price == null || b.unit_cost == null || b.fixed_monthly == null) return { state: "empty" as const };
  const margin = b.price - b.unit_cost;
  if (margin <= 0) return { state: "badMargin" as const };
  const units = Math.ceil(b.fixed_monthly / margin);
  return { state: "ok" as const, margin, units, revenue: units * b.price };
}

export function BreakevenSection({ value, monthlyBudget, onChange }: { value: Breakeven; monthlyBudget: number; onChange: (b: Breakeven) => void }) {
  const t = useT();
  const [locale] = useLocale();
  const r = breakEven(value);
  const money = (v: number) => formatMoney(v, { currency: "UZS", locale });
  return (
    <Card title={t("beginner.be.title")} description={t("beginner.be.hint")}>
      <div className="flex flex-col gap-4">
        <MoneyInput label={t("beginner.be.price")} currency="UZS" value={value.price} onValueChange={(v) => onChange({ ...value, price: v })} />
        <MoneyInput label={t("beginner.be.cost")} hint={t("beginner.be.costHint")} currency="UZS" value={value.unit_cost} onValueChange={(v) => onChange({ ...value, unit_cost: v })} />
        <div className="flex flex-col gap-2">
          <MoneyInput label={t("beginner.be.fixed")} currency="UZS" value={value.fixed_monthly} onValueChange={(v) => onChange({ ...value, fixed_monthly: v })} />
          {monthlyBudget > 0 && value.fixed_monthly !== monthlyBudget ? (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => onChange({ ...value, fixed_monthly: monthlyBudget })}>
              {t("beginner.be.fixedFromBudget")}: {money(monthlyBudget)}
            </Button>
          ) : null}
        </div>
        <p className="rounded-control bg-muted px-3 py-2 text-small">{t("beginner.be.formula")}</p>
        {r.state === "empty" ? <StatusBanner kind="info" title={t("beginner.be.needData")} /> : null}
        {r.state === "badMargin" ? <StatusBanner kind="warning" title={t("beginner.be.badMargin")} /> : null}
        {r.state === "ok" ? (
          <dl className="grid grid-cols-3 gap-3 border-t border-border pt-3">
            <div>
              <dt className="text-caption text-muted-foreground">{t("beginner.be.margin")}</dt>
              <dd className="text-body font-semibold tabular-nums">{money(r.margin)}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">{t("beginner.be.units")}</dt>
              <dd className="text-body font-semibold tabular-nums">{r.units.toLocaleString("ru-RU")}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">{t("beginner.be.revenue")}</dt>
              <dd className="text-body font-semibold tabular-nums">{money(r.revenue)}</dd>
            </div>
          </dl>
        ) : null}
        {r.state === "ok" ? <p className="text-caption text-muted-foreground">{t("beginner.be.estimate")}</p> : null}
      </div>
    </Card>
  );
}
