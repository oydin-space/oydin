import { LegalDocument } from "@/components/legal/legal-document";

export default function TermsPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  return <LegalDocument kind="terms" searchParams={searchParams} />;
}
