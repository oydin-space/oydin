import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LoginView } from "@/components/auth/login-view";
import { LOCALE_COOKIE, parseLocale } from "@/i18n/core";
import { auth } from "@/i18n/parts/auth";

export async function generateMetadata(): Promise<Metadata> {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value) ?? "ru";
  return { title: auth[locale]["auth.meta.title"] };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginView next={next ?? null} />;
}
