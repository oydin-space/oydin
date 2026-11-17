"use client";

import { OnboardingView } from "@/components/business/onboarding-view";
import { SessionProvider } from "@/components/providers/session-provider";

export default function OnboardingPage() {
  return (
    <SessionProvider>
      <OnboardingView />
    </SessionProvider>
  );
}
