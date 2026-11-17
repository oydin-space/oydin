import { cookies } from "next/headers"
import { LandingPage } from "@/components/landing/landing-page"
import { parseLocale } from "@/components/landing/localize"

export default async function Page() {
  const locale = parseLocale((await cookies()).get("lang")?.value)
  return <LandingPage locale={locale} />
}
