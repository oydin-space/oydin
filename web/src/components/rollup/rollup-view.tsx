"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { AmountText, Card, EmptyState, ErrorState, PAGE_WIDTH, PageHeader, SkeletonList, Text, toast } from "@/components/ui";
import { useT } from "@/i18n";
import { switchBusiness } from "@/lib/auth-api";
import { getRollup, type Rollup } from "./rollup-api";
import { RollupCard } from "./rollup-card";

export function RollupView() {
  const t = useT();
  const router = useRouter();
  const { user, applyMe } = useSession();
  const allowed = user?.role === "owner" || user?.role === "accountant";
  const [data, setData] = useState<Rollup | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setData(await getRollup());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [allowed, load]);

  async function pick(id: number) {
    if (id === user?.active_business_id) return router.push("/app/pulse");
    setBusyId(id);
    try {
      applyMe(await switchBusiness(id));
      router.push("/app/pulse");
    } catch {
      toast.error(t("rollup.switchError"));
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) return <EmptyState title={t("rollup.forbidden.title")} hint={t("rollup.forbidden.hint")} />;

  return (
    <div className={`${PAGE_WIDTH} flex flex-col gap-5`}>
      <PageHeader title={t("rollup.title")} hint={t("rollup.hint", { days: data?.window_days ?? 30 })} />
      {failed ? (
        <ErrorState message={t("rollup.loadError")} onRetry={load} />
      ) : !data ? (
        <SkeletonList rows={3} />
      ) : data.businesses.length === 0 ? (
        <EmptyState title={t("rollup.empty.title")} hint={t("rollup.empty.hint")} />
      ) : (
        <>
          <Card tint="butter" className="flex flex-col gap-3">
            <Text variant="caption" tone="muted">
              {t("rollup.totals", { count: data.businesses.length })}
            </Text>
            <AmountText value={data.totals.net_uzs} tone="auto" className="text-title font-semibold" />
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
              <Total label={t("rollup.in")} value={data.totals.inflow_30d_uzs} signed />
              <Total label={t("rollup.out")} value={-data.totals.outflow_30d_uzs} />
              <Total label={t("rollup.receivable")} value={data.totals.receivable_uzs} />
              <Total label={t("rollup.payable")} value={data.totals.payable_uzs} />
            </div>
            <Text variant="caption" tone="muted">
              {t("rollup.headcount", { count: data.totals.headcount })}
            </Text>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.businesses.map((b) => (
              <RollupCard key={b.id} b={b} active={b.id === user?.active_business_id} busy={busyId !== null} onPick={() => pick(b.id)} />
            ))}
          </div>
          <Text variant="caption" tone="muted">
            {t("rollup.note")}
          </Text>
        </>
      )}
    </div>
  );
}

function Total({ label, value, signed }: { label: string; value: number; signed?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <AmountText value={value} signed={signed} mode="compact" className="text-small font-medium" />
    </div>
  );
}
