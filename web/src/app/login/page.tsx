import type { Metadata } from "next";
import { LoginView } from "@/components/auth/login-view";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginView next={next ?? null} />;
}
