import type { Metadata } from "next";
import { Suspense } from "react";
import { ToolsGallery } from "@/components/tools/tools-gallery";

export const metadata: Metadata = { title: "Tools" };

export default function ToolsPage() {
  return (
    <Suspense>
      <ToolsGallery />
    </Suspense>
  );
}
