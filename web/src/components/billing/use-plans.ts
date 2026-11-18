"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/i18n";
import { fetchPlans, type Plan } from "./plans-api";

export type PlansState = { status: "loading" } | { status: "error" } | { status: "ready"; plans: Plan[] };

/** Plans for the current UI locale; refetches when the language changes. */
export function usePlans() {
  const [locale] = useLocale();
  const [state, setState] = useState<PlansState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    const id = setTimeout(() => alive && setState({ status: "loading" }), 0);
    fetchPlans(locale)
      .then((plans) => alive && setState({ status: "ready", plans }))
      .catch(() => alive && setState({ status: "error" }));
    return () => {
      clearTimeout(id);
      alive = false;
    };
  }, [locale, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { locale, state, retry };
}
