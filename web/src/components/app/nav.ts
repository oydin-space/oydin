import { CalendarDays, CreditCard, Ellipsis, House, MessageCircle, Package, ReceiptText, Settings, Target, Users, Wrench, Zap, type LucideIcon } from "lucide-react"
import type { Role } from "@/lib/types"
import type { CoreKey } from "./use-core-t"

export interface NavEntry {
  id: string
  href: string
  label: CoreKey
  icon: LucideIcon
  roles: readonly Role[]
  dock?: "left" | "right"
}

const FINANCE: readonly Role[] = ["owner", "accountant"]
const ALL: readonly Role[] = ["owner", "accountant", "seller"]

/** Dock: Home · Operations · [mic] · Assistant · More. `dock` is the side of the central mic. */
export const PRIMARY: readonly NavEntry[] = [
  { id: "home", href: "/app", label: "core.nav.home", icon: House, roles: FINANCE, dock: "left" },
  { id: "operations", href: "/app/operations", label: "core.nav.operations", icon: ReceiptText, roles: ALL, dock: "left" },
  { id: "chat", href: "/app/chat", label: "core.nav.assistant", icon: MessageCircle, roles: FINANCE, dock: "right" },
]

/** Lives in the "More" sheet on mobile, flat in the desktop sidebar. */
export const SECONDARY: readonly NavEntry[] = [
  { id: "plan", href: "/app/plan", label: "core.nav.plan", icon: Target, roles: FINANCE },
  { id: "calendar", href: "/app/calendar", label: "core.nav.calendar", icon: CalendarDays, roles: FINANCE },
  { id: "products", href: "/app/products", label: "core.nav.products", icon: Package, roles: FINANCE },
  { id: "tools", href: "/app/tools", label: "core.nav.tools", icon: Wrench, roles: FINANCE },
  { id: "team", href: "/app/team", label: "core.nav.team", icon: Users, roles: ["owner"] },
  { id: "quick", href: "/app/quick", label: "core.nav.quick", icon: Zap, roles: ALL },
  { id: "billing", href: "/app/billing", label: "core.nav.billing", icon: CreditCard, roles: ["owner"] },
  { id: "settings", href: "/app/settings", label: "core.nav.settings", icon: Settings, roles: ALL },
]

export const MORE_ICON = Ellipsis

/** Voice entry: the existing quick-entry screen opened in voice mode. */
export const VOICE_HREF = "/app/quick?voice=1"

const allowed = (list: readonly NavEntry[], role: Role | null | undefined) => (role ? list.filter((e) => e.roles.includes(role)) : [])

export const primaryFor = (role: Role | null | undefined) => allowed(PRIMARY, role)
export const secondaryFor = (role: Role | null | undefined) => allowed(SECONDARY, role)

/** Exact for /app, prefix for the rest (so /app/plan?tab=afford still highlights Plan). */
export const isActive = (pathname: string, href: string) => (href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`))
