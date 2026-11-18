import type { Metadata } from "next";
import { LoginView } from "@/components/auth/login-view";
import { getServerLocale } from "@/i18n/server";
import { auth } from "@/i18n/parts/auth";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: auth[locale]["auth.meta.title"] };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginView next={next ?? null} />;
}
