import type { Metadata } from "next"
import type { ReactNode } from "react"
import { V } from "@/components/landing/build-version"
import { dictionaries } from "@/components/landing/copy"
import { getServerLocale } from "@/i18n/server"
const STYLES = ["style", "v2", "review", "hero", "integration-grid", "lenis"]

export async function generateMetadata(): Promise<Metadata> {
  const copy = dictionaries[await getServerLocale()]
  return {
    title: { absolute: copy["lp4.4"] },
    description: copy["lp4.5"],
    icons: { icon: "/icons/favicon-48.png" },
    openGraph: { images: ["/og.png"] },
  }
}

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.dataset.theme='light'" }} />
      <link rel="preload" as="image" href="/landing/assets/mockups/home-960.webp" />
      {STYLES.map((n) => (
        <link key={n} rel="stylesheet" href={`/landing/css/${n}.css${V}`} precedence="default" />
      ))}
      {children}
    </>
  )
}
