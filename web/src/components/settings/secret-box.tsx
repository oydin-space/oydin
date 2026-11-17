"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Input, StatusBanner } from "@/components/ui";
import { useST } from "./use-st";

/** Значение, которое сервер отдаёт один раз (токен, секрет, ссылка): показать, дать скопировать. */
export function SecretBox({ title, label, value, children }: { title: string; label: string; value: string; children?: React.ReactNode }) {
  const { t } = useST();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast(t("settings.common.copied"));
    } catch {
      toast.error(t("settings.common.generic"));
    }
  }
  return (
    <StatusBanner kind="success" title={title}>
      <span className="mt-2 flex flex-col gap-2">
        <span>{t("settings.common.onceNote")}</span>
        <Input label={label} value={value} readOnly onFocus={(e) => e.currentTarget.select()} />
        <span className="flex flex-wrap gap-2">
          <Button size="sm" icon={copied ? Check : Copy} onClick={copy}>
            {copied ? t("settings.common.copied") : t("settings.common.copy")}
          </Button>
          {children}
        </span>
      </span>
    </StatusBanner>
  );
}
