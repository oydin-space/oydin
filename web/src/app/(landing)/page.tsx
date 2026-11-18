import { LandingPage } from "@/components/landing/landing-page"
import { getServerLocale } from "@/i18n/server"

export default async function Page() {
  return <LandingPage locale={await getServerLocale()} />
}
