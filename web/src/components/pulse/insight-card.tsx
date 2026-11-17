import { ExternalLink, Lightbulb } from "lucide-react";
import type { Insight } from "@/lib/types";
import { dateShort } from "@/lib/format";
import { CONFIDENCE_LABEL, TONE_PASTEL } from "@/lib/tone";
import { CrayonIcon } from "@/components/brand/crayon-icon";
import { PastelCard } from "@/components/shared/pastel-card";

const KIND_LABEL = { market: "Рынок", local: "Рядом", tax: "Налоги", own: "Ваши данные" } as const;
const DOTS = { high: 3, medium: 2, low: 1 } as const;

export function InsightCard({ insight, onAsk }: { insight: Insight; onAsk?: (question: string) => void }) {
  const dots = DOTS[insight.confidence];
  return (
    <PastelCard tone={insight.tone === "calm" ? "lavender" : TONE_PASTEL[insight.tone]} className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-ink/65">
        <CrayonIcon name="insight" fallback={Lightbulb} size={28} />
        <span className="rounded-full bg-card/60 px-2 py-0.5">{KIND_LABEL[insight.kind]}</span>
      </div>
      <h3 className="font-semibold leading-snug">{insight.title}</h3>
      <p className="text-sm text-ink/80">{insight.body}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-ink/65">
        {insight.source_url ? (
          <a href={insight.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
            {insight.source} <ExternalLink size={11} />
          </a>
        ) : (
          <span>{insight.source}</span>
        )}
        <span>на {dateShort(insight.as_of)}</span>
        <span className="inline-flex items-center gap-1" title={CONFIDENCE_LABEL[insight.confidence]}>
          <span className="flex gap-0.5" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <i key={i} className={`size-1.5 rounded-full ${i <= dots ? "bg-ink/60" : "bg-ink/15"}`} />
            ))}
          </span>
          {CONFIDENCE_LABEL[insight.confidence]}
        </span>
      </div>
      {insight.action && onAsk ? (
        <button type="button" onClick={() => onAsk(insight.action!)} className="self-start rounded-full bg-card/70 px-3 py-1.5 text-sm font-medium shadow-sm active:scale-95">
          Спросить Oydin
        </button>
      ) : null}
    </PastelCard>
  );
}
