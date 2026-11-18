"use client";

import { Card, Checkbox, ProgressBar } from "@/components/ui";
import { useT } from "@/i18n";
import { STEPS, type StepId } from "./beginner-api";

export function ChecklistSection({ done, onToggle }: { done: StepId[]; onToggle: (id: StepId) => void }) {
  const t = useT();
  return (
    <Card title={t("beginner.check.title")} description={t("beginner.check.progress", { done: done.length, total: STEPS.length })}>
      <ProgressBar value={done.length / STEPS.length} label={t("beginner.check.title")} className="mb-2" />
      <ul>
        {STEPS.map((id) => (
          <li key={id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1">
              <Checkbox checked={done.includes(id)} onCheckedChange={() => onToggle(id)} />
              <span className={`text-body ${done.includes(id) ? "text-muted-foreground line-through" : ""}`}>{t(`beginner.check.${id}`)}</span>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}
