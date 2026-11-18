import { nav } from './nav'
import { hero } from './hero'
import { intro } from './intro'
import { features } from './features'
import { integrations } from './integrations'
import { split } from './split'
import { testimonials } from './testimonials'
import { setup } from './setup'
import { faq } from './faq'
import { cta } from './cta'
import { footer } from './footer'
import { manifesto } from './manifesto'
import { PRICING_MARKER } from './pricing'
import { eyebrow, icon, type IconName } from './icons'

const FEATURE_ICONS: IconName[] = ['activity', 'trendingDown', 'mic', 'messageCircle', 'chart']
const FAQ_ICONS: IconName[] = ['wallet', 'users', 'landmark', 'triangleAlert', 'shieldCheck', 'logOut', 'calculator', 'send']

/** Adds lucide icons to the generated markup: eyebrow chips, feature cards, FAQ rows and CTA buttons. */
function withIcons(html: string, id: string, name: IconName): string {
  return html.replace('<div class="section-heading"><h2' + id, `<div class="section-heading">${eyebrow(name)}<h2${id}`)
}

const featuresIcons = withIcons(features, '>', 'layoutDashboard').replace(
  /(data-feature="(\d)"[^>]*><span class="feature-heading"><span class="feature-icon">.*?<\/span>)/g,
  (m, _all, i) => m + icon(FEATURE_ICONS[Number(i)] ?? 'activity'),
)
const faqIcons = withIcons(faq, ' id="faq-title">', 'circleHelp').replace(
  /(id="faq-question-(\d+)"[^>]*><span>)/g,
  (m, _all, n) => m + icon(FAQ_ICONS[Number(n) - 1] ?? 'circleHelp'),
)
const navIcons = nav.replace('</a></header>', icon('arrowRight', 20) + '</a></header>')
const ctaIcons = cta
  .replace(/(<a class="button" href="\/app">\{\{cta\.133\}\})(<\/a>)/, `$1${icon('arrowRight', 20)}$2`)
  .replace(/(<a class="button cta-email" href="__TG__">\{\{cta\.134\}\})(<\/a>)/, `$1${icon('send', 20)}$2`)

export const shell = [
  navIcons,
  hero,
  intro,
  featuresIcons,
  withIcons(integrations, '>', 'plug'),
  split,
  withIcons(testimonials, '>', 'messageCircle'),
  withIcons(setup, '>', 'listChecks'),
  faqIcons,
  PRICING_MARKER,
  ctaIcons,
  footer,
].join('')
export { manifesto }
