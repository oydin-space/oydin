import { describe, expect, test } from "bun:test";
import { computeFormula, FormulaError, formulaNames, parseFormula } from "./formula";

describe("formula", () => {
  test("arithmetic and precedence", () => {
    expect(computeFormula("1 + 2 * 3", {})).toBe(7);
    expect(computeFormula("(1 + 2) * 3", {})).toBe(9);
    expect(computeFormula("-2 * -3", {})).toBe(6);
    expect(computeFormula("10 / 4", {})).toBe(2.5);
    expect(computeFormula("8 - 3 - 2", {})).toBe(3);
  });

  test("named inputs and functions", () => {
    const vars = { price: 20000, cost: 12500, units: 3 };
    expect(computeFormula("(price - cost) * units", vars)).toBe(22500);
    expect(computeFormula("min(price, cost, 100)", vars)).toBe(100);
    expect(computeFormula("max(0, cost - price)", vars)).toBe(0);
    expect(computeFormula("round(10 / 3)", vars)).toBe(3);
    expect(computeFormula("round(10 / 3, 2)", vars)).toBe(3.33);
    expect([...formulaNames(parseFormula("a + max(b, 2) * -c"))].sort()).toEqual(["a", "b", "c"]);
  });

  test("divide by zero and unknown names yield null", () => {
    expect(computeFormula("1 / 0", {})).toBeNull();
    expect(computeFormula("x / (y - y)", { x: 1, y: 2 })).toBeNull();
    expect(computeFormula("missing + 1", {})).toBeNull();
    expect(computeFormula("constructor + 1", {})).toBeNull();
  });

  test("rejects anything outside the grammar", () => {
    for (const bad of ["alert(1)", "a ** 2", "a; b", "a[0]", "\"x\"", "1 +", "(1", "round(1, 2, 3)", "a.b", "x => x", "`x`"]) {
      expect(() => parseFormula(bad)).toThrow(FormulaError);
      expect(computeFormula(bad, { a: 1, b: 2, x: 1 })).toBeNull();
    }
    expect(() => parseFormula("1+".repeat(300) + "1")).toThrow(FormulaError);
  });
});
