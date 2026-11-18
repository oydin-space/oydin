"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Card, EmptyState, Input, MoneyInput, SegmentedControl, formatMoney } from "@/components/ui";
import { useT, useLocale } from "@/i18n";
import type { BudgetItem } from "./beginner-api";

const total = (items: BudgetItem[], kind: BudgetItem["kind"]) => items.filter((i) => i.kind === kind).reduce((s, i) => s + i.amount, 0);

export function BudgetSection({ items, onChange }: { items: BudgetItem[]; onChange: (items: BudgetItem[]) => void }) {
  const t = useT();
  const [locale] = useLocale();
  const patch = (i: number, part: Partial<BudgetItem>) => onChange(items.map((x, k) => (k === i ? { ...x, ...part } : x)));
  const add = () => onChange([...items, { name: "", kind: items.some((x) => x.kind === "one_off") ? "monthly" : "one_off", amount: 0 }]);
  const money = (v: number) => formatMoney(v, { currency: "UZS", locale });

  return (
    <Card title={t("beginner.budget.title")} description={t("beginner.budget.hint")}>
      {items.length === 0 ? (
        <EmptyState title={t("beginner.budget.empty")} hint={t("beginner.budget.emptyHint")} action={<Button icon={Plus} onClick={add}>{t("beginner.budget.add")}</Button>} />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-control border border-border p-3">
              <Input label={t("beginner.budget.name")} value={item.name} maxLength={120} error={item.name.trim() ? undefined : t("beginner.budget.nameRequired")} onChange={(e) => patch(i, { name: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <MoneyInput label={t("beginner.budget.amount")} currency="UZS" value={item.amount} onValueChange={(v) => patch(i, { amount: v ?? 0 })} />
                <div className="flex flex-col gap-1">
                  <span className="text-small font-medium">{t("beginner.budget.kind")}</span>
                  <SegmentedControl
                    label={t("beginner.budget.kind")}
                    value={item.kind}
                    onValueChange={(kind) => patch(i, { kind })}
                    options={[{ value: "one_off", label: t("beginner.budget.oneOff") }, { value: "monthly", label: t("beginner.budget.monthly") }]}
                  />
                </div>
              </div>
              <Button variant="ghost" size="sm" icon={Trash2} className="self-end" onClick={() => onChange(items.filter((_, k) => k !== i))}>
                {t("beginner.budget.remove")}
              </Button>
            </div>
          ))}
          <Button variant="secondary" icon={Plus} onClick={add}>{t("beginner.budget.add")}</Button>
          <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3">
            <div>
              <dt className="text-caption text-muted-foreground">{t("beginner.budget.totalOneOff")}</dt>
              <dd className="text-section font-semibold tabular-nums">{money(total(items, "one_off"))}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">{t("beginner.budget.totalMonthly")}</dt>
              <dd className="text-section font-semibold tabular-nums">{money(total(items, "monthly"))}</dd>
            </div>
          </dl>
        </div>
      )}
    </Card>
  );
}
