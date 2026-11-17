import { pageMeta } from "@/components/public/meta";
import { PartnerView } from "@/components/public/partner-view";

export const generateMetadata = () => pageMeta("public.partner.title", "public.partner.desc", { robots: { index: false, follow: false } });

export default function PartnerPage() {
  return <PartnerView />;
}
