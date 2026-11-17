"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AmountText, Badge, Button, Card, Input, MoneyInput, ProgressBar, Select, Text, TaskSheet, SkeletonCard } from "@/components/ui";
import { createGoal, deleteGoal, GOAL_KINDS, listGoals, patchGoal, type Goal, type GoalKind } from "@/lib/planning-api";
import { ConfirmDelete } from "./confirm-delete";
import { LoadView, useAction, useLoad, usePlanFormat, usePlanT, type PlanKey } from "./plan-support";

interface Draft {
  id: number | null;
  kind: GoalKind;
  title: string;
  target: number | null;
  due: string;
}
const blank: Draft = { id: null, kind: "savings", title: "", target: null, due: "" };

export function GoalsPanel({ canWrite }: { canWrite: boolean }) {
  const t = usePlanT();
  const f = usePlanFormat();
  const res = useLoad(listGoals);
  const { busy, run } = useAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<Goal | null>(null);

  const open = (g?: Goal) => setDraft(g ? { id: g.id, kind: g.kind, title: g.title, target: g.target, due: g.due_date ?? "" } : blank);
  const save = async () => {
    if (!draft || draft.target == null || !draft.title.trim()) return;
    const body = { kind: draft.kind, title: draft.title.trim(), target: draft.target, due_date: draft.due || null };
    const ok = await run(() => (draft.id == null ? createGoal(body) : patchGoal(draft.id, body)), t("goals.saved"));
    if (ok) {
      setDraft(null);
      res.reload();
    }
  };
  const remove = async () => {
    if (!removing) return;
    const ok = await run(() => deleteGoal(removing.id), t("goals.deleted"));
    if (ok) {
      setRemoving(null);
      res.reload();
    }
  };
  const archive = async (g: Goal) => {
    if (await run(() => patchGoal(g.id, { status: g.status === "archived" ? "active" : "archived" }))) res.reload();
  };

  return (
    <div className="flex flex-col gap-4">
      {canWrite ? (
        <Button icon={Plus} onClick={() => open()} className="self-start">
          {t("goals.add")}
        </Button>
      ) : (
        <Text variant="secondary" tone="muted">
          {t("goals.readOnly")}
        </Text>
      )}
      <LoadView res={res} skeleton={<SkeletonCard />} isEmpty={(d) => d.items.length === 0} empty={{ title: t("goals.empty"), hint: t("goals.emptyHint") }}>
        {(d) => (
          <div className="grid gap-3 md:grid-cols-2">
            {d.items.map((g) => {
              const ratio = g.target > 0 ? g.current / g.target : 0;
              const cap = g.kind === "expense_cap" || g.kind === "no_personal_leaks";
              return (
                <Card key={g.id} tint={g.status === "achieved" ? "mint" : undefined} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Text variant="body" weight="semibold" className="truncate">
                        {g.title}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {t(`goals.kind.${g.kind}` as PlanKey)}
                        {g.due_date ? ` · ${t("goals.until", { date: f.dateLong(g.due_date) })}` : ""}
                      </Text>
                    </div>
                    {g.status === "achieved" ? <Badge tone="positive">{t("goals.achieved")}</Badge> : g.status === "archived" ? <Badge>{t("goals.archived")}</Badge> : cap && ratio > 1 ? <Badge tone="negative">{t("goals.over")}</Badge> : null}
                  </div>
                  <ProgressBar value={ratio} label={g.title} />
                  <div className="flex items-baseline justify-between gap-2 text-small">
                    <AmountText value={g.current} locale={f.locale} mode="compact" className="font-semibold" />
                    <span className="text-muted-foreground">
                      {t("goals.of")} <AmountText value={g.target} locale={f.locale} mode="compact" /> · {Math.round(ratio * 100)}%
                    </span>
                  </div>
                  {canWrite ? (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => open(g)}>
                        {t("common.edit")}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => void archive(g)}>
                        {g.status === "archived" ? t("goals.restore") : t("goals.archive")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(g)}>
                        {t("common.delete")}
                      </Button>
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </LoadView>

      <TaskSheet
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id == null ? t("goals.add") : t("goals.edit")}
        closeLabel={t("common.close")}
        submitLabel={t("common.save")}
        cancelLabel={t("common.cancel")}
        discardTitle={t("common.discardTitle")}
        discardLabel={t("common.discard")}
        keepLabel={t("common.keep")}
        dirty={draft !== null && (draft.title !== "" || draft.target != null)}
        submitting={busy}
        submitDisabled={!draft || !draft.title.trim() || !draft.target}
        onSubmit={() => void save()}
      >
        {draft ? (
          <div className="flex flex-col gap-3">
            <Select label={t("goals.type")} options={GOAL_KINDS.map((k) => ({ value: k, label: t(`goals.kind.${k}` as PlanKey) }))} value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as GoalKind })} />
            <Input label={t("goals.name")} value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
            <MoneyInput label={t("goals.target")} value={draft.target} onValueChange={(v) => setDraft({ ...draft, target: v })} currency="UZS" locale={f.locale} required />
            <Input label={t("goals.due")} type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} />
          </div>
        ) : null}
      </TaskSheet>
      <ConfirmDelete open={removing !== null} title={t("goals.confirmDelete", { name: removing?.title ?? "" })} busy={busy} onConfirm={() => void remove()} onClose={() => setRemoving(null)} />
    </div>
  );
}
