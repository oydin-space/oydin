"use client"

import { labels, locales, type Locale } from "./copy"

function setLang(next: Locale) {
  document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`
  location.reload()
}

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const select = (next: Locale) => {
    if (next !== locale) setLang(next)
  }
  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        position: "fixed", left: 12, bottom: 12, zIndex: 60, display: "flex", gap: 2, padding: 3,
        borderRadius: 999, background: "rgba(255,255,255,.82)", backdropFilter: "blur(10px)",
        boxShadow: "0 2px 12px rgba(0,0,0,.12)", font: "600 12px/1 var(--font-onest), sans-serif",
      }}
    >
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => select(l)}
          aria-pressed={l === locale}
          style={{
            border: 0, borderRadius: 999, padding: "7px 10px", cursor: "pointer",
            background: l === locale ? "#ffd62c" : "transparent", color: "#1f1f1f",
          }}
        >
          {labels[l]}
        </button>
      ))}
    </div>
  )
}
