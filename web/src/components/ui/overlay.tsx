"use client";

import { useState } from "react";
import { Dialog as D, Tooltip as T } from "radix-ui";
import { X } from "lucide-react";
import { useKitT } from "./kit-t";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const OverlayTrigger = D.Trigger;
export const OverlayClose = D.Close;

export interface OverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** sheet: снизу на телефоне, по центру на ≥768px; dialog: всегда по центру (подтверждения). */
  variant?: "sheet" | "dialog";
  footer?: React.ReactNode;
  closeLabel?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Один слой поверх страницы. Вложенные листы запрещены: второй шаг заменяет содержимое, а не открывает новый лист.
 * Центрирование через flex, не через transform — поэтому prefers-reduced-motion не ломает позицию.
 */
export function Sheet({ open, onOpenChange, title, description, variant = "sheet", footer, closeLabel, className, children }: OverlayProps) {
  const t = useKitT();
  closeLabel ??= t("kit.close");
  const sheet = variant === "sheet";
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-[kit-overlay-in_var(--dur-base)_var(--ease-enter)] data-[state=closed]:animate-[kit-overlay-out_var(--dur-base)_var(--ease-exit)]" />
        <div className={cn("pointer-events-none fixed inset-0 z-50 flex justify-center p-0", sheet ? "items-end md:items-center md:p-6" : "items-center p-6")}>
          <D.Content
            onOpenAutoFocus={(e) => {
              const el = e.currentTarget instanceof HTMLElement ? e.currentTarget.querySelector<HTMLElement>("[data-autofocus]") : null;
              if (el) {
                e.preventDefault();
                el.focus();
              }
            }}
            className={cn(
              "pointer-events-auto flex max-h-[92dvh] w-full flex-col bg-surface-raised text-foreground shadow-overlay outline-none",
              sheet ? "pb-safe rounded-t-sheet md:max-w-lg md:rounded-sheet" : "max-w-md rounded-sheet",
              "data-[state=open]:animate-[kit-sheet-in_var(--dur-sheet)_var(--ease-enter)] data-[state=closed]:animate-[kit-sheet-out_var(--dur-base)_var(--ease-exit)]",
              className,
            )}
          >
            <div className="flex items-start gap-3 px-5 pt-5">
              <div className="flex-1">
                <D.Title className="text-title font-semibold">{title}</D.Title>
                {description ? <D.Description className="mt-1 text-small text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
              </div>
              <D.Close aria-label={closeLabel} className="focus-ring state-layer min-target grid place-items-center rounded-pill">
                <X className="size-5" aria-hidden="true" />
              </D.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer ? <div className="flex gap-2 border-t border-border px-5 py-4">{footer}</div> : null}
          </D.Content>
        </div>
      </D.Portal>
    </D.Root>
  );
}

export const BottomSheet = Sheet;

export function Dialog(props: Omit<OverlayProps, "variant">) {
  return <Sheet {...props} variant="dialog" />;
}

export interface TaskSheetProps extends Omit<OverlayProps, "variant" | "footer"> {
  /** Есть несохранённые правки — закрытие спрашивает подтверждение. */
  dirty?: boolean;
  submitLabel: string;
  cancelLabel?: string;
  onSubmit: () => void;
  submitting?: boolean;
  submitDisabled?: boolean;
  discardTitle?: string;
  discardLabel?: string;
  keepLabel?: string;
}

/** Короткая задача (добавить операцию, пригласить): одна главная кнопка, защита от потери ввода. */
export function TaskSheet({ onOpenChange, dirty, submitLabel, cancelLabel, onSubmit, submitting, submitDisabled, discardTitle, discardLabel, keepLabel, children, ...props }: TaskSheetProps) {
  const t = useKitT();
  cancelLabel ??= t("kit.cancel");
  discardTitle ??= t("kit.discard.title");
  discardLabel ??= t("kit.close");
  keepLabel ??= t("kit.keep");
  const [confirming, setConfirming] = useState(false);
  const request = (next: boolean) => {
    if (!next && dirty) setConfirming(true);
    else onOpenChange(next);
  };
  return (
    <>
      <Sheet
        {...props}
        onOpenChange={request}
        footer={
          <>
            <Button variant="secondary" onClick={() => request(false)} className="flex-1">
              {cancelLabel}
            </Button>
            <Button onClick={onSubmit} loading={submitting} disabled={submitDisabled} className="flex-1">
              {submitLabel}
            </Button>
          </>
        }
      >
        {children}
      </Sheet>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={discardTitle}
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
              {keepLabel}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                setConfirming(false);
                onOpenChange(false);
              }}
            >
              {discardLabel}
            </Button>
          </>
        }
      />
    </>
  );
}

export const TooltipProvider = T.Provider;

/** Подсказка не несёт критичной информации: на тач-экранах её нет, смысл дублируйте текстом. */
export function Tooltip({ content, children }: { content: string; children: React.ReactElement }) {
  return (
    <T.Root delayDuration={300}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content sideOffset={6} className="z-[80] rounded-control bg-primary px-3 py-1.5 text-caption text-primary-foreground shadow-overlay">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
