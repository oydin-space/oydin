import type { Metadata } from "next"
import type { ReactNode } from "react"

const STYLES = ["style", "v2", "review", "hero", "integration-grid", "lenis"]

// SEO-тексты лендинга — на основном языке рынка; сам лендинг переключает язык на клиенте.
export const metadata: Metadata = {
  title: "Oydin — второй мозг для вашего бизнеса",
  description: "Прогноз кассовых разрывов, пульс бизнеса и AI-помощник для малого бизнеса Узбекистана.",
  icons: { icon: "/icons/favicon-48.png" },
  openGraph: { images: ["/og.png"] },
}

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.dataset.theme='light'" }} />
      <link rel="preload" as="image" href="/landing/assets/hero-phone-brief-2026-960.webp" />
      {STYLES.map((n) => (
        <link key={n} rel="stylesheet" href={`/landing/css/${n}.css`} precedence="default" />
      ))}
      {children}
    </>
  )
}
