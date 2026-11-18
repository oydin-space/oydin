"use client";

import { Check } from "lucide-react";
import { AmountText, Badge, Text } from "@/components/ui";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import type { RollupBusiness } from "./rollup-api";

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <span className="text-small font-medium">{children}</span>
    </div>
  );
}

export function RollupCard({ b, active, busy, onPick }: { b: RollupBusiness; active: boolean; busy: boolean; onPick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex min-h-11 w-full flex-col gap-3 rounded-card border bg-card p-4 text-left text-foreground transition-colors disabled:opacity-60",
        active ? "border-brand" : "border-border hover:border-border-strong",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-section font-semibold">{b.name}</span>
        {active ? (
          <Badge tone="positive" icon={<Check size={16} aria-hidden />}>
            {t("rollup.active")}
          </Badge>
        ) : (
          <Badge>{t(`rollup.role.${b.role}`)}</Badge>
        )}
      </div>
      <div>
        <Text variant="caption" tone="muted">
          {t("rollup.net")}
        </Text>
        <AmountText value={b.net_uzs} tone="auto" className="block text-title font-semibold" />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <Figure label={t("rollup.in")}>
          <AmountText value={b.inflow_30d_uzs} signed mode="compact" />
        </Figure>
        <Figure label={t("rollup.out")}>
          <AmountText value={-b.outflow_30d_uzs} mode="compact" />
        </Figure>
        <Figure label={t("rollup.receivable")}>
          <AmountText value={b.receivable_uzs} mode="compact" />
        </Figure>
        <Figure label={t("rollup.payable")}>
          <AmountText value={b.payable_uzs} mode="compact" />
        </Figure>
      </div>
      <Text variant="caption" tone="muted">
        {t("rollup.headcount", { count: b.headcount })}
      </Text>
    </button>
  );
}
