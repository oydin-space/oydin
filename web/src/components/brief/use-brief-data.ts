"use client"

import { useMemo } from "react"
import type { Commitment, Debtor } from "@/lib/planning-api"
import { useApi } from "@/lib/use-api"
import { upcomingPayments } from "./brief-text"

/** Extra morning-brief inputs: this week's payments and debtors. Failures degrade to empty lists. */
export function useBriefData() {
  const commitments = useApi<{ items: Commitment[] }>("/commitments/")
  const debtors = useApi<{ items: Debtor[] }>("/debtors/")
  const payments = useMemo(() => upcomingPayments(commitments.data?.items ?? []), [commitments.data])
  return { payments, debtors: debtors.data?.items ?? [], loading: commitments.loading || debtors.loading }
}
