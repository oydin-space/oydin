import { expect, test } from "bun:test"
import { dateLong, metricValue, money, pct, soft, softSum } from "./format"

const nb = "\u00a0"

test("ru is the default", () => {
  expect(money(4_000_000)).toBe(`4${nb}000${nb}000${nb}сум`)
  expect(soft(2_540_000)).toBe(`2,5${nb}млн`)
  expect(soft(130_000)).toBe(`130${nb}тыс.`)
  expect(soft(-3_000_000_000)).toBe(`−3${nb}млрд`)
  expect(softSum(1_000_000, "ru")).toBe(`1${nb}млн${nb}сум`)
  expect(metricValue("days", 3)).toBe(`3${nb}дня`)
})

test("uz latin units", () => {
  expect(soft(2_540_000, "uz")).toBe(`2,5${nb}mln`)
  expect(soft(130_000, "uz")).toBe(`130${nb}ming`)
  expect(soft(5_000_000_000, "uz")).toBe(`5${nb}mlrd`)
  expect(softSum(1_000_000, "uz")).toBe(`1${nb}mln${nb}soʻm`)
  expect(money(500, "uz")).toContain("soʻm")
  expect(metricValue("days", 3, "uz")).toBe(`3${nb}kun`)
})

test("en units", () => {
  expect(soft(2_540_000, "en")).toBe("2.5M")
  expect(soft(130_000, "en")).toBe("130K")
  expect(soft(5_000_000_000, "en")).toBe("5B")
  expect(soft(900, "en")).toBe("900")
  expect(money(4_000_000, "en")).toBe(`UZS${nb}4,000,000`)
  expect(softSum(130_000, "en")).toBe(`UZS${nb}130K`)
  expect(metricValue("days", 1, "en")).toBe(`1${nb}day`)
  expect(metricValue("days", 2, "en")).toBe(`2${nb}days`)
  expect(pct(12.5, 1, "en")).toBe("12.5%")
})

test("dateLong follows locale", () => {
  expect(dateLong("2026-03-05", "en")).toContain("March")
  expect(dateLong("2026-03-05", "ru")).toContain("марта")
})
