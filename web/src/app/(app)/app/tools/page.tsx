import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { ToolsGallery } from "@/components/tools/tools-gallery";
import { LOCALE_COOKIE, parseLocale } from "@/i18n/core";
import { chat } from "@/i18n/parts/chat";

export async function generateMetadata(): Promise<Metadata> {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value) ?? "ru";
  return { title: chat[locale]["chat.tools.title"] };
}

export default function ToolsPage() {
  return (
    <Suspense>
      <ToolsGallery />
    </Suspense>
  );
}
