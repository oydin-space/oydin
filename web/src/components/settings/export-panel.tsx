"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { Button, FeedbackNotice, Icon, Input, PlainCard, SegmentedControl } from "@/components/ui";
import { downloadExport, type ExportFormat } from "@/lib/settings-api";
import { useST } from "./use-st";

const FORMATS: ExportFormat[] = ["csv", "xlsx", "1c_bank"];

export function ExportPanel() {
  const { t, err } = useST();
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function download() {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await downloadExport(format, from, to);
      setDone(true);
    } catch (x) {
      setError(err(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlainCard title={<span className="inline-flex items-center gap-2"><Icon icon={FileSpreadsheet} size={20} />{t("settings.export.title")}</span>} description={t("settings.export.hint")}>
      <div className="flex flex-col gap-3">
        <SegmentedControl label={t("settings.export.format")} value={format} onValueChange={setFormat} options={FORMATS.map((f) => ({ value: f, label: t(`settings.export.${f}`) }))} />
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" label={t("settings.export.from")} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" label={t("settings.export.to")} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
        {error ? <FeedbackNotice kind="error">{error}</FeedbackNotice> : null}
        {done ? <FeedbackNotice>{t("settings.export.done")}</FeedbackNotice> : null}
        <div>
          <Button icon={Download} loading={busy} onClick={download}>
            {t("settings.export.download")}
          </Button>
        </div>
      </div>
    </PlainCard>
  );
}
