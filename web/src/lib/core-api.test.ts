import { expect, test } from "bun:test"
import { cashPoints, groupByDate } from "./core-api"
import type { Transaction } from "./types"

const tx = (id: number, date: string) => ({ id, date }) as Transaction

test("groupByDate keeps order and buckets", () => {
  const g = groupByDate([tx(1, "2025-01-02"), tx(2, "2025-01-02"), tx(3, "2025-01-01")])
  expect(g.map((x) => [x.date, x.items.length])).toEqual([["2025-01-02", 2], ["2025-01-01", 1]])
})

test("cashPoints anchors today", () => {
  const p = cashPoints("2025-01-01", 100, [{ date: "2025-01-01", balance: 100, inflow: 0, outflow: 0 }, { date: "2025-01-02", balance: 90, inflow: 0, outflow: 10 }], (d) => d)
  expect(p).toEqual([{ date: "2025-01-01", actual: 100, forecast: 100 }, { date: "2025-01-02", forecast: 90 }])
})
