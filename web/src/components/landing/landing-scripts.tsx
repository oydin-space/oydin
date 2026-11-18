"use client"

import { useEffect } from "react"
import type { Locale } from "./copy"
import { V } from "./build-version"

const SCRIPTS = [
  "hero-mode", "smooth-scroll", "dialog", "navigation", "mobile-panel-motion", "app", "faq", "motion",
  "v2", "hero-chat", "hero-sky", "scroll-motion", "integration-grid", "cta-crop",
]

type LandingWindow = Window & { __oydinLoaded?: boolean }

/** The moonin scripts bind to the DOM once; load them in order after hydration. */
export function LandingScripts({ locale }: { locale: Locale }) {
  useEffect(() => {
    const w = window as LandingWindow
    if (w.__oydinLoaded) {
      location.reload() // scripts can't be re-bound after a client-side remount
      return
    }
    const root = document.documentElement
    document.body.classList.add("home-page", "v2")
    root.dataset.theme = "light" // the landing is light-only; never inherit the app's dark tokens
    root.lang = locale
    const added: HTMLScriptElement[] = []
    const timer = setTimeout(() => {
      root.lang = locale // the app I18nProvider re-detects from navigator after hydration; the landing copy wins
      w.__oydinLoaded = true
      for (const name of SCRIPTS) {
        const s = document.createElement("script")
        s.src = `/landing/js/${name}.js${V}`
        s.async = false
        document.body.appendChild(s)
        added.push(s)
      }
    }, 0)
    return () => {
      clearTimeout(timer)
      document.body.classList.remove("home-page", "v2")
      delete root.dataset.theme
    }
  }, [locale])
  return null
}
