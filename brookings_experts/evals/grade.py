#!/usr/bin/env python3
"""Grade a generated memo against the assertions that can be checked mechanically.

The two that matter most are hallucination checks, and both are objective:

  real_people  -- every recommended name exists in the Brookings roster
  live_links   -- every cited URL actually resolves

A memo can read beautifully and fail both. Eyeballing does not catch an invented
scholar or a plausible-looking dead URL, which is exactly why these are scripted.

Usage:
    python3 grade.py <memo.md> [--roster ../data/roster.json] [--no-net]
    python3 grade.py --all <workspace-iteration-dir>
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_ROSTER = HERE.parent / "data" / "roster.json"
UA = "brookings-expert-finder-eval/1.0"

# `### 1. Name — Title` is the template's heading shape, but graders should not
# be brittle about punctuation the model may vary.
REC_HEADING = re.compile(r"^#{2,4}\s*\d+[.)]\s*(.+?)\s*(?:[—–\-|]|$)", re.M)
MD_LINK = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+)\)")
BARE_URL = re.compile(r"(?<!\()\bhttps?://[^\s)>\]]+")
DATE_HINT = re.compile(
    r"\b(19|20)\d{2}\b|"
    r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}?,?\s*(19|20)?\d{2}\b",
    re.I,
)


def norm(name: str) -> str:
    """Fold accents and punctuation so 'Grzymala-Busse' matches 'Grzymała-Busse'."""
    s = unicodedata.normalize("NFKD", name)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^a-z ]", " ", s.lower()).split())


def surname_key(name: str) -> str:
    parts = [p for p in re.sub(r"[^A-Za-z\- ]", " ", name).split() if len(p) > 1]
    return parts[-1].lower() if parts else ""


def load_roster(path: Path) -> list[dict]:
    return json.loads(path.read_text())["people"]


def check_url(url: str, timeout: int = 25) -> tuple[bool, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return (200 <= r.status < 400), str(r.status)
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}"
    except Exception as e:  # network shape varies; the reason is what matters
        return False, type(e).__name__


def grade(memo_path: Path, roster: list[dict], check_net: bool = True) -> dict:
    text = memo_path.read_text()
    people_norm = {norm(p["name"]) for p in roster}
    people_surnames = {surname_key(p["name"]) for p in roster}

    names = [n.strip() for n in REC_HEADING.findall(text)]
    names = [n for n in names if 2 <= len(n.split()) <= 6]

    unknown = [n for n in names
               if norm(n) not in people_norm and surname_key(n) not in people_surnames]

    links = MD_LINK.findall(text)
    urls = [u for _, u in links] + BARE_URL.findall(text)
    urls = list(dict.fromkeys(urls))

    dead: list[tuple[str, str]] = []
    if check_net:
        for u in urls:
            ok, why = check_url(u)
            if not ok:
                dead.append((u, why))

    has = lambda *pats: any(re.search(p, text, re.I) for p in pats)

    expectations = [
        {"text": "Recommends 3-5 experts",
         "passed": 3 <= len(names) <= 5,
         "evidence": f"{len(names)} recommendation headings: {names}"},
        {"text": "Every recommended person is a real Brookings expert in the roster",
         "passed": bool(names) and not unknown,
         "evidence": "all matched" if names and not unknown else f"unmatched: {unknown or 'no names parsed'}"},
        {"text": "Cites at least two linked sources",
         "passed": len(links) >= 2,
         "evidence": f"{len(links)} markdown links, {len(urls)} unique URLs"},
        {"text": "Every cited URL resolves",
         "passed": (not check_net) or (bool(urls) and not dead),
         "evidence": "skipped (--no-net)" if not check_net
                     else (f"{len(urls)} URLs all resolve" if urls and not dead else f"dead: {dead}")},
        {"text": "Citations carry dates",
         "passed": len(DATE_HINT.findall(text)) >= max(2, len(names)),
         "evidence": f"{len(DATE_HINT.findall(text))} date mentions"},
        {"text": "States the consult mode it assumed",
         "passed": has(r"read as", r"consult mode", r"media comment", r"decision brief",
                       r"speaking\s*/?\s*conven", r"convening"),
         "evidence": "mode statement present" if has(r"read as", r"consult mode") else "no explicit 'Read as' line"},
        {"text": "Explains the ranking rather than only listing",
         "passed": has(r"why this order", r"why this ranking", r"ranking rationale"),
         "evidence": "ordering rationale section present" if has(r"why this order") else "missing"},
        {"text": "Gives an access / availability read",
         "passed": has(r"\baccess\b", r"availability", r"hard to (?:book|reach)", r"comms office"),
         "evidence": "access notes present"},
        {"text": "Notes coverage gaps or also-considered candidates",
         "passed": has(r"also considered", r"\bgaps?\b", r"not covered"),
         "evidence": "gap/also-considered section present"},
    ]

    return {
        "memo": str(memo_path),
        "recommended": names,
        "unknown_people": unknown,
        "dead_links": dead,
        "expectations": expectations,
        "score": f"{sum(e['passed'] for e in expectations)}/{len(expectations)}",
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("target", type=Path)
    ap.add_argument("--roster", type=Path, default=DEFAULT_ROSTER)
    ap.add_argument("--all", action="store_true", help="target is an iteration dir; grade every memo.md under it")
    ap.add_argument("--no-net", action="store_true", help="skip URL resolution")
    args = ap.parse_args()

    roster = load_roster(args.roster)
    memos = sorted(args.target.rglob("memo.md")) if args.all else [args.target]
    if not memos:
        print(f"no memo.md found under {args.target}", file=sys.stderr)
        return 1

    for m in memos:
        result = grade(m, roster, check_net=not args.no_net)
        rel = m.relative_to(args.target) if args.all else m.name
        print(f"\n=== {rel}  [{result['score']}]")
        for e in result["expectations"]:
            print(f"  {'PASS' if e['passed'] else 'FAIL'}  {e['text']}")
            if not e["passed"]:
                print(f"        {e['evidence']}")
        (m.parent / "grading.json").write_text(json.dumps(result, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
