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

/** Ключи подписей в i18n (`meta.*`); текст выбирается при отрисовке через t(). */
export const TONE_LABEL_KEY = { calm: "meta.tone.calm", watch: "meta.tone.watch", risk: "meta.tone.risk" } as const satisfies Record<Tone, string>;

export const CONFIDENCE_LABEL_KEY = { high: "meta.confidence.high", medium: "meta.confidence.medium", low: "meta.confidence.low" } as const;

export const PURPOSE_LABEL_KEY = {
  business: "meta.purpose.business",
  personal: "meta.purpose.personal",
  unclear: "meta.purpose.unclear",
  owner_draw: "meta.purpose.owner_draw",
  owner_contribution: "meta.purpose.owner_contribution",
} as const;
