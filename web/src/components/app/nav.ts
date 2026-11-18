import { Building2, CalendarDays, CreditCard, LayoutGrid, MessageCircle, Package, ReceiptText, Rocket, Settings, Target, TrendingUp, UserRound, UserRoundCog, Users, Wallet, Wrench, Zap, type LucideIcon } from "lucide-react"
import type { Role } from "@/lib/types"
import type { CoreKey } from "./use-core-t"

export interface NavEntry {
  id: string
  href: string
  label: CoreKey
  icon: LucideIcon
  roles: readonly Role[]
}

const FINANCE: readonly Role[] = ["owner", "accountant"]
const ALL: readonly Role[] = ["owner", "accountant", "seller"]

/** Bottom bar: Oydin (chat-first home) · Pulse · Profile (opens the More sheet). Sellers only get Operations. */
export const PRIMARY: readonly NavEntry[] = [
  { id: "home", href: "/app", label: "core.nav.oydin", icon: MessageCircle, roles: FINANCE },
  { id: "pulse", href: "/app/pulse", label: "core.nav.pulse", icon: TrendingUp, roles: FINANCE },
  { id: "operations", href: "/app/operations", label: "core.nav.operations", icon: ReceiptText, roles: ["seller"] },
]

/** Lives in the "More" sheet on mobile, flat in the desktop sidebar. */
export const SECONDARY: readonly NavEntry[] = [
  { id: "operations", href: "/app/operations", label: "core.nav.operations", icon: ReceiptText, roles: FINANCE },
  { id: "plan", href: "/app/plan", label: "core.nav.plan", icon: Target, roles: FINANCE },
  { id: "calendar", href: "/app/calendar", label: "core.nav.calendar", icon: CalendarDays, roles: FINANCE },
  { id: "products", href: "/app/products", label: "core.nav.products", icon: Package, roles: FINANCE },
  { id: "tools", href: "/app/tools", label: "core.nav.tools", icon: Wrench, roles: FINANCE },
  { id: "team", href: "/app/team", label: "core.nav.team", icon: Users, roles: ["owner"] },
  { id: "people", href: "/app/people", label: "core.nav.people", icon: UserRoundCog, roles: FINANCE },
  { id: "money", href: "/app/money", label: "core.nav.money", icon: Wallet, roles: FINANCE },
  { id: "all", href: "/app/all", label: "core.nav.all", icon: Building2, roles: FINANCE },
  { id: "start", href: "/app/start", label: "core.nav.start", icon: Rocket, roles: FINANCE },
  { id: "modules", href: "/app/settings/modules", label: "core.nav.modules", icon: LayoutGrid, roles: ["owner"] },
  { id: "quick", href: "/app/quick", label: "core.nav.quick", icon: Zap, roles: ALL },
  { id: "billing", href: "/app/billing", label: "core.nav.billing", icon: CreditCard, roles: ["owner"] },
  { id: "settings", href: "/app/settings", label: "core.nav.settings", icon: Settings, roles: ALL },
]

export const MORE_ICON = UserRound

/** Voice entry: the existing quick-entry screen opened in voice mode. */
export const VOICE_HREF = "/app/quick?voice=1"

const allowed = (list: readonly NavEntry[], role: Role | null | undefined) => (role ? list.filter((e) => e.roles.includes(role)) : [])

export const primaryFor = (role: Role | null | undefined) => allowed(PRIMARY, role)
export const secondaryFor = (role: Role | null | undefined) => allowed(SECONDARY, role)

/** Exact for /app, prefix for the rest (so /app/plan?tab=afford still highlights Plan). */
export const isActive = (pathname: string, href: string) => (href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`))
