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
const FAQ_ICONS: IconName[] = ['wallet', 'users', 'landmark', 'triangleAlert', 'shieldCheck', 'logOut', 'calculator', 'mail']

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
// Payme and Kapital Bank are not connected yet: mark the tiles "soon" instead of implying a live integration.
const integrationsSoon = integrations.replace(
  /aria-label="(Payme|Kapital Bank)"([^>]*>)(<img[^>]*>)/g,
  (_m, name, rest, img) => `aria-label="${name} · {{lp4.3}}" data-soon${rest}${img}<span class="soon-badge" aria-hidden="true">{{lp4.3}}</span>`,
)
const splitIcons = split
  .replace('<div class="split-copy"><div><h2>{{split.71}}', `<div class="split-copy"><div>${eyebrow('link')}<h2>{{split.71}}`)
  .replace('<div class="split-copy"><div><h2>{{split.77}}', `<div class="split-copy"><div>${eyebrow('compass')}<h2>{{split.77}}`)
  .replace('<img draggable="false" src="/logos/payme.png" alt="">', '<img draggable="false" src="/logos/humo.png" alt="">')
const ctaIcons = cta
  .replace(/(<a class="button" href="\/app">\{\{cta\.133\}\})(<\/a>)/, `$1${icon('arrowRight', 20)}$2`)
  .replace(/(<a class="button cta-email" href="__TG__">\{\{cta\.134\}\})(<\/a>)/, `$1${icon('send', 20)}$2`)

export const shell = [
  navIcons,
  hero,
  intro,
  featuresIcons,
  withIcons(integrationsSoon, '>', 'plug'),
  splitIcons,
  withIcons(testimonials, '>', 'quote'),
  withIcons(setup, '>', 'listChecks'),
  faqIcons,
  PRICING_MARKER,
  ctaIcons,
  footer,
].join('')
export { manifesto }
