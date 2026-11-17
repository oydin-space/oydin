"""Золотой набор: python -m evals.run. Гоняет чат на демо-бизнесе, проверяет числа, язык и черновики.
Без ключа модели работает запасной путь (fallback) — это видно в отчёте."""

import json
import os
import sys
from pathlib import Path

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from ai import chat, grounding, tools  # noqa: E402
from evals import scorers  # noqa: E402
from finance.seed import seed_demo  # noqa: E402


def main():
    cases = json.loads((Path(__file__).parent / "golden.json").read_text())
    user = seed_demo()
    business = user.profile.business
    evidence = grounding.Evidence(tools.build_facts(business), *[tools.run_tool(business, n, {"q": "а", "days": 90}) for n in tools.TOOLS])
    rows = []
    for case in cases:
        result = chat.answer(business, user, [{"role": "user", "content": case["question"]}])
        checks = {
            "numbers": scorers.no_fabricated_numbers(result["reply"], evidence),
            "russian": scorers.russian(result["reply"]),
        }
        if case["expect"] == "draft":
            checks["draft"] = scorers.draft_matches(result["draft"], case["draft"])
        if case.get("forbid"):
            checks["forbid"] = scorers.forbids(result["reply"], case["forbid"])
        rows.append({"id": case["id"], "fallback": result["fallback"], "checks": checks, "reply": result["reply"]})
    failed = [r for r in rows if not all(r["checks"].values())]
    report = Path(__file__).parent / "report.json"
    report.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    for r in rows:
        print(("OK  " if all(r["checks"].values()) else "FAIL"), r["id"], "(fallback)" if r["fallback"] else "", {k: v for k, v in r["checks"].items() if not v} or "")
    print(f"{len(rows) - len(failed)}/{len(rows)} passed; отчёт: {report}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
