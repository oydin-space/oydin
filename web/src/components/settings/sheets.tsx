"use client";

import { Button, Dialog, TaskSheet } from "@/components/ui";
import { useST } from "./use-st";

type FormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  onSubmit: () => void;
  submitting?: boolean;
  submitDisabled?: boolean;
  dirty?: boolean;
  children: React.ReactNode;
};

/** TaskSheet с переведёнными подписями «закрыть / отмена / продолжить». */
export function FormSheet(props: FormSheetProps) {
  const { t } = useST();
  return (
    <TaskSheet
      {...props}
      closeLabel={t("settings.common.close")}
      cancelLabel={t("settings.common.cancel")}
      discardTitle={t("settings.common.discardTitle")}
      discardLabel={t("settings.common.discard")}
      keepLabel={t("settings.common.keep")}
    />
  );
}

/** Подтверждение необратимого действия (отзыв ссылки/токена, удаление вебхука). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
}) {
  const { t } = useST();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      closeLabel={t("settings.common.close")}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("settings.common.cancel")}
          </Button>
          <Button variant="destructive" loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
