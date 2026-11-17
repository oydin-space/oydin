"use client";

import { useState } from "react";
import { ChoiceControl, FeedbackNotice, PlainCard, Select, SkeletonList } from "@/components/ui";
import { fetchNotifications, type NotificationSettings, saveNotifications } from "@/lib/settings-api";
import { ResourceGate } from "./resource-gate";
import { useResource } from "./use-resource";
import { useST } from "./use-st";

const TOGGLES = ["daily_brief", "gap_alerts", "weekly_digest", "tax_reminders"] as const;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function Form({ initial }: { initial: NotificationSettings }) {
  const { t, err } = useST();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(patch: Partial<NotificationSettings>) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      setState(await saveNotifications(patch));
      setSaved(true);
    } catch (x) {
      setError(err(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlainCard title={t("settings.notifications.title")} description={t("settings.notifications.hint")}>
      <div className="flex flex-col gap-4">
        {TOGGLES.map((k) => (
          <ChoiceControl
            key={k}
            kind="switch"
            label={t(`settings.notifications.${k}.title`)}
            description={t(`settings.notifications.${k}.desc`)}
            checked={state[k]}
            disabled={busy}
            onCheckedChange={(v) => save({ [k]: v })}
          />
        ))}
        <Select
          label={t("settings.notifications.hour")}
          value={String(state.brief_hour)}
          disabled={busy}
          onValueChange={(v) => save({ brief_hour: Number(v) })}
          options={HOURS.map((h) => ({ value: String(h), label: t("settings.notifications.hourOption", { hour: String(h).padStart(2, "0") }) }))}
        />
        {error ? <FeedbackNotice kind="error">{error}</FeedbackNotice> : null}
        {saved ? <FeedbackNotice>{t("settings.common.saved")}</FeedbackNotice> : null}
      </div>
    </PlainCard>
  );
}

export function NotificationsSection() {
  const { data, loading, error, reload } = useResource(fetchNotifications);
  return (
    <ResourceGate loading={loading} error={error} onRetry={reload} skeleton={<SkeletonList rows={4} />}>
      {data ? <Form initial={data} /> : null}
    </ResourceGate>
  );
}
