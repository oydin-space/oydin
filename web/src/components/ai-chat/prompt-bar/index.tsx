import type { ComponentType, ReactNode } from "react";
import PromptBarRaw from "./PromptBar.jsx";
import "./midnight.css";


export type PromptBarSource = {
  key: string;
  name: string;
  description?: string;
  icon?: ReactNode | object;
  attach?: boolean;
  /** Не вложение: вызывает onAction(key). */
  action?: boolean;
};
export type PromptBarCommand = { key: string; name: string; description?: string };
export type PromptBarModel = { key: string; name: string; tag?: string };

export type PromptBarProps = {
  placeholder?: string;
  /** Rotating example prompts. */
  placeholders?: readonly string[];
  placeholderPrefix?: string;
  busyPlaceholder?: string;
  rotateMs?: number;
  /** Enables the + button and the @ menu. */
  sources?: readonly PromptBarSource[];
  /** Enables the / menu. */
  commands?: readonly PromptBarCommand[];
  /** Enables the model picker. */
  models?: readonly PromptBarModel[];
  defaultModel?: string;
  /** Enables the level selector. The last level turns on the sparks. */
  efforts?: readonly string[];
  defaultEffort?: string;
  onEffortChange?: (effort: string) => void;
  busy?: boolean;
  onSend?: (
    text: string,
    details: { attachments: string[]; model?: PromptBarModel; effort: string },
  ) => void;
  onStop?: () => void;
  onAttach?: (key: string) => string | string[] | undefined | Promise<string | string[] | undefined>;
  onAction?: (key: string) => void;
  /** Добавляет вложения снаружи: новый объект = новая порция. */
  inject?: { items: string[] };
  /** Enables the microphone button. Resolve with the dictated text. */
  /** Oydin: получает AbortSignal — он срабатывает, когда пользователь снова тапнул микрофон (стоп записи). */
  onDictate?: (stop: AbortSignal) => string | undefined | Promise<string | undefined>;
  labels?: Partial<Record<"prompt" | "send" | "stop" | "effort" | "faster" | "smarter" | "dictate" | "dictateStop" | "listening" | "add" | "remove", string>>;
  background?: string;
  color?: string;
  menuBackground?: string;
  sparkColor?: string;
  /** How strongly typing speeds up the sparks. 0 turns the reaction off. */
  sparkBoost?: number;
  width?: number;
  radius?: number;
  maxRows?: number;
  morphDuration?: number;
  squash?: number;
  tilt?: number;
  pressScale?: number;
  className?: string;
};

const PromptBarBase = PromptBarRaw as unknown as ComponentType<PromptBarProps>;

/** Oydin: `disabled` делает композер inert (нет фокуса и ввода) и приглушает его. */
export function PromptBar({ disabled, ...props }: PromptBarProps & { disabled?: boolean }) {
  return (
    <div className="prompt-bar-slot" data-disabled={disabled ? "" : undefined} inert={disabled}>
      <PromptBarBase {...props} />
    </div>
  );
}

/** The dark glass styling used in the original app. Spread it onto `PromptBar`. */
export const midnightPreset = {
  className: "prompt-bar--midnight",
  background: "rgba(22, 24, 33, 0.82)",
  color: "#eef1f8",
  sparkColor: "#7fb2ff",
  width: 720,
  radius: 18,
  maxRows: 6,
} satisfies PromptBarProps;
