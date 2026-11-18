"use client";

import { useCallback, useState } from "react";
import { OnboardingView } from "@/components/business/onboarding-view";
import { OnboardingChat } from "@/components/onboarding/onboarding-chat";
import { SessionProvider } from "@/components/providers/session-provider";

export default function OnboardingPage() {
  // Если /api/onboarding/state недоступен (старый бэкенд), остаётся прежний мастер создания бизнеса.
  const [fallback, setFallback] = useState(false);
  const onUnavailable = useCallback(() => setFallback(true), []);
  return <SessionProvider>{fallback ? <OnboardingView /> : <OnboardingChat onUnavailable={onUnavailable} />}</SessionProvider>;
}
