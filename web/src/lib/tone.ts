import type { Tone } from "./types";

export type Pastel = "butter" | "mint" | "lavender" | "peach" | "sky" | "rose";

export const PASTEL_BG: Record<Pastel, string> = {
  butter: "bg-butter",
  mint: "bg-mint",
  lavender: "bg-lavender",
  peach: "bg-peach",
  sky: "bg-sky",
  rose: "bg-rose",
};

/** Насыщенный оттенок того же цвета — для линий, колец, точек. */
export const PASTEL_DEEP: Record<Pastel, string> = {
  butter: "var(--butter-deep)",
  mint: "var(--mint-deep)",
  lavender: "var(--lavender-deep)",
  peach: "var(--peach-deep)",
  sky: "var(--sky-deep)",
  rose: "var(--rose-deep)",
};

// Тревожность выражаем мягко: спокойно — мята, внимание — масло, шаг сейчас — персик (не красный).
export const TONE_PASTEL: Record<Tone, Pastel> = { calm: "mint", watch: "butter", risk: "peach" };

export const TONE_LABEL: Record<Tone, string> = { calm: "Спокойно", watch: "Присмотреться", risk: "Нужен шаг" };

export const CONFIDENCE_LABEL = { high: "Высокая уверенность", medium: "Средняя уверенность", low: "Низкая уверенность" } as const;

export const PURPOSE_LABEL = { business: "Целевая", personal: "Нецелевая", unclear: "Не ясно", owner_draw: "Взял себе", owner_contribution: "Внёс в бизнес" } as const;
