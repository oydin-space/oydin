/**
 * Безопасный вычислитель формул калькуляторов (без eval/new Function).
 * Язык: числа, + - * / ( ), функции min, max, round(x[, знаков]) и имена полей.
 * Тот же синтаксис проверяет сервер (backend/ai/ui.py: check_formula).
 */

type Token = { kind: "num"; value: number } | { kind: "id"; value: string } | { kind: "op"; value: string };

export class FormulaError extends Error {}

const FUNCTIONS = new Set(["min", "max", "round"]);
const MAX_LENGTH = 500;
const MAX_DEPTH = 40;

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n") {
      i++;
    } else if (/[0-9]/.test(c)) {
      const m = /^\d+(?:\.\d+)?/.exec(src.slice(i))!;
      out.push({ kind: "num", value: Number(m[0]) });
      i += m[0].length;
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      out.push({ kind: "id", value: m[0] });
      i += m[0].length;
    } else if ("+-*/(),".includes(c)) {
      out.push({ kind: "op", value: c });
      i++;
    } else {
      throw new FormulaError(`unexpected "${c}"`);
    }
  }
  return out;
}

/** AST: вычисляется много раз при каждом изменении поля, разбираем один раз. */
export type Expr =
  | { t: "num"; v: number }
  | { t: "var"; name: string }
  | { t: "neg"; e: Expr }
  | { t: "bin"; op: "+" | "-" | "*" | "/"; l: Expr; r: Expr }
  | { t: "call"; fn: string; args: Expr[] };

export function parseFormula(src: string): Expr {
  if (src.length > MAX_LENGTH) throw new FormulaError("too long");
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v: string) => toks[i]?.kind === "op" && toks[i].value === v;

  const expr = (depth: number): Expr => {
    if (depth > MAX_DEPTH) throw new FormulaError("too deep");
    let left = term(depth);
    while (isOp("+") || isOp("-")) {
      const op = toks[i++].value as "+" | "-";
      left = { t: "bin", op, l: left, r: term(depth) };
    }
    return left;
  };
  const term = (depth: number): Expr => {
    let left = unary(depth);
    while (isOp("*") || isOp("/")) {
      const op = toks[i++].value as "*" | "/";
      left = { t: "bin", op, l: left, r: unary(depth) };
    }
    return left;
  };
  const unary = (depth: number): Expr => {
    if (depth > MAX_DEPTH) throw new FormulaError("too deep");
    if (isOp("-")) {
      i++;
      return { t: "neg", e: unary(depth + 1) };
    }
    if (isOp("+")) {
      i++;
      return unary(depth + 1);
    }
    const tok = peek();
    if (!tok) throw new FormulaError("unexpected end");
    i++;
    if (tok.kind === "num") return { t: "num", v: tok.value };
    if (tok.kind === "op" && tok.value === "(") {
      const inner = expr(depth + 1);
      if (!isOp(")")) throw new FormulaError("missing )");
      i++;
      return inner;
    }
    if (tok.kind === "id") {
      if (!isOp("(")) return { t: "var", name: tok.value };
      if (!FUNCTIONS.has(tok.value)) throw new FormulaError(`unknown function ${tok.value}`);
      i++;
      const args = [expr(depth + 1)];
      while (isOp(",")) {
        i++;
        args.push(expr(depth + 1));
      }
      if (!isOp(")")) throw new FormulaError("missing )");
      i++;
      if (tok.value === "round" && args.length > 2) throw new FormulaError("round takes 1 or 2 arguments");
      return { t: "call", fn: tok.value, args };
    }
    throw new FormulaError(`unexpected "${tok.value}"`);
  };

  const tree = expr(0);
  if (i !== toks.length) throw new FormulaError("unexpected trailing input");
  return tree;
}

/** Значение выражения; null — деление на ноль, неизвестное имя или нечисловой результат. */
export function evaluate(e: Expr, vars: Record<string, number>): number | null {
  switch (e.t) {
    case "num":
      return e.v;
    case "var":
      return Object.prototype.hasOwnProperty.call(vars, e.name) && Number.isFinite(vars[e.name]) ? vars[e.name] : null;
    case "neg": {
      const v = evaluate(e.e, vars);
      return v === null ? null : -v;
    }
    case "bin": {
      const l = evaluate(e.l, vars);
      const r = evaluate(e.r, vars);
      if (l === null || r === null) return null;
      if (e.op === "/" && r === 0) return null;
      const v = e.op === "+" ? l + r : e.op === "-" ? l - r : e.op === "*" ? l * r : l / r;
      return Number.isFinite(v) ? v : null;
    }
    case "call": {
      const args = e.args.map((a) => evaluate(a, vars));
      if (args.some((a) => a === null)) return null;
      const nums = args as number[];
      if (e.fn === "min") return Math.min(...nums);
      if (e.fn === "max") return Math.max(...nums);
      const digits = Math.max(0, Math.min(6, Math.trunc(nums[1] ?? 0)));
      const k = 10 ** digits;
      return Math.round(nums[0] * k) / k;
    }
  }
}

/** Имена полей, на которые ссылается формула. */
export function formulaNames(e: Expr, into = new Set<string>()): Set<string> {
  if (e.t === "var") into.add(e.name);
  else if (e.t === "neg") formulaNames(e.e, into);
  else if (e.t === "bin") {
    formulaNames(e.l, into);
    formulaNames(e.r, into);
  } else if (e.t === "call") e.args.forEach((a) => formulaNames(a, into));
  return into;
}

/** Разбор + вычисление; любая ошибка → null. */
export function computeFormula(src: string, vars: Record<string, number>): number | null {
  try {
    return evaluate(parseFormula(src), vars);
  } catch {
    return null;
  }
}
