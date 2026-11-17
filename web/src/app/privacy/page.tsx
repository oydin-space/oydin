import { LegalDocument } from "@/components/legal/legal-document";

export default function PrivacyPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  return <LegalDocument kind="privacy" searchParams={searchParams} />;
}
