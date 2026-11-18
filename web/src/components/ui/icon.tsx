import { Flag, HandCoins, Landmark, Lightbulb, Rocket, Scale, Sprout, TrendingUp, Users, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  icon: LucideIcon;
  size?: 16 | 20 | 24;
  /** Если нет label — иконка декоративна и скрыта от скринридеров. */
  label?: string;
}

const SIZE = { 16: "size-4", 20: "size-5", 24: "size-6" } as const;

/** Единый набор иконок (lucide), без декоративных плашек. */
export function Icon({ icon: Glyph, size = 20, label, className, ...props }: IconProps) {
  return (
    <Glyph
      className={cn("shrink-0", SIZE[size], className)}
      strokeWidth={1.75}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      {...props}
    />
  );
}

const NAMED_ICONS = {
  wallet: Wallet,
  flag: Flag,
  lightbulb: Lightbulb,
  "hand-coins": HandCoins,
  "trending-up": TrendingUp,
  landmark: Landmark,
  scale: Scale,
  sprout: Sprout,
  rocket: Rocket,
  users: Users,
} as const satisfies Record<string, LucideIcon>;

/** Допустимые имена иконок для `icon` в Section/StatTile/EvidenceCard/EmptyState; новое имя добавляем в NAMED_ICONS. */
export type IconName = keyof typeof NAMED_ICONS;

export function NamedIcon({ name, size = 16, className }: { name: IconName; size?: 16 | 20; className?: string }) {
  return <Icon icon={NAMED_ICONS[name]} size={size} className={className} />;
}
