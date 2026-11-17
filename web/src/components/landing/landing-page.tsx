import { type Locale } from "./copy"
import { LandingScripts } from "./landing-scripts"
import { LanguageSwitcher } from "./language-switcher"
import { localize } from "./localize"
import { manifesto, shell } from "./sections"

/** 1:1 port of the moonin.ai landing: static markup + its original CSS/JS from /landing. */
export function LandingPage({ locale }: { locale: Locale }) {
  return (
    <>
      <div className="page-shell" dangerouslySetInnerHTML={{ __html: localize(shell, locale) }} />
      <div dangerouslySetInnerHTML={{ __html: localize(manifesto, locale) }} />
      <LanguageSwitcher />
      <LandingScripts locale={locale} />
    </>
  )
}
