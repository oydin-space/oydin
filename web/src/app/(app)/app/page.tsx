import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatView } from "@/components/chat/chat-view";
import { InlineBrief } from "@/components/brief/inline-brief";

export const metadata: Metadata = { title: "Oydin" };

export default function Page() {
  return (
    <Suspense>
      <ChatView lead={<InlineBrief />} />
    </Suspense>
  );
}
