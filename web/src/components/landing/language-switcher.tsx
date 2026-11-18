"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { persistLocale } from "@/i18n/provider"
import { LOCALES, LOCALE_LABELS } from "@/i18n/core"
import type { Locale } from "./copy"

/**
 * RU / UZ / EN inside both landing navs (`[data-lang-slot]` in the static markup).
 * The value comes from the server-resolved landing locale, not the app i18n provider,
 * so the control always matches the rendered copy (default RU without a cookie).
 */
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter()
  const [slots, setSlots] = useState<Element[]>([])

  useEffect(() => {
    const id = setTimeout(() => setSlots([...document.querySelectorAll("[data-lang-slot]")]), 0)
    return () => clearTimeout(id)
  }, [])

  const control = (
    <SegmentedControl<Locale>
      label="Language"
      className="w-auto shrink-0 p-0.5 [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:px-2 [&_button]:text-[13px]"
      options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))}
      value={locale}
      onValueChange={(next) => {
        persistLocale(next)
        router.refresh() // re-renders the server copy; LandingScripts reloads to rebind the scripts
      }}
    />
  )
  return <>{slots.map((slot, i) => createPortal(control, slot, `lang-${i}`))}</>
}
