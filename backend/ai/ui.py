"""Проверка OpenUI Lang (генеративный интерфейс) на сервере.

Поддерживаем строгое подмножество: `id = Component(аргументы)` по одной записи, литералы
(строки, числа, true/false/null, массивы) и ссылки на другие записи. Без $переменных, @действий,
Query/Mutation. Набор компонентов и порядок аргументов совпадают с web/src/components/chat/openui-library.tsx.
Невалидный текст → None: веб тогда показывает обычный текстовый ответ.
"""

import json
import math
import re

from . import grounding

MAX_SIZE = 64 * 1024
MAX_NODES = 400
MAX_DEPTH = 12
MAX_NUMBER_LEN = 20

S, N, B = "str", "num", "bool"
PASTELS = ["butter", "mint", "lavender", "peach", "sky", "rose"]
FORMATS = ["money", "number", "percent", "days", "months"]
INPUTS = {"MoneyField", "NumberField", "SliderField", "ChoiceField"}
BLOCKS = {"TextBlock", "StatCard", "EvidenceCard", "List", "Table", "CashChart", "Progress", "Callout", "Actions", "Calculator", "Stack"}

# имя → [(аргумент, тип, обязателен)]; тип: str|num|bool|("enum", [...])|("refs", {...})|"strs"|"nums"|"cells"
COMPONENTS = {
    "Stack": [("children", ("refs", BLOCKS - {"Stack"}), True)],
    "TextBlock": [("text", S, True), ("variant", ("enum", ["body", "title", "muted"]), False)],
    "StatCard": [("label", S, True), ("amount", N, True), ("hint", S, False), ("tone", ("enum", PASTELS), False)],
    "EvidenceCard": [("claim", S, True), ("items", ("refs", {"EvidenceItem"}), True), ("source", S, False)],
    "EvidenceItem": [("label", S, True), ("date", S, True), ("amount", N, True)],
    "List": [("items", ("refs", {"ListItem"}), True), ("title", S, False)],
    "ListItem": [("title", S, True), ("amount", N, False), ("subtitle", S, False)],
    "Table": [("columns", "strs", True), ("rows", "cells", True)],
    "CashChart": [("title", S, True), ("labels", "strs", True), ("values", "nums", True)],
    "Progress": [("label", S, True), ("value", N, True), ("max", N, True)],
    "Callout": [("title", S, True), ("text", S, False), ("kind", ("enum", ["info", "success", "warning", "error"]), False)],
    "Actions": [("buttons", ("refs", {"ActionButton"}), True)],
    "ActionButton": [("label", S, True), ("prompt", S, True)],
    "Calculator": [("title", S, True), ("inputs", ("refs", INPUTS), True), ("outputs", ("refs", {"Output"}), True), ("note", S, False)],
    "MoneyField": [("name", S, True), ("label", S, True), ("value", N, True)],
    "NumberField": [("name", S, True), ("label", S, True), ("value", N, True), ("unit", S, False)],
    "SliderField": [("name", S, True), ("label", S, True), ("value", N, True), ("min", N, True), ("max", N, True), ("step", N, False)],
    "ChoiceField": [("name", S, True), ("label", S, True), ("options", "strs", True), ("values", "nums", True), ("value", N, True)],
    "Output": [("label", S, True), ("formula", S, True), ("format", ("enum", FORMATS), False)],
}
# Числа, которые модель показывает как факты (проверяются по данным в чате).
GROUNDED_NUMBERS = {("StatCard", "amount"), ("EvidenceItem", "amount"), ("ListItem", "amount"), ("CashChart", "values"),
                    ("Table", "rows"), ("Progress", "value"), ("Progress", "max"), ("MoneyField", "value")}
GROUNDED_TEXT = {"TextBlock", "StatCard", "EvidenceCard", "Callout", "ListItem", "List", "Table"}
NAME_RE = re.compile(r"^[a-z][a-z0-9_]{0,31}$")

DESCRIPTIONS = {
    "Stack": "вертикальный блок; root всегда Stack",
    "TextBlock": "абзац текста",
    "StatCard": "крупная сумма в сумах с подписью",
    "EvidenceCard": "утверждение и операции-доказательства",
    "EvidenceItem": "одна операция: подпись, дата YYYY-MM-DD, сумма",
    "List": "список строк", "ListItem": "строка списка",
    "Table": "таблица; rows — массив строк из строк/чисел",
    "CashChart": "график денег по датам", "Progress": "прогресс value из max",
    "Callout": "заметка-подсказка", "Actions": "кнопки-вопросы", "ActionButton": "кнопка, отправляет prompt в чат",
    "Calculator": "живой калькулятор: поля ввода и выходы-формулы",
    "MoneyField": "поле суммы (name — латиница snake_case)", "NumberField": "поле числа",
    "SliderField": "ползунок", "ChoiceField": "выбор: подписи options и значения values",
    "Output": "результат: formula из + - * / ( ), min, max, round и имён полей",
}


def _signature(name):
    args = []
    for arg, kind, required in COMPONENTS[name]:
        t = kind if isinstance(kind, str) else ("|".join(kind[1]) if kind[0] == "enum" else "[" + "|".join(sorted(kind[1])) + "]")
        args.append(f"{arg}{'' if required else '?'}: {t}")
    return f"{name}({', '.join(args)}) — {DESCRIPTIONS[name]}"


LIBRARY_PROMPT = (
    "OpenUI Lang: по одной записи на строку `id = Компонент(аргументы по порядку)`, первая запись `root = Stack([...])`. "
    "Аргументы — строки в двойных кавычках, числа (целые суммы в сумах), массивы [..] и ссылки на id. "
    "Нельзя: $переменные, @функции, Query, Mutation, другие компоненты.\nКомпоненты:\n"
    + "\n".join(_signature(n) for n in COMPONENTS)
)


class Invalid(Exception):
    pass


# ---------- разбор OpenUI Lang ----------

TOKEN_RE = re.compile(r'\s*(?:(?P<str>"(?:[^"\\\n]|\\.)*")|(?P<num>-?\d+(?:\.\d+)?)|(?P<id>[A-Za-z_][A-Za-z0-9_]*)|(?P<p>[\[\](),=]))')


def _tokens(src):
    pos, out = 0, []
    src = src.rstrip()
    while pos < len(src):
        m = TOKEN_RE.match(src, pos)
        if not m or m.end() == pos:
            raise Invalid("bad token")
        pos = m.end()
        if m.group("str") is not None:
            try:
                out.append(("str", json.loads(m.group("str"))))
            except ValueError as e:
                raise Invalid("bad string") from e
        elif m.group("num") is not None:
            text = m.group("num")
            if len(text) > MAX_NUMBER_LEN:
                raise Invalid("number too long")
            try:
                out.append(("num", float(text) if "." in text else int(text)))
            except (ValueError, OverflowError) as e:
                raise Invalid("bad number") from e
        elif m.group("id") is not None:
            out.append(("id", m.group("id")))
        else:
            out.append(("p", m.group("p")))
    return out


class _Ref:
    def __init__(self, name):
        self.name = name


class _Call:
    def __init__(self, name, args):
        self.name, self.args = name, args


class _Parser:
    def __init__(self, tokens):
        self.t, self.i = tokens, 0

    def peek(self, offset=0):
        j = self.i + offset
        return self.t[j] if j < len(self.t) else (None, None)

    def take(self, kind=None, value=None):
        tok = self.peek()
        if tok[0] is None or (kind and tok[0] != kind) or (value is not None and tok[1] != value):
            raise Invalid("unexpected token")
        self.i += 1
        return tok

    def statements(self):
        out = {}
        while self.i < len(self.t):
            name = self.take("id")[1]
            self.take("p", "=")
            if name in out:
                raise Invalid("duplicate id")
            out[name] = self.value()
        return out

    def value(self):
        kind, val = self.peek()
        if kind in ("str", "num"):
            self.i += 1
            return val
        if kind == "p" and val == "[":
            self.i += 1
            items = []
            while self.peek() != ("p", "]"):
                items.append(self.value())
                if self.peek() == ("p", ","):
                    self.i += 1
                elif self.peek() != ("p", "]"):
                    raise Invalid("bad array")
            self.i += 1
            return items
        if kind == "id":
            self.i += 1
            if val in ("true", "false"):
                return val == "true"
            if val == "null":
                return None
            if self.peek() == ("p", "("):
                self.i += 1
                args = []
                while self.peek() != ("p", ")"):
                    args.append(self.value())
                    if self.peek() == ("p", ","):
                        self.i += 1
                    elif self.peek() != ("p", ")"):
                        raise Invalid("bad call")
                self.i += 1
                return _Call(val, args)
            return _Ref(val)
        raise Invalid("unexpected token")


# ---------- формулы (тот же язык, что web/src/components/chat/formula.ts) ----------

FORMULA_RE = re.compile(r"\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([-+*/(),]))")
FUNCTIONS = {"min", "max", "round"}


def check_formula(formula, names):
    """Синтаксис и имена формулы; Invalid при ошибке."""
    if not isinstance(formula, str) or not formula.strip() or len(formula) > 500:
        raise Invalid("bad formula")
    toks, pos = [], 0
    text = formula.rstrip()
    while pos < len(text):
        m = FORMULA_RE.match(text, pos)
        if not m or m.end() == pos:
            raise Invalid("bad formula token")
        pos = m.end()
        toks.append(("num", m.group(1)) if m.group(1) else ("id", m.group(2)) if m.group(2) else ("op", m.group(3)))
    i = 0

    def peek():
        return toks[i] if i < len(toks) else (None, None)

    def expr(depth):
        nonlocal i
        if depth > 40:
            raise Invalid("formula too deep")
        term(depth)
        while peek() in (("op", "+"), ("op", "-")):
            i += 1
            term(depth)

    def term(depth):
        nonlocal i
        unary(depth)
        while peek() in (("op", "*"), ("op", "/")):
            i += 1
            unary(depth)

    def unary(depth):
        nonlocal i
        if peek() in (("op", "-"), ("op", "+")):
            i += 1
            return unary(depth + 1)
        kind, val = peek()
        i += 1
        if kind == "num":
            return
        if kind == "op" and val == "(":
            expr(depth + 1)
            if peek() != ("op", ")"):
                raise Invalid("formula paren")
            i += 1
            return
        if kind == "id":
            if peek() == ("op", "("):
                if val not in FUNCTIONS:
                    raise Invalid("formula function")
                i += 1
                count = 1
                expr(depth + 1)
                while peek() == ("op", ","):
                    i += 1
                    count += 1
                    expr(depth + 1)
                if peek() != ("op", ")") or (val == "round" and count > 2):
                    raise Invalid("formula call")
                i += 1
                return
            if val not in names:
                raise Invalid("formula name")
            return
        raise Invalid("formula syntax")

    expr(0)
    if i != len(toks):
        raise Invalid("formula trailing")


# ---------- проверка дерева ----------

def _finite(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _check_arg(kind, value, resolve):
    if value is None:
        return None
    if kind == S:
        if not isinstance(value, str) or len(value) > 2000:
            raise Invalid("string expected")
        return value
    if kind == N:
        if not _finite(value):
            raise Invalid("number expected")
        return value
    if kind == B:
        if not isinstance(value, bool):
            raise Invalid("bool expected")
        return value
    if kind == "strs":
        if not isinstance(value, list) or len(value) > 100 or not all(isinstance(x, str) for x in value):
            raise Invalid("strings expected")
        return value
    if kind == "nums":
        if not isinstance(value, list) or len(value) > 100 or not all(_finite(x) for x in value):
            raise Invalid("numbers expected")
        return value
    if kind == "cells":
        if not isinstance(value, list) or len(value) > 100:
            raise Invalid("rows expected")
        for row in value:
            if not isinstance(row, list) or len(row) > 12 or not all(isinstance(c, str) or _finite(c) for c in row):
                raise Invalid("row expected")
        return value
    if kind[0] == "enum":
        if value not in kind[1]:
            raise Invalid("enum value")
        return value
    # refs
    if not isinstance(value, list) or len(value) > 60:
        raise Invalid("children expected")
    nodes = [resolve(v) for v in value]
    if any(n["type"] not in kind[1] for n in nodes):
        raise Invalid("child type")
    return nodes


def parse(source):
    """OpenUI Lang → дерево {type, props}; Invalid при любой ошибке."""
    if not isinstance(source, str) or not source.strip():
        raise Invalid("empty")
    if len(source.encode()) > MAX_SIZE:
        raise Invalid("too large")
    statements = _Parser(_tokens(source)).statements()
    if "root" not in statements:
        raise Invalid("no root")
    count = 0

    def resolve(value, stack=(), depth=0):
        nonlocal count
        if depth > MAX_DEPTH:
            raise Invalid("too deep")
        if isinstance(value, _Ref):
            if value.name in stack or value.name not in statements:
                raise Invalid("bad reference")
            return resolve(statements[value.name], (*stack, value.name), depth)
        if not isinstance(value, _Call) or value.name not in COMPONENTS:
            raise Invalid("unknown component")
        count += 1
        if count > MAX_NODES:
            raise Invalid("too many nodes")
        spec = COMPONENTS[value.name]
        if len(value.args) > len(spec):
            raise Invalid("too many arguments")
        props = {}
        for idx, (arg, kind, required) in enumerate(spec):
            raw = value.args[idx] if idx < len(value.args) else None
            if raw is None and required:
                raise Invalid("missing argument")
            props[arg] = _check_arg(kind, raw, lambda v: resolve(v, stack, depth + 1))
        node = {"type": value.name, "props": props}
        _check_node(node)
        return node

    root = resolve(statements["root"], ("root",))
    if root["type"] != "Stack":
        raise Invalid("root must be Stack")
    return root


def _check_node(node):
    p, t = node["props"], node["type"]
    if t in INPUTS and not NAME_RE.match(p["name"]):
        raise Invalid("bad input name")
    if t == "SliderField" and not (p["min"] <= p["value"] <= p["max"] and p["min"] < p["max"]):
        raise Invalid("slider range")
    if t == "ChoiceField" and (len(p["options"]) != len(p["values"]) or not p["options"]):
        raise Invalid("choice options")
    if t == "Table" and any(len(r) != len(p["columns"]) for r in p["rows"]):
        raise Invalid("table shape")
    if t == "CashChart" and (len(p["labels"]) != len(p["values"]) or not 1 <= len(p["values"]) <= 60):
        raise Invalid("chart shape")
    if t == "Calculator":
        names = [i["props"]["name"] for i in p["inputs"]]
        if not names or len(set(names)) != len(names) or not p["outputs"]:
            raise Invalid("calculator fields")
        for out in p["outputs"]:
            check_formula(out["props"]["formula"], set(names))


def _walk(node):
    yield node
    for value in node["props"].values():
        if isinstance(value, list):
            for v in value:
                if isinstance(v, dict) and "type" in v:
                    yield from _walk(v)


def _grounded(root, evidence):
    for node in _walk(root):
        t = node["type"]
        for arg, value in node["props"].items():
            if (t, arg) in GROUNDED_NUMBERS:
                flat = [c for row in value for c in row] if arg == "rows" else value if isinstance(value, list) else [value]
                if any(_finite(x) and not evidence.supports(x) for x in flat):
                    return False
            if t in GROUNDED_TEXT:
                texts = [value] if isinstance(value, str) else [c for row in value for c in row if isinstance(c, str)] if arg == "rows" else []
                if any(grounding.ungrounded_numbers(s, evidence) for s in texts):
                    return False
    return True


def validate(source, evidence=None):
    """Чистая строка OpenUI Lang или None. С evidence — ещё и сверка чисел с данными (чат)."""
    try:
        root = parse(source)
    except (Invalid, RecursionError):
        return None
    if evidence is not None and not _grounded(root, evidence):
        return None
    return source.strip()


def validate_tool(source):
    """Спецификация сохраняемого инструмента: валидна и содержит хотя бы один Calculator."""
    try:
        root = parse(source)
    except (Invalid, RecursionError):
        return None
    if not any(n["type"] == "Calculator" for n in _walk(root)):
        return None
    return source.strip()


def input_names(source):
    root = parse(source)
    return {n["props"]["name"] for n in _walk(root) if n["type"] in INPUTS}
