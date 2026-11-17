"use client";

import { Toaster as Sonner } from "sonner";
export { toast } from "sonner";

/** Тост: один слой, токены цвета/радиуса; текст объясняет результат, не «Успех!». */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "!rounded-card !border !border-border !bg-surface-raised !text-foreground !shadow-overlay !text-small",
          description: "!text-muted-foreground",
          actionButton: "!rounded-control !bg-primary !text-primary-foreground",
        },
      }}
    />
  );
}
