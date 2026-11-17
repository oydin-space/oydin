import { pageMeta } from "@/components/public/meta";
import { SharedReportView } from "@/components/public/shared-report-view";
import { loadShared } from "@/lib/public-api";

export const generateMetadata = () => pageMeta("public.shared.title", "public.shared.desc", { robots: { index: false, follow: false, nocache: true } });

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedReportView token={token} result={await loadShared(token)} />;
}
