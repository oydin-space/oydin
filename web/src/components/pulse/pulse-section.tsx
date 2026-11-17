import { HandCoins, Handshake } from "lucide-react";
import type { Insight, Pulse } from "@/lib/types";
import { softSum } from "@/lib/format";
import { TONE_LABEL, TONE_PASTEL } from "@/lib/tone";
import { CrayonIcon } from "@/components/brand/crayon-icon";
import { PastelCard } from "@/components/shared/pastel-card";
import { Skeleton } from "@/components/ui/skeleton";
import { LogoSpinner } from "@/components/brand/logo-spinner";
import { GapCard } from "./gap-card";
import { InsightCard } from "./insight-card";
import { MetricCard } from "./metric-card";
import { ScoreRing } from "./score-ring";

export function PulseSection({ pulse }: { pulse: Pulse }) {
  const { kept, total } = pulse.promises;
  return (
    <section aria-label="Пульс бизнеса" className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-5">
        <PastelCard tone={TONE_PASTEL[pulse.tone]} className="lg:col-span-3">
          <div className="flex items-center gap-4 sm:gap-6">
            <ScoreRing score={pulse.score} tone={pulse.tone} />
            <div className="min-w-0">
              <p className="text-sm text-ink/65">Пульс бизнеса · {TONE_LABEL[pulse.tone]}</p>
              <h2 className="mt-1 text-xl font-semibold leading-snug text-balance sm:text-2xl">{pulse.headline}</h2>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="flex items-center gap-3 rounded-xl bg-white/60 p-3">
              <CrayonIcon name="salary" fallback={HandCoins} size={36} />
              <div className="min-w-0">
                <p className="text-xs text-ink/65">Можно потратить сегодня</p>
                <p className="tabular font-semibold">{softSum(pulse.safe_to_spend)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/60 p-3">
              <CrayonIcon name="envelope" fallback={Handshake} size={36} />
              <div className="min-w-0">
                <p className="text-xs text-ink/65">Обещания выполнены</p>
                <p className="tabular font-semibold">
                  {kept} из {total}
                </p>
              </div>
            </div>
          </div>
        </PastelCard>
        <div className="lg:col-span-2">
          <GapCard gap={pulse.gap} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {pulse.metrics.slice(0, 4).map((m, i) => (
          <MetricCard key={m.key} metric={m} index={i} />
        ))}
      </div>
    </section>
  );
}

export function InsightsSection({ items, onAsk }: { items: Insight[]; onAsk?: (q: string) => void }) {
  if (!items.length) return null;
  return (
    <section aria-label="Инсайты" className="space-y-2">
      <h2 className="px-1 text-sm font-medium text-muted-foreground">Инсайты</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.slice(0, 3).map((i) => (
          <InsightCard key={i.id} insight={i} onAsk={onAsk} />
        ))}
      </div>
    </section>
  );
}

export function PulseSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="relative lg:col-span-3">
          <Skeleton className="h-56 rounded-2xl" />
          <div className="absolute inset-0 flex items-center justify-center">
            <LogoSpinner size={44} />
          </div>
        </div>
        <Skeleton className="h-40 rounded-2xl lg:col-span-2 lg:h-56" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
