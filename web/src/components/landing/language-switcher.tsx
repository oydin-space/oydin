"use client"

import { useRouter } from "next/navigation"
import { LanguageSwitcher as KitLanguageSwitcher } from "@/components/ui/language-switcher"

// Locale is shared via the `oydin_lang` cookie; refresh re-renders the server-rendered copy.
export function LanguageSwitcher() {
  const router = useRouter()
  return (
    <div style={{ position: "fixed", left: 12, bottom: 12, zIndex: 60 }}>
      <KitLanguageSwitcher onChange={() => router.refresh()} />
    </div>
  )
}
