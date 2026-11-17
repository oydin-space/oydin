import { cn } from "@/lib/utils";
import { PASTEL_BG, type Pastel } from "@/lib/tone";

/** Мягкий пастельный блок с «кистевой» текстурой. */
export function PastelCard({
  tone = "butter",
  className,
  ...props
}: React.ComponentProps<"div"> & { tone?: Pastel }) {
  return <div className={cn("brush rounded-2xl p-4 text-ink", PASTEL_BG[tone], className)} {...props} />;
}

/** Нейтральная карточка на кремовом фоне. */
export function PlainCard({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-[0_8px_24px_-18px_rgb(120_90_20/0.35)]", className)} {...props} />;
}
