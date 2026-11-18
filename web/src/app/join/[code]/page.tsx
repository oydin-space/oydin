import type { Metadata } from "next";
import { JoinView } from "@/components/business/join-view";

export const metadata: Metadata = { title: "Oydin", robots: { index: false } };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinView code={code} />;
}
