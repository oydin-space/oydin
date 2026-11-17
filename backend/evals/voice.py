"""Голос end-to-end: python -m evals.voice. macOS `say -v Milena` → ffmpeg → webm/ogg/mp4 → voice.handle (ffmpeg→wav→STT→черновик)."""

import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from ai import observability, voice  # noqa: E402
from evals import scorers  # noqa: E402
from finance import services as fin  # noqa: E402
from finance.seed import seed_demo  # noqa: E402

CODECS = {"webm": ("audio/webm;codecs=opus", ["-c:a", "libopus"]), "ogg": ("audio/ogg", ["-c:a", "libopus"]), "mp4": ("audio/mp4", ["-c:a", "aac"])}
CASES = [
    ("Заплатил поставщику четыре миллиона с карты", "webm", {"amount": 4_000_000, "direction": "out", "account_kind": "card"}),
    ("Клиент заплатил полтора миллиона наличными", "ogg", {"amount": 1_500_000, "direction": "in", "account_kind": "cash"}),
    ("Отдал за аренду два миллиона пятьсот тысяч со счёта", "mp4", {"amount": 2_500_000, "direction": "out", "account_kind": "bank"}),
]


def synth(phrase, fmt, tmp):
    aiff, out = Path(tmp) / "s.aiff", Path(tmp) / f"s.{fmt}"
    subprocess.run(["say", "-v", "Milena", "-o", str(aiff), phrase], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(aiff), *CODECS[fmt][1], str(out)], check=True)
    return out.read_bytes(), CODECS[fmt][0]


def main():
    user = seed_demo()
    business = user.profile.business
    accounts = fin.list_accounts(business)
    bad = 0
    with tempfile.TemporaryDirectory() as tmp:
        for phrase, fmt, expected in CASES:
            audio, content_type = synth(phrase, fmt, tmp)
            started = time.monotonic()
            result = voice.handle(business, user, audio, content_type)
            seconds = time.monotonic() - started
            ok = bool(result["text"]) and scorers.draft_matches(result["draft"], expected, accounts)
            bad += not ok
            print("OK  " if ok else "FAIL", fmt, f"{seconds:.1f}s", repr(result["text"]), result["draft"] and {k: result["draft"][k] for k in ("amount", "direction", "category", "account_id")})
    observability.flush()
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
