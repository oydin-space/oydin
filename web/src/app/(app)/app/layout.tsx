"use client";

import { DocumentTitle } from "@/components/app/document-title";
import { AppShell } from "@/components/app/app-shell";
import { useCoreT } from "@/components/app/use-core-t";
import { SessionProvider, useSession } from "@/components/providers/session-provider";
import { ErrorState, Spinner } from "@/components/ui";

function Gate({ children }: { children: React.ReactNode }) {
  const t = useCoreT();
  const { status, error, retry } = useSession();
  if (status === "ready") return (
    <>
      <DocumentTitle />
      <AppShell>{children}</AppShell>
    </>
  );
  return (
    <div className="flex h-dvh items-center justify-center p-6">
      {status === "error" ? <ErrorState message={error ?? t("core.signInFailed")} onRetry={retry} retryLabel={t("core.retry")} /> : <Spinner size={56} label={t("core.signingIn")} />}
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
