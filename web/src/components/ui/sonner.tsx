"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "!bg-card !text-foreground !border-border !rounded-2xl !shadow-lg",
        },
      }}
    />
  );
}
