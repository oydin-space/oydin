// Pricing section: rendered server-side from GET /api/billing/plans/ and injected at PRICING_MARKER.
import { billingText, buyHref, priceLabel, type Plan, type PlanLocale } from "../../billing/plans-api"

export const PRICING_MARKER = "<!--pricing-->"

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const priceHtml = (label: string) => {
  const i = label.lastIndexOf(" / ")
  return i < 0 ? esc(label) : `${esc(label.slice(0, i))}<small> / ${esc(label.slice(i + 3))}</small>`
}
// lucide paths (24x24, stroke).
const PATHS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  sparkles:
    '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  crown:
    '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
  sprout:
    '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  rocket:
    '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
} as const

const svg = (name: string, size = 18) =>
  `<svg class="pr-ico" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name as keyof typeof PATHS] ?? PATHS.sparkles}</svg>`

function list(title: string, items: string[], icon: keyof typeof PATHS, cls: string): string {
  if (items.length === 0) return ""
  const rows = items.map((i) => `<li>${svg(icon, 16)}<span>${esc(i)}</span></li>`).join("")
  return `<div class="pr-block ${cls}"><h4>${esc(title)}</h4><ul>${rows}</ul></div>`
}

function card(plan: Plan, locale: PlanLocale): string {
  const t = (key: Parameters<typeof billingText>[1]) => billingText(locale, key)
  const free = plan.price_uzs === 0
  const ribbon = plan.popular ? `<span class="pr-ribbon">${svg("crown", 16)}${esc(t("billing.popular"))}</span>` : ""
  const note = plan.cta_note ? `<p class="pr-note">${esc(plan.cta_note)}</p>` : ""
  return `<article class="pr-card${plan.popular ? " is-popular" : ""}">${ribbon}
<header><div><h3>${esc(plan.name)}</h3><p class="pr-price">${priceHtml(priceLabel(locale, plan))}</p><p class="pr-tagline">${esc(plan.tagline)}</p></div>${svg(plan.icon, 28)}</header>
<img class="pr-art" src="${esc(plan.image)}" alt="" width="1200" height="900" loading="lazy" draggable="false">
${list(t("billing.section.new"), plan.new_features, "sparkles", "pr-new")}${list(t("billing.section.missing"), plan.missing, "x", "pr-missing")}${list(t("billing.section.limits"), plan.limits, "lock", "pr-limits")}${list(t("billing.section.included"), plan.features, "check", "pr-included")}
<div class="pr-cta"><a class="button" href="${esc(buyHref(plan))}">${esc(free ? t("billing.ctaFree") : t("billing.ctaBuy"))}</a>${note}</div></article>`
}

/** Empty string (section hidden) when there are no plans. */
export function renderPricing(plans: Plan[], locale: PlanLocale): string {
  if (plans.length === 0) return ""
  return `<section class="pricing-section" id="pricing"><div class="wrap section" aria-labelledby="pricing-title"><div class="section-heading"><h2 id="pricing-title">${esc(billingText(locale, "billing.title"))}</h2><p>${esc(billingText(locale, "billing.subtitle"))}</p></div><div class="pr-grid">${plans.map((p) => card(p, locale)).join("")}</div></div></section>`
}
