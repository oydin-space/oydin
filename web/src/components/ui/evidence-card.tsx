import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { AmountText } from "./money";
import { Badge } from "./badge";
import { Card } from "./card";
import type { Currency } from "./money-format";

export interface EvidenceCardProps {
  /** Утверждение, которое подтверждается («Касса уйдёт в минус 14 июня»). */
  claim: string;
  /** Операции/источники, на которых оно основано. */
  items: { id: string; label: string; date: string; amount: number; currency?: Currency }[];
  confidence?: { label: string; tone: "positive" | "caution" | "negative" };
  source?: string;
  className?: string;
}

/** «Почему мы так считаем»: утверждение + конкретные строки-основания. Без них число не показываем уверенно. */
export function EvidenceCard({ claim, items, confidence, source, className }: EvidenceCardProps) {
  return (
    <Card className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-body font-medium">{claim}</p>
        {confidence ? <Badge tone={confidence.tone}>{confidence.label}</Badge> : null}
      </div>
      <ul className="divide-y divide-border">
        {items.map((it) => (
          <li key={it.id} className="flex min-h-11 items-center gap-2 py-1.5 text-small">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            <time className="text-caption text-muted-foreground" dateTime={it.date}>
              {it.date}
            </time>
            <AmountText value={it.amount} currency={it.currency} mode="compact" signed className="font-medium" />
          </li>
        ))}
      </ul>
      {source ? <p className="text-caption text-muted-foreground">{source}</p> : null}
    </Card>
  );
}
