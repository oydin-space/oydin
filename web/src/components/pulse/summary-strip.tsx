"use client";

import { ChevronDown } from "lucide-react";
import type { Pulse } from "@/lib/types";
import { softSum } from "@/lib/format";
import { PASTEL_BG, TONE_PASTEL } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { ScoreRing } from "./score-ring";

/** Сжатая полоска вместо аналитики, пока раскрыт чат. */
export function SummaryStrip({ pulse, onExpand }: { pulse: Pulse; onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className={cn("brush flex w-full items-center gap-3 rounded-2xl p-2.5 pr-3 text-left", PASTEL_BG[TONE_PASTEL[pulse.tone]])}
      aria-label="Показать пульс бизнеса"
    >
      <ScoreRing score={pulse.score} tone={pulse.tone} size={44} label={false} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{pulse.headline}</span>
        <span className="tabular block truncate text-xs text-ink/65">
          Можно потратить {softSum(pulse.safe_to_spend)} · обещания {pulse.promises.kept}/{pulse.promises.total}
        </span>
      </span>
      <ChevronDown size={18} className="shrink-0 text-ink/60" />
    </button>
  );
}
