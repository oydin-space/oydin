import type { Metadata } from "next";
import { Suspense } from "react";
import { ToolDetail } from "@/components/tools/tool-detail";

export const metadata: Metadata = { title: "Tool" };

export default async function ToolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ToolDetail id={Number(id)} />
    </Suspense>
  );
}
