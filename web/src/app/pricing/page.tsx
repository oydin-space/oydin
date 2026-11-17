import { pageMeta } from "@/components/public/meta";
import { PricingView } from "@/components/public/pricing-view";

export const generateMetadata = () => pageMeta("public.pricing.title", "public.pricing.desc");

export default function PricingPage() {
  return <PricingView />;
}
