"use client";

import { Download, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { Button, EmptyState, ErrorState, FeedbackNotice, PAGE_WIDTH, PageHeader, SkeletonList } from "@/components/ui";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api";
import { beginnerApi, type BeginnerPlan, type PlanDraft, type StepId } from "./beginner-api";
import { BreakevenSection } from "./breakeven-section";
import { BudgetSection } from "./budget-section";
import { ChecklistSection } from "./checklist-section";
import { RegistrationSection } from "./registration-section";

const toDraft = (p: BeginnerPlan): PlanDraft => ({ budget_items: p.budget_items, breakeven: p.breakeven, checklist: p.checklist, regime: p.regime });

export function BeginnerView() {
  const t = useT();
  const { user } = useSession();
  const allowed = user?.role === "owner" || user?.role === "accountant";
  const [plan, setPlan] = useState<BeginnerPlan | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [failed, setFailed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "pdf" | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    beginnerApi.get().then(
      (p) => {
        setPlan(p);
        setDraft(toDraft(p));
      },
      () => setFailed(true),
    );
  }, []);
  useEffect(() => {
    if (!allowed) return;
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [allowed, load]);

  if (!allowed) return <EmptyState title={t("beginner.forbidden.title")} hint={t("beginner.forbidden.hint")} />;

  const change = (part: Partial<PlanDraft>) => {
    setDraft((d) => (d ? { ...d, ...part } : d));
    setDirty(true);
    setNotice(null);
  };

  const save = async (): Promise<boolean> => {
    if (!draft) return false;
    if (draft.budget_items.some((i) => !i.name.trim())) {
      setNotice({ kind: "error", text: t("beginner.budget.nameRequired") });
      return false;
    }
    try {
      const saved = await beginnerApi.save(draft);
      setPlan(saved);
      setDirty(false);
      return true;
    } catch (e) {
      setNotice({ kind: "error", text: e instanceof ApiError && e.message === "demo_tenant" ? t("beginner.demo") : t("beginner.saveError") });
      return false;
    }
  };

  const onSave = async () => {
    setBusy("save");
    if (await save()) setNotice({ kind: "success", text: t("beginner.saved") });
    setBusy(null);
  };

  const onPdf = async () => {
    setBusy("pdf");
    try {
      if (dirty && !(await save())) return;
      const res = await fetch(beginnerApi.pdfUrl(), { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "oydin-start-plan.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice({ kind: "error", text: t("beginner.pdfError") });
    } finally {
      setBusy(null);
    }
  };

  const toggle = (id: StepId) => draft && change({ checklist: draft.checklist.includes(id) ? draft.checklist.filter((x) => x !== id) : [...draft.checklist, id] });

  return (
    <div className={`${PAGE_WIDTH} flex flex-col gap-5`}>
      <PageHeader
        title={t("beginner.title")}
        hint={t("beginner.hint")}
        actions={
          <Button variant="secondary" icon={Download} loading={busy === "pdf"} disabled={!draft} onClick={onPdf}>
            {t("beginner.pdf")}
          </Button>
        }
      />
      {failed ? (
        <ErrorState message={t("beginner.loadError")} onRetry={load} />
      ) : !plan || !draft ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          <BudgetSection items={draft.budget_items} onChange={(budget_items) => change({ budget_items })} />
          <BreakevenSection
            value={draft.breakeven}
            monthlyBudget={draft.budget_items.filter((i) => i.kind === "monthly").reduce((s, i) => s + i.amount, 0)}
            onChange={(breakeven) => change({ breakeven })}
          />
          <RegistrationSection reg={plan.registration} regime={draft.regime} onRegime={(regime) => change({ regime })} />
          <ChecklistSection done={draft.checklist} onToggle={toggle} />
          <div className="sticky bottom-20 flex flex-wrap items-center gap-3 rounded-card border border-border bg-card p-3 md:bottom-4">
            <Button icon={Save} loading={busy === "save"} disabled={!dirty} onClick={onSave}>
              {t("beginner.save")}
            </Button>
            {notice ? <FeedbackNotice kind={notice.kind}>{notice.text}</FeedbackNotice> : dirty ? <span className="text-small text-muted-foreground">{t("beginner.unsaved")}</span> : <span className="text-small text-muted-foreground">{t("beginner.pdfHint")}</span>}
          </div>
        </>
      )}
    </div>
  );
}
