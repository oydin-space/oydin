"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calculator, CalendarRange, ClipboardCheck, HandCoins, Landmark, Repeat, Target, type LucideIcon } from "lucide-react";
import { EmptyState, Icon, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { useSession } from "@/components/providers/session-provider";
import { AffordPanel } from "./afford-panel";
import { ClosePanel } from "./close-panel";
import { CommitmentsPanel } from "./commitments-panel";
import { DebtorsPanel } from "./debtors-panel";
import { GoalsPanel } from "./goals-panel";
import { usePlanT, type PlanKey } from "./plan-support";
import { SeasonPanel } from "./season-panel";
import { TaxPanel } from "./tax-panel";

const TABS = ["afford", "close", "goals", "tax", "debtors", "commitments", "season"] as const;
type Tab = (typeof TABS)[number];
const isTab = (v: string | null): v is Tab => TABS.includes(v as Tab);
const TAB_ICON: Record<Tab, LucideIcon> = {
  afford: Calculator,
  close: ClipboardCheck,
  goals: Target,
  tax: Landmark,
  debtors: HandCoins,
  commitments: Repeat,
  season: CalendarRange,
};

export function PlanView() {
  const t = usePlanT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user } = useSession();
  const raw = params.get("tab");
  const tab: Tab = isTab(raw) ? raw : "afford";
  const setTab = useCallback((v: string) => router.replace(`${pathname}?tab=${v}`, { scroll: false }), [router, pathname]);

  const role = user?.role;
  if (role === "seller") {
    return (
      <>
        <PageHeader title={t("page.title")} />
        <EmptyState title={t("forbidden.title")} hint={t("forbidden.hint")} />
      </>
    );
  }
  const owner = role === "owner";

  return (
    <>
      <PageHeader title={t("page.title")} hint={t("page.hint")} />
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
        <TabsList>
          {TABS.map((k) => (
            <TabsTrigger key={k} value={k}>
              <span className="inline-flex items-center gap-1.5">
                <Icon icon={TAB_ICON[k]} size={16} />
                {t(`tab.${k}` as PlanKey)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="afford">{tab === "afford" ? <AffordPanel /> : null}</TabsContent>
        <TabsContent value="close">{tab === "close" ? <ClosePanel /> : null}</TabsContent>
        <TabsContent value="goals">{tab === "goals" ? <GoalsPanel canWrite={owner} /> : null}</TabsContent>
        <TabsContent value="tax">{tab === "tax" ? <TaxPanel canWrite /> : null}</TabsContent>
        <TabsContent value="debtors">{tab === "debtors" ? <DebtorsPanel canEdit={owner} /> : null}</TabsContent>
        <TabsContent value="commitments">{tab === "commitments" ? <CommitmentsPanel /> : null}</TabsContent>
        <TabsContent value="season">{tab === "season" ? <SeasonPanel /> : null}</TabsContent>
      </Tabs>
    </>
  );
}
