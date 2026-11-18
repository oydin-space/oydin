import { expect, test } from "bun:test"
import { addDays, hideLowLine, isValidUntil, MAX_DAYS } from "./cash-answer-logic"

const today = "2026-11-18"

test("partial typed date is ignored", () => {
  expect(isValidUntil("", today)).toBe(false)
  expect(isValidUntil("2026-12", today)).toBe(false)
  expect(isValidUntil("2026-12-0", today)).toBe(false)
})

test("out-of-range dates are ignored", () => {
  expect(isValidUntil(today, today)).toBe(false)
  expect(isValidUntil("2026-11-17", today)).toBe(false)
  expect(isValidUntil(addDays(today, MAX_DAYS + 1), today)).toBe(false)
})

test("valid dates are accepted, bounds inclusive", () => {
  expect(isValidUntil("2026-11-19", today)).toBe(true)
  expect(isValidUntil("2026-12-04", today)).toBe(true)
  expect(isValidUntil(addDays(today, MAX_DAYS), today)).toBe(true)
})

test("low line hidden only when it equals the end line", () => {
  expect(hideLowLine({ date: "2026-11-21", balance: 500 }, "2026-11-21", 500)).toBe(true)
  expect(hideLowLine({ date: "2026-11-21", balance: 300 }, "2026-11-21", 500)).toBe(false)
  expect(hideLowLine({ date: "2026-11-20", balance: 500 }, "2026-11-21", 500)).toBe(false)
})
