// getBudgetPace / getElapsed скопированы из ~/Projects/components/components/dashboardblocks/spend.tsx.
// largestRemainder — свой (в components/templates/invest-app/.../home-balance.tsx последней доле просто
// достаётся «100 − уже распределено», это не метод наибольших остатков).

export type BudgetStatus = "over" | "at-risk" | "under" | "on-track";

export interface BudgetPace {
  budget: number;
  expected: number;
  projected: number;
  remaining: number;
  spent: number;
  status: BudgetStatus;
}

export function getBudgetPace({ budget, elapsed, projected: given, spent, tolerance = 0.05 }: { budget: number; elapsed: number; projected?: number; spent: number; tolerance?: number }): BudgetPace {
  const clamped = Math.min(1, Math.max(0, elapsed));
  const projected = given ?? (clamped > 0 ? spent / clamped : spent);
  let status: BudgetStatus = "on-track";
  if (spent > budget) status = "over";
  else if (projected > budget * (1 + tolerance)) status = "at-risk";
  else if (projected < budget * (1 - tolerance)) status = "under";
  return { budget, expected: budget * clamped, projected, remaining: budget - spent, spent, status };
}

export function getElapsed(start: Date, end: Date, now: Date) {
  const total = end.getTime() - start.getTime();
  return total > 0 ? (now.getTime() - start.getTime()) / total : 1;
}

/** Делит целое total по весам так, чтобы сумма частей была ровно total (метод наибольших остатков). */
export function largestRemainder(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k].i] += 1;
  return out;
}
