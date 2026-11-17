import re

from ai import grounding

CYRILLIC = re.compile(r"[а-яё]", re.I)


def no_fabricated_numbers(reply, evidence):
    return not grounding.ungrounded_numbers(reply, evidence)


def russian(reply):
    letters = re.findall(r"[a-zа-яё]", reply, re.I)
    return bool(letters) and len(CYRILLIC.findall(reply)) / len(letters) > 0.7


def draft_matches(draft, expected):
    return draft is not None and all(draft.get(k) == v for k, v in expected.items())


def forbids(reply, banned):
    return not any(b.lower() in reply.lower() for b in banned)
