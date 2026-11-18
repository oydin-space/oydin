// Порт SegmentedBar из ~/Projects/components/templates/invest-app/src/components/viz/segmented-bar.tsx.
export interface Segment {
  label: string;
  value: number;
  className: string;
}

/** Одна полоса 100%, поделённая на части; смысл дублируется подписями рядом, цвет — не единственный носитель. */
export function SegmentedBar({ segments, height = 14, label }: { segments: Segment[]; height?: number; label: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="flex w-full gap-1" style={{ height }} role="img" aria-label={label}>
      {segments.map((s) => (
        <div key={s.label} className={`rounded-full ${s.className}`} style={{ width: `${(s.value / total) * 100}%`, minWidth: s.value > 0 ? 8 : 0 }} />
      ))}
    </div>
  );
}
