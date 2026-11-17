"""Золотой набор: python -m evals.run [--model M] [--only id,id] [--no-judge] [--tag имя].
Реальная модель на демо-бизнесе (лучше в отдельной БД: DATABASE_URL=…/oydin_eval — seed_demo пересоздаёт демо-данные).
Проверки: числа из данных, язык, черновик, отказ/инъекции, «нет данных», налоги, график, задержка; тон — LLM-судья.
Запасной путь (fallback) считается провалом: оцениваем модель, а не заглушку."""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.conf import settings  # noqa: E402

from ai import chat, grounding, observability, tools  # noqa: E402
from evals import scorers  # noqa: E402
from finance import services as fin  # noqa: E402
from finance.seed import seed_demo  # noqa: E402


def build_evidence(business):
    """Все данные, которые модель вправе цитировать: факты и результаты инструментов с разными аргументами."""
    sources = [tools.build_facts(business)]
    for days in (7, 14, 30, 60, 90):
        sources.append(tools.run_tool(business, "get_forecast", {"days": days}))
    for period in ("week", "month", "quarter"):
        sources.append(tools.run_tool(business, "get_analytics", {"period": period}))
    sources.append(tools.run_tool(business, "get_orders", {}))
    return grounding.Evidence(*sources)


def check_case(case, result, seconds, evidence, accounts):
    reply = result["reply"]
    checks = {
        "model": not result["fallback"],
        "numbers": scorers.no_fabricated_numbers(reply, evidence),
        "language": scorers.language(reply, case["lang"]),
        "latency": scorers.latency_ok(seconds),
    }
    if "draft" in case:
        checks["draft"] = scorers.draft_matches(result["draft"], case["draft"], accounts)
    if case.get("no_draft"):
        checks["no_draft"] = result["draft"] is None
    if case.get("chart"):
        checks["chart"] = result["chart"] is not None
    if case.get("forbid"):
        checks["forbid"] = scorers.forbids(reply, case["forbid"])
    if case.get("forbid_re"):
        checks["forbid_re"] = scorers.forbids_re(reply, case["forbid_re"])
    if case.get("must_all"):
        checks["must_all"] = scorers.mentions_all(reply, case["must_all"])
    if case.get("must_any"):
        checks["must_any"] = scorers.mentions_any(reply, case["must_any"])
    if case.get("hedge"):
        checks["hedge"] = scorers.mentions_any(reply, case["hedge"])
    return checks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model")
    parser.add_argument("--anthropic", help="модель Claude напрямую через Anthropic API (OpenRouter отключён)")
    parser.add_argument("--only")
    parser.add_argument("--no-judge", action="store_true")
    parser.add_argument("--tag")
    args = parser.parse_args()
    if args.anthropic:
        settings.LLM_API_KEY = ""
        settings.ANTHROPIC_MODEL = settings.ANTHROPIC_CLASSIFY_MODEL = args.anthropic
        settings.LLM_MODEL = "anthropic-direct/" + args.anthropic
        args.no_judge = True
    elif args.model:
        settings.LLM_MODEL, settings.LLM_FALLBACK_MODEL = args.model, ""  # сравниваем одну модель, без подстраховки
    model = settings.LLM_MODEL
    cases = json.loads((Path(__file__).parent / "golden.json").read_text())
    if args.only:
        wanted = set(args.only.split(","))
        cases = [c for c in cases if c["id"] in wanted]
    user = seed_demo()
    business = user.profile.business
    evidence = build_evidence(business)
    accounts = fin.list_accounts(business)
    rows = []
    for case in cases:
        started = time.monotonic()
        case_evidence = grounding.Evidence(case["question"])  # числа из самого вопроса — не выдумка
        case_evidence.values |= evidence.values
        result = chat.answer(business, user, [{"role": "user", "content": case["question"]}])
        seconds = time.monotonic() - started
        checks = check_case(case, result, seconds, case_evidence, accounts)
        judged = None if args.no_judge or result["fallback"] else scorers.judge(case["question"], result["reply"])
        if judged:
            checks["judge"] = min(judged) >= scorers.JUDGE_MIN
        passed = all(checks.values())
        observability.score(result.get("trace_id"), "eval_pass", int(passed))
        rows.append({"id": case["id"], "group": case["group"], "seconds": round(seconds, 1), "checks": checks,
                     "judge": judged, "passed": passed, "question": case["question"], "reply": result["reply"],
                     "draft": result["draft"], "chart": bool(result["chart"]), "trace_id": result.get("trace_id")})
        failed = {k: v for k, v in checks.items() if not v}
        print(("OK  " if passed else "FAIL"), f"{case['id']:<20} {seconds:5.1f}s", failed or "", flush=True)
        if failed:
            print("     ", re.sub(r"\s+", " ", result["reply"])[:240], result["draft"] or "")
    observability.flush()
    n_ok = sum(r["passed"] for r in rows)
    judges = [r["judge"] for r in rows if r["judge"]]
    secs = sorted(r["seconds"] for r in rows)
    summary = {
        "model": model, "passed": n_ok, "total": len(rows),
        "latency_avg": round(sum(secs) / len(secs), 1), "latency_p90": secs[int(0.9 * (len(secs) - 1))],
        "tone_avg": round(sum(j[0] for j in judges) / len(judges), 2) if judges else None,
        "clarity_avg": round(sum(j[1] for j in judges) / len(judges), 2) if judges else None,
    }
    tag = args.tag or re.sub(r"[^\w.-]+", "_", model)
    report = Path(__file__).parent / f"report-{tag}.json"
    report.write_text(json.dumps({"summary": summary, "cases": rows}, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False), f"\nотчёт: {report}")
    sys.exit(0 if n_ok == len(rows) else 1)


if __name__ == "__main__":
    main()
