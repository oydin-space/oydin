"use client";

import { Loader2, Mic, Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export type VoiceState = "idle" | "recording" | "processing" | "disabled";

const LABEL: Record<VoiceState, string> = { idle: "Записать голосом", recording: "Остановить запись", processing: "Обрабатываем запись", disabled: "Голос недоступен" };

export interface VoiceButtonProps {
  state: VoiceState;
  onPress: () => void;
  labels?: Partial<Record<VoiceState, string>>;
  size?: 56 | 72;
  className?: string;
}

/** Нажать → идёт запись (пульс + текст для скринридера) → нажать ещё раз, чтобы остановить. Не «удерживать». */
export function VoiceButton({ state, onPress, labels, size = 56, className }: VoiceButtonProps) {
  const label = labels?.[state] ?? LABEL[state];
  const Glyph = state === "recording" ? Square : state === "processing" ? Loader2 : Mic;
  return (
    <span className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      {state === "recording" ? <span className="animate-kit-pulse absolute inset-0 rounded-pill bg-danger/30" aria-hidden="true" /> : null}
      <button
        type="button"
        onClick={onPress}
        disabled={state === "disabled" || state === "processing"}
        aria-label={label}
        aria-pressed={state === "recording"}
        className={cn(
          "state-layer press focus-ring motion-fast relative grid size-full place-items-center rounded-pill transition-colors disabled:opacity-50",
          state === "recording" ? "bg-danger text-danger-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        <Glyph className={cn("size-6", state === "processing" && "animate-spin")} aria-hidden="true" />
      </button>
      <span className="sr-only" role="status">
        {state === "recording" || state === "processing" ? label : ""}
      </span>
    </span>
  );
}

export interface ComposerProps {
  value: string;
  onValueChange: (v: string) => void;
  onSend: () => void;
  voice?: VoiceState;
  onVoice?: () => void;
  placeholder?: string;
  sendLabel?: string;
  disabled?: boolean;
  className?: string;
}

/** Поле ввода для чата и быстрой записи: текст + голос + отправка; Enter отправляет, Shift+Enter — перенос. */
export function Composer({ value, onValueChange, onSend, voice, onVoice, placeholder = "Сообщение", sendLabel = "Отправить", disabled, className }: ComposerProps) {
  const can = value.trim().length > 0 && !disabled;
  return (
    <div className={cn("pb-safe flex items-end gap-2 rounded-sheet border border-border bg-surface-raised p-2", className)}>
      <textarea
        value={value}
        rows={1}
        aria-label={placeholder}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (can) onSend();
          }
        }}
        className="focus-ring max-h-32 min-h-11 flex-1 resize-none rounded-control bg-transparent px-3 py-2.5 text-body placeholder:text-muted-foreground"
      />
      {voice && onVoice ? <VoiceButton state={voice} onPress={onVoice} /> : null}
      <button
        type="button"
        onClick={onSend}
        disabled={!can}
        aria-label={sendLabel}
        className="state-layer press focus-ring grid size-14 shrink-0 place-items-center rounded-pill bg-primary text-primary-foreground disabled:opacity-40"
      >
        <Send className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
