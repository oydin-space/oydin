"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { LanguagePicker } from "@/components/ui/language-picker"
import { persistLocale } from "@/i18n/provider"
import type { Locale } from "./copy"
import { applyLocaleInPlace } from "./localize-dom"

/**
 * Flag picker inside both landing navs (`[data-lang-slot]` in the static markup).
 * Landing pages swap their text in place (no navigation, scroll untouched); pages without
 * landing markup (legal) fall back to a server refresh.
 */
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter()
  const [slots, setSlots] = useState<Element[]>([])
  const [current, setCurrent] = useState<Locale>(locale)
  const busy = useRef(false)

  useEffect(() => {
    const id = setTimeout(() => setSlots([...document.querySelectorAll("[data-lang-slot]")]), 0)
    return () => clearTimeout(id)
  }, [])

  const change = async (next: Locale) => {
    if (next === current || busy.current) return
    busy.current = true
    persistLocale(next)
    setCurrent(next)
    try {
      const swapped = document.querySelector(".page-shell") ? await applyLocaleInPlace(next) : false
      if (!swapped) router.refresh()
    } finally {
      busy.current = false
    }
  }

  const control = <LanguagePicker variant="pill" value={current} onChange={(l) => void change(l)} />
  return <>{slots.map((slot, i) => createPortal(control, slot, `lang-${i}`))}</>
}
