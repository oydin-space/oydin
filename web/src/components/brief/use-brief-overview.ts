"use client"

import { useMemo } from "react"
import type { ForecastResponse, PulseData } from "@/lib/core-api"
import { todayIso } from "@/lib/core-api"
import { periodRange, usePeriod } from "@/lib/period"
import type { Transaction } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { runwaySplit, weekRevenue, weekStart } from "./overview"
import { useBriefData } from "./use-brief-data"

/** Everything the brief screens show, from the same endpoints as Home/Pulse. */
export function useBriefOverview() {
  const range = periodRange(usePeriod())
  const pulse = useApi<PulseData>(`/dashboard/pulse/?from=${range.from}&to=${range.to}`)
  const forecast = useApi<ForecastResponse>("/forecast/?days=30")
  const week = useApi<{ items: Transaction[] }>(`/transactions/?status=confirmed&from=${weekStart()}&to=${todayIso()}&limit=200`)
  const { payments, debtors, loading: briefLoading } = useBriefData()
  const split = useMemo(() => (pulse.data ? runwaySplit(pulse.data, forecast.data?.points ?? []) : null), [pulse.data, forecast.data])
  const days = useMemo(() => weekRevenue(week.data?.items ?? []), [week.data])
  return { pulse, payments, debtors, split, days, weekLoading: week.loading, loading: pulse.loading || briefLoading }
}
