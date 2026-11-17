"use client";

import { ExportPanel } from "./export-panel";
import { ImportPanel } from "./import-panel";
import { useST } from "./use-st";

export function DataSection() {
  const { t } = useST();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-muted-foreground">{t("settings.data.hint")}</p>
      <ImportPanel />
      <ExportPanel />
    </div>
  );
}
