"use client";

import { CalendarDays, Gauge, Package, ReceiptText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CrayonIcon, type CrayonName } from "@/components/brand/crayon-icon";
import { Logo, Wordmark } from "@/components/brand/logo";
import { useSession } from "@/components/providers/session-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/app", label: "Пульс", icon: "pulse", fallback: Gauge },
  { href: "/app/calendar", label: "Календарь", icon: "calendar", fallback: CalendarDays },
  { href: "/app/operations", label: "Операции", icon: "operations", fallback: ReceiptText },
  { href: "/app/products", label: "Товары", icon: "products", fallback: Package },
] as const satisfies readonly { href: string; label: string; icon: CrayonName; fallback: typeof Gauge }[];

function NavLink({ item, active, rail }: { item: (typeof NAV)[number]; active: boolean; rail: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-1 rounded-2xl text-xs transition-colors",
        rail ? "flex-row gap-3 px-3 py-2 text-sm" : "flex-1 flex-col py-1.5",
        active ? "bg-butter font-medium" : "text-ink/70 hover:bg-muted",
      )}
    >
      <CrayonIcon name={item.icon} fallback={item.fallback} size={rail ? 30 : 28} />
      {item.label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user } = useSession();
  const isActive = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));
  return (
    <div className="flex h-dvh flex-col bg-background lg:flex-row">
      <aside className="pt-safe hidden w-60 shrink-0 flex-col gap-6 border-r border-border p-4 lg:flex">
        <Wordmark />
        <nav className="flex flex-col gap-1" aria-label="Разделы">
          {NAV.map((n) => <NavLink key={n.href} item={n} active={isActive(n.href)} rail />)}
        </nav>
        <p className="mt-auto truncate text-sm text-muted-foreground">{user?.business.name}</p>
      </aside>
      <header className="pt-safe flex items-center justify-between px-4 pb-1 pt-3 lg:hidden">
        <Logo size={32} />
        <span className="truncate pl-3 text-sm text-muted-foreground">{user?.business.name}</span>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-2 lg:px-8 lg:pt-6 [&:has(>[data-fill])]:overflow-hidden">{children}</main>
      <nav className="pb-safe flex gap-1 border-t border-border bg-card/80 px-2 pt-1.5 backdrop-blur lg:hidden" aria-label="Разделы">
        {NAV.map((n) => <NavLink key={n.href} item={n} active={isActive(n.href)} rail={false} />)}
      </nav>
    </div>
  );
}
