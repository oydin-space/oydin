"use client";

import { RotateCcw } from "lucide-react";
import { Button, EmptyState, SkeletonList, StatusBanner } from "@/components/ui";
import { isForbidden, isMissing } from "@/lib/settings-api";
import { useST } from "./use-st";

/** Состояния загрузки: skeleton → ошибка с повтором; 404 — «ещё не подключено», 403 — «недоступно для роли». */
export function ResourceGate({
  loading,
  error,
  onRetry,
  skeleton,
  children,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t, err } = useST();
  if (loading) return <>{skeleton ?? <SkeletonList rows={3} />}</>;
  if (error && isMissing(error)) return <EmptyState title={t("settings.common.unavailableTitle")} hint={t("settings.common.unavailableHint")} />;
  if (error && isForbidden(error)) return <EmptyState title={t("settings.forbidden.title")} hint={t("settings.forbidden.hint")} />;
  if (error) {
    return (
      <StatusBanner
        kind="error"
        title={err(error)}
        action={
          <Button size="sm" variant="secondary" icon={RotateCcw} onClick={onRetry}>
            {t("settings.common.retry")}
          </Button>
        }
      />
    );
  }
  return <>{children}</>;
}
