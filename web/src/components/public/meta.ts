import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale } from "@/i18n/core";
import { publicPart } from "@/i18n/parts/public";

export type PublicKey = keyof (typeof publicPart)["ru"];

/** SEO-метаданные страницы на языке из cookie `oydin_lang`. */
export async function pageMeta(titleKey: PublicKey, descKey: PublicKey, extra: Metadata = {}): Promise<Metadata> {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value) ?? "ru";
  const title = publicPart[locale][titleKey];
  const description = publicPart[locale][descKey];
  return { title, description, openGraph: { title, description }, ...extra };
}
