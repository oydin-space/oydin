"use client";

import { AppShell } from "@/components/app/app-shell";
import { LogoSpinner } from "@/components/brand/logo-spinner";
import { SessionProvider, useSession } from "@/components/providers/session-provider";
import { ErrorState } from "@/components/shared/states";

function Gate({ children }: { children: React.ReactNode }) {
  const { status, error, retry } = useSession();
  if (status === "ready") return <AppShell>{children}</AppShell>;
  return (
    <div className="flex h-dvh items-center justify-center p-6">
      {status === "error" ? <ErrorState message={error ?? "не удалось войти"} onRetry={retry} /> : <LogoSpinner size={56} label="Входим…" />}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Gate>{children}</Gate>
    </SessionProvider>
  );
}
