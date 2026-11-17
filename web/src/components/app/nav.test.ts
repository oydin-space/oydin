import { expect, test } from "bun:test"
import { isActive, primaryFor, secondaryFor } from "./nav"

test("seller sees only operations and settings", () => {
  expect(primaryFor("seller").map((e) => e.id)).toEqual(["operations"])
  expect(secondaryFor("seller").map((e) => e.id)).toEqual(["quick", "settings"])
})

test("owner sees everything, accountant has no team", () => {
  expect(primaryFor("owner")).toHaveLength(4)
  expect(secondaryFor("owner").map((e) => e.id)).toContain("team")
  expect(secondaryFor("accountant").map((e) => e.id)).not.toContain("team")
})

test("active matching", () => {
  expect(isActive("/app", "/app")).toBe(true)
  expect(isActive("/app/plan", "/app")).toBe(false)
  expect(isActive("/app/plan", "/app/plan")).toBe(true)
  expect(isActive("/app/planet", "/app/plan")).toBe(false)
})
