import { ImpactView } from "@/components/public/impact-view";
import { pageMeta } from "@/components/public/meta";
import { loadImpact } from "@/lib/public-api";

export const generateMetadata = () => pageMeta("public.impact.title", "public.impact.desc");

export default async function ImpactPage() {
  return <ImpactView impact={await loadImpact()} />;
}
