"use client";

import { Button, Dialog } from "@/components/ui";
import { usePlanT } from "./plan-support";

/** Подтверждение необратимого удаления: один слой, главная кнопка — опасная. */
export function ConfirmDelete({ open, title, busy, onConfirm, onClose }: { open: boolean; title: string; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  const t = usePlanT();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      closeLabel={t("common.close")}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" className="flex-1" loading={busy} onClick={onConfirm}>
            {t("common.delete")}
          </Button>
        </>
      }
    />
  );
}
