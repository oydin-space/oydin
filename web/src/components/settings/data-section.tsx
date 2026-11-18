"use client";

import { Info } from "lucide-react";
import { ExportPanel } from "./export-panel";
import { ImportPanel } from "./import-panel";
import { Icon } from "@/components/ui";
import { useST } from "./use-st";

export function DataSection() {
  const { t } = useST();
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 text-small text-muted-foreground"><Icon icon={Info} size={16} className="mt-0.5" />{t("settings.data.hint")}</p>
      <ImportPanel />
      <ExportPanel />
    </div>
  );
}
