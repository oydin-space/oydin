import { fetchPlans, type Plan } from "../billing/plans-api"
import { type Locale } from "./copy"
import { LandingScripts } from "./landing-scripts"
import { Testimonials } from "./testimonials"
import { LanguageSwitcher } from "./language-switcher"
import { localize } from "./localize"
import { manifesto, shell } from "./sections"
import { PRICING_MARKER, renderPricing } from "./sections/pricing"

/** Plans come from the backend on the server (API_URL base in api()); on failure the section is simply hidden. */
async function loadPlans(locale: Locale): Promise<Plan[]> {
  try {
    return await fetchPlans(locale)
  } catch {
    return []
  }
}

/** 1:1 port of the moonin.ai landing: static markup + its original CSS/JS from /landing. */
export async function LandingPage({ locale }: { locale: Locale }) {
  const html = localize(shell, locale).replace(PRICING_MARKER, renderPricing(await loadPlans(locale), locale))
  return (
    <>
      <div className="page-shell" dangerouslySetInnerHTML={{ __html: html }} />
      <div dangerouslySetInnerHTML={{ __html: localize(manifesto, locale) }} />
      <Testimonials locale={locale} />
      <LanguageSwitcher locale={locale} />
      <LandingScripts locale={locale} />
    </>
  )
}
