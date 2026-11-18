import { api, post } from "@/lib/api"
import { billing } from "@/i18n/parts/billing"

export type PlanLocale = "ru" | "uz" | "en"

export interface Plan {
  code: string
  name: string
  tagline: string
  cta_note: string
  icon: string
  price_uzs: number
  period: string
  popular: boolean
  image: string
  features: string[]
  new_features: string[]
  missing: string[]
  limits: string[]
}

export type SubscriptionStatus = "free" | "pending" | "active"
export interface Subscription {
  plan: string
  status: SubscriptionStatus
  renews_at: string | null
}
export type CheckoutResult = { available: false } | { available: true; url: string }

export const TELEGRAM_URL = "https://t.me/oydin_agent"

export const fetchPlans = (lang: PlanLocale) => api<{ plans: Plan[] }>(`/billing/plans/?lang=${lang}`).then((r) => r.plans)
export const fetchSubscription = () => api<Subscription>("/billing/subscription/")
export const checkout = (plan: string) => post<CheckoutResult>("/billing/checkout/", { plan })

/** Integer UZS with non-breaking thousands separators: 149 000. */
export const groupAmount = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0")

/** Plain translator for the billing slice (server-safe, no hooks). */
export function billingText(locale: PlanLocale, key: keyof typeof billing.ru, params?: Record<string, string | number>): string {
  const raw = billing[locale][key] ?? billing.ru[key]
  return params ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : raw
}

export const priceLabel = (locale: PlanLocale, plan: Plan) =>
  plan.price_uzs > 0 ? billingText(locale, "billing.price", { amount: groupAmount(plan.price_uzs) }) : billingText(locale, "billing.priceFree")

export const buyHref = (plan: Plan) => (plan.price_uzs > 0 ? `/login?next=${encodeURIComponent(`/app/billing?plan=${plan.code}`)}` : "/login")

/** In-app target for choosing a plan (stays inside the app shell). */
export const appPlanHref = (plan: Plan) => `/app/billing?plan=${plan.code}`

/** Checkout is refused for the shared demo tenant (backend error code `demo_tenant`). */
export const DEMO_TENANT_ERROR = "demo_tenant"
