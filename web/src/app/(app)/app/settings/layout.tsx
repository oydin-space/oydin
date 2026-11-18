"use client";

import { SettingsNav } from "@/components/settings/settings-nav";
import { useST } from "@/components/settings/use-st";
import { PAGE_WIDTH, PageHeader } from "@/components/ui";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { t } = useST();
  return (
    <div className={`${PAGE_WIDTH} flex flex-col gap-4 pb-6`}>
      <PageHeader title={t("settings.title")} hint={t("settings.hint")} />
      <SettingsNav />
      {children}
    </div>
  );
}
