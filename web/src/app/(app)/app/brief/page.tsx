import type { Metadata } from "next";
import { BriefDetail } from "@/components/brief/brief-detail";

export const metadata: Metadata = { title: "Oydin" };

export default function BriefPage() {
  return <BriefDetail />;
}
