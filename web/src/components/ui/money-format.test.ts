import { expect, test } from "bun:test"
import { currencyLabel, formatMoney, parseAmount } from "./money-format"

const nb = "\u00a0"

test("compact units per locale", () => {
  expect(formatMoney(2_500_000, { mode: "compact" })).toBe(`2,5${nb}млн${nb}сум`)
  expect(formatMoney(2_500_000, { mode: "compact", locale: "uz" })).toBe(`2,5${nb}mln${nb}so'm`)
  expect(formatMoney(130_000, { mode: "compact", locale: "uz" })).toBe(`130${nb}ming${nb}so'm`)
  expect(formatMoney(2_500_000, { mode: "compact", locale: "en" })).toBe(`UZS${nb}2.5M`)
  expect(formatMoney(5_000_000_000, { mode: "compact", locale: "en" })).toBe(`UZS${nb}5B`)
  expect(formatMoney(130_000, { mode: "compact", locale: "en", withCurrency: false })).toBe("130K")
})

test("exact and sign", () => {
  expect(formatMoney(-1500, { locale: "en", sign: "always" })).toBe(`\u2212UZS${nb}1,500`)
  expect(formatMoney(null)).toBe("\u2014")
})

test("parseAmount understands all locales' suffixes", () => {
  expect(parseAmount("3 млн", "UZS")).toBe(3_000_000)
  expect(parseAmount("2,5 mln", "UZS")).toBe(2_500_000)
  expect(parseAmount("500K", "UZS")).toBe(500_000)
  expect(parseAmount("abc", "UZS")).toBeNull()
})

test("currencyLabel", () => {
  expect(currencyLabel("UZS", "uz")).toBe("so'm")
  expect(currencyLabel("UZS", "en")).toBe("UZS")
  expect(currencyLabel("UZS")).toBe("сум")
})
