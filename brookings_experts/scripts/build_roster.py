#!/usr/bin/env python3
"""Build the bundled Brookings expert roster from two public page fetches.

Why a script and not a one-off: the roster changes as people join and leave, and
a workshop skill that can't be refreshed is dead within a year. Re-run this and
commit the diff.

Data path (both fetches are ordinary public pages, no API keys):

  /research-commentary/  carries an inline `brookingsAlgolia` config object with
                         the full expert list (name, profile URL, titles) plus
                         the program / topic / region taxonomies.
  /experts/              carries one card per expert with the program, topic and
                         region IDs that Brookings itself files them under.

They join on the profile slug.

Deliberately NOT collected: recency. Nothing on these pages says when someone
last published, and the tempting proxies are all wrong -- a person record's
`modified` date moves when someone swaps a headshot. Bundling that as "activity"
would be a fabricated number, so the skill resolves recency live instead.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

BASE = "https://www.brookings.edu"
CONFIG_PAGE = f"{BASE}/research-commentary/"
DIRECTORY_PAGE = f"{BASE}/experts/"
UA = "brookings-expert-finder/1.0 (roster builder; contact: repo owner)"

# Appointment types, checked longest-first so "Nonresident Senior Fellow" never
# matches the bare "Senior Fellow" rule.
APPOINTMENT_RULES = [
    ("emeritus", ("emeritus", "emerita")),
    ("nonresident", ("nonresident", "non-resident")),
    ("visiting", ("visiting",)),
    ("affiliate", ("affiliate", "adjunct", "consultant")),
]

# Seniority tiers. These drive the access caveat in the memo, not the ranking:
# a president is not a better source than a fellow, just a harder booking.
SENIORITY_RULES = [
    ("institutional_leadership", ("president", "vice president", "executive vice")),
    ("program_leadership", ("director", "chair of", "dean")),
    ("senior", ("senior fellow", "senior research", "distinguished")),
    ("mid", ("fellow", "scholar", "economist")),
    ("junior", ("research analyst", "research assistant", "senior research assistant")),
]


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", errors="replace")


def fetch_expert_tagged() -> dict[str, str]:
    """Every person record carrying the `expert` type, as slug -> name.

    Why this exists: the /experts/ directory is curated and complete-looking, and
    it is neither. It omits people who are plainly current -- the Vice President
    and Director of Global Economy and Development is missing from it, as is at
    least one nonresident senior fellow whose profile describes an active
    appointment. An eval run caught the VP, which is the only reason we know.

    The `person-type` taxonomy is the wider net: ~730 records against the
    directory's 381. It is not a drop-in replacement, because it is maintained
    inconsistently in the other direction -- departed scholars keep the expert
    tag (while at least one was demoted to guest-author instead), and these
    records carry no topic, region or center facets to route on.

    So: directory for the curated core, this for recall, and the difference gets
    published as a flagged supplement rather than silently merged.

    The taxonomy is not exposed as a REST filter -- passing `person-type=expert`
    returns byte-identical results to passing nothing, which is easy to mistake
    for a working filter. The tag only leaks through `class_list`, so the whole
    post type has to be walked.
    """
    out: dict[str, str] = {}
    page = 1
    while True:
        url = (f"{BASE}/wp-json/wp/v2/person?per_page=100&page={page}"
               "&orderby=title&order=asc&_fields=slug,title,class_list")
        try:
            records = json.loads(fetch(url))
        except urllib.error.HTTPError as e:
            if e.code == 400:  # ran past the last page
                break
            raise
        if not records:
            break
        for r in records:
            if "person-type-expert" in r.get("class_list", []):
                out[r["slug"]] = html.unescape(r["title"]["rendered"])
        if page % 50 == 0:
            print(f"  ...scanned {page} pages, {len(out)} expert-tagged so far", flush=True)
        page += 1
        time.sleep(0.15)  # be a considerate guest on someone else's server
    return out


def extract_config(page_html: str) -> dict:
    """Pull the inline brookingsAlgolia object out of the page.

    Uses raw_decode rather than a regex for the closing brace: the object is
    ~600KB of nested JSON and any 'match up to the last }' pattern is a coin
    flip.
    """
    marker = "const brookingsAlgolia = "
    i = page_html.find(marker)
    if i < 0:
        raise SystemExit(
            f"config object not found on {CONFIG_PAGE}\n"
            "Brookings changed their page structure -- re-check which pages "
            "carry the inline config before trusting anything downstream."
        )
    obj, _ = json.JSONDecoder().raw_decode(page_html[i + len(marker):])
    return obj


def flatten_entities(entities: list, out: dict | None = None, parent: str | None = None) -> dict:
    """Programs contain nested centers, projects and initiatives; flatten to id -> info.

    `parent is None` marks the five top-level programs; everything else is a
    center, project or initiative. That split matters downstream: a program is
    where someone is filed, a center is what they actually work on.
    """
    out = {} if out is None else out
    for e in entities:
        out[str(e["term_id"])] = {
            "title": html.unescape(e["title"]),
            "slug": e.get("slug"),
            "parent": parent,
        }
        flatten_entities(e.get("children") or [], out, html.unescape(e["title"]))
    return out


def parse_cards(page_html: str) -> dict:
    """slug -> facet IDs Brookings files each expert under."""
    pattern = re.compile(
        r"data-filter-research-programs='(\[[^']*\])'\s+"
        r"data-filter-topics='(\[[^']*\])'\s+"
        r"data-filter-regions='(\[[^']*\])'\s+"
        r'data-search-keywords="([^"]*)"'
        r".*?/people/([a-z0-9-]+)/",
        re.S,
    )
    cards = {}
    for programs, topics, regions, _keywords, slug in pattern.findall(page_html):
        cards[slug] = {
            "program_ids": json.loads(programs),
            "topic_ids": json.loads(topics),
            "region_ids": json.loads(regions),
        }
    return cards


def classify(titles: list[str]) -> dict:
    """Derive appointment type and seniority from the title strings.

    Brookings encodes a lot in these: "Nonresident Senior Fellow - Governance
    Studies" tells you affiliation strength, rank, and home unit at once.
    """
    blob = " ; ".join(titles).lower()

    appointment = "resident"
    for label, needles in APPOINTMENT_RULES:
        if any(n in blob for n in needles):
            appointment = label
            break

    seniority = "unclassified"
    for label, needles in SENIORITY_RULES:
        if any(n in blob for n in needles):
            seniority = label
            break

    # A named chair ("Miriam K. Carliner Chair") signals an endowed senior post.
    named_chair = bool(re.search(r"\b[A-Z][a-zA-Z.]+\s+(?:[A-Z][a-zA-Z.]+\s+)*Chair\b", " ; ".join(titles)))

    return {"appointment": appointment, "seniority": seniority, "named_chair": named_chair}


def build(deep: bool = True) -> dict:
    config = extract_config(fetch(CONFIG_PAGE))
    experts = json.loads(config["experts"])
    entities = flatten_entities(json.loads(config["entities"]))
    topics = {str(t["id"]): t for t in json.loads(config["topicTerms"])}
    regions = {str(r["id"]): r for r in json.loads(config["regionTerms"])}
    cards = parse_cards(fetch(DIRECTORY_PAGE))

    people = []
    for term_id, rec in experts.items():
        slug_match = re.search(r"/people/([a-z0-9-]+)/", rec.get("link", ""))
        if not slug_match:
            continue
        slug = slug_match.group(1)
        titles = [html.unescape(t).strip().rstrip(",") for t in rec.get("titles") or [] if t.strip()]
        card = cards.get(slug, {})

        # Split the entity facets into the top-level program someone is filed
        # under and the centers/initiatives they actually work in.
        filed_under, centers = [], []
        for i in card.get("program_ids", []):
            if i not in entities:
                continue
            (centers if entities[i]["parent"] else filed_under).append(entities[i]["title"])

        people.append({
            "term_id": term_id,
            "slug": slug,
            "name": html.unescape(rec["name"]),
            "url": rec["link"],
            "titles": titles,
            **classify(titles),
            "programs": filed_under,
            "centers": centers,
            "topics": [html.unescape(topics[i]["name"]) for i in card.get("topic_ids", []) if i in topics],
            "regions": [html.unescape(regions[i]["name"]) for i in card.get("region_ids", []) if i in regions],
            "in_directory": slug in cards,
        })

    people.sort(key=lambda p: p["name"].split()[-1].lower())

    supplement = []
    if deep:
        print("scanning person records for expert-tagged people outside the directory...")
        listed = {p["slug"] for p in people}
        supplement = sorted(
            ({"slug": s, "name": n} for s, n in fetch_expert_tagged().items() if s not in listed),
            key=lambda r: r["name"].split()[-1].lower(),
        )
        print(f"  found {len(supplement)} expert-tagged people absent from the directory")

    return {
        "built": date.today().isoformat(),
        "source": {"config": CONFIG_PAGE, "directory": DIRECTORY_PAGE},
        "counts": {"experts": len(people), "topics": len(topics), "regions": len(regions),
                   "supplementary": len(supplement)},
        "supplementary": supplement,
        "topic_tree": [{"name": t["name"], "parent": t["parent"], "slug": t["slug"]} for t in topics.values()],
        "people": people,
    }


def home_unit(person: dict) -> str:
    """The program a person is filed under first, used to shard the detail files."""
    return person["programs"][0] if person["programs"] else "Unaffiliated"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "other"


APPOINTMENT_MARK = {
    "resident": "",
    "nonresident": " [nonres]",
    "visiting": " [visiting]",
    "emeritus": " [emeritus]",
    "affiliate": " [affiliate]",
}


def write_outputs(data: dict, root: Path) -> None:
    refs = root / "skills" / "brookings-expert-finder" / "references"
    (refs / "roster").mkdir(parents=True, exist_ok=True)
    (root / "data").mkdir(parents=True, exist_ok=True)

    (root / "data" / "roster.json").write_text(json.dumps(data, indent=2) + "\n")

    by_unit = defaultdict(list)
    for p in data["people"]:
        by_unit[home_unit(p)].append(p)

    # Tier 1: the routing layer, sharded by dimension.
    #
    # Sharding is not decoration. Brookings tags many people on only one
    # dimension -- the director of the China Center carries regions and centers
    # but no topic tags at all -- so a topic-only index buries exactly the people
    # a foreign-policy question needs. Three files let a question open only the
    # dimensions it actually has.
    #
    # Names are packed onto shared lines rather than bulleted; that alone keeps
    # these files ~70% smaller, which is what makes tier 1 cheap enough to be
    # worth having a tier 2 at all.
    parent_of = {t["name"]: t["parent"] for t in data["topic_tree"]}

    def tag(p: dict) -> str:
        return f"{p['name']}{APPOINTMENT_MARK.get(p['appointment'], '')}"

    def group(key: str) -> dict:
        out = defaultdict(list)
        for p in data["people"]:
            for v in p[key]:
                out[v].append(p)
        return out

    preamble = [
        "Markers: `[nonres]` nonresident, `[visiting]` visiting, `[emeritus]` emeritus,",
        "`[affiliate]` affiliate; no marker means resident. Nonresident is the *majority*",
        "appointment on this roster, so read it as a logistics note, not a mark against anyone.",
        "",
        "**These files carry no recency information, deliberately.** Nothing on the source",
        "pages says when a person last published, and the available proxies are misleading.",
        "A name here is a candidate to verify, never evidence that someone is still active.",
        "",
        "Detail (full titles, outside posts, profile URL) lives in `roster/<program>.md`.",
        "Open only the files your shortlist actually needs.",
        "",
    ]

    def write_dimension(fname: str, title: str, blurb: list[str], groups: dict, annotate=None) -> None:
        lines = [f"# {title}", "", *blurb, "", *preamble]
        for key in sorted(groups):
            note = annotate(key) if annotate else None
            lines.append(f"## {key}" + (f"  _({note})_" if note else ""))
            lines.append("")
            lines.append("; ".join(tag(p) for p in sorted(groups[key], key=lambda x: x["name"])))
            lines.append("")
        (refs / fname).write_text("\n".join(lines))

    write_dimension(
        "by-topic.md", "Brookings experts by topic",
        [f"The {data['counts']['topics']} topics Brookings files experts under. Start here for most",
         f"questions. Built {data['built']}."],
        group("topics"),
        annotate=lambda k: parent_of.get(k) if parent_of.get(k) not in (None, 0) else None,
    )
    write_dimension(
        "by-region.md", "Brookings experts by region",
        ["Country and regional coverage. Open this whenever the question has a geographic",
         "dimension — many foreign-policy scholars carry regions but no topic tags, so the",
         f"topic file alone will miss them. Built {data['built']}."],
        group("regions"),
    )
    write_dimension(
        "by-center.md", "Brookings experts by center, project and initiative",
        ["Centers and initiatives are often a sharper signal of what someone actually works",
         "on than a broad topic tag. Useful when a question maps onto a standing body of work",
         f"rather than a subject area. Built {data['built']}."],
        group("centers"),
    )

    # Anyone the three dimensions all miss would be unfindable, so catch them.
    stranded = [p for p in data["people"] if not (p["topics"] or p["regions"] or p["centers"])]
    if stranded:
        lines = ["# Experts with no topic, region or center tags", "",
                 "Brookings files no routing facets for these people, so they appear in none of",
                 "the dimension files. Several are institutional leadership. Judge them from",
                 "their titles in the detail files.", ""]
        by_unit_stranded = defaultdict(list)
        for p in stranded:
            by_unit_stranded[home_unit(p)].append(p)
        for unit in sorted(by_unit_stranded):
            names = "; ".join(tag(p) for p in sorted(by_unit_stranded[unit], key=lambda x: x["name"]))
            lines += [f"**{unit}** — {names}", ""]
        (refs / "untagged.md").write_text("\n".join(lines))

    # Tier 2: per-program detail, read only for shortlisted candidates.
    index_rows = []
    for unit, members in sorted(by_unit.items(), key=lambda kv: -len(kv[1])):
        fname = f"{slugify(unit)}.md"
        index_rows.append((unit, fname, len(members)))
        out = [f"# {unit}", "", f"{len(members)} experts. Built {data['built']}.", ""]
        for p in sorted(members, key=lambda x: x["name"]):
            out.append(f"## {p['name']}")
            out.append("")
            for t in p["titles"]:
                out.append(f"- {t}")
            out.append(f"- Appointment: {p['appointment']}"
                       + (", named chair" if p["named_chair"] else "")
                       + f", seniority: {p['seniority']}")
            if p["centers"]:
                out.append(f"- Centers/initiatives: {', '.join(p['centers'])}")
            if p["topics"]:
                out.append(f"- Topics: {', '.join(p['topics'])}")
            if p["regions"]:
                out.append(f"- Regions: {', '.join(p['regions'])}")
            out.append(f"- Profile: {p['url']}")
            out.append("")
        (refs / "roster" / fname).write_text("\n".join(out))

    toc = ["# Roster detail files", "", f"Built {data['built']}.", "",
           "| Program / unit | File | Experts |", "|---|---|---|"]
    for unit, fname, n in index_rows:
        toc.append(f"| {unit} | `roster/{fname}` | {n} |")
    toc.append("")
    (refs / "roster" / "README.md").write_text("\n".join(toc))

    (refs / "README.md").write_text("\n".join([
        "# Reference layout", "",
        f"Built {data['built']} by `scripts/build_roster.py`.", "",
        "**Tier 1 — routing.** Sharded by dimension; open the ones your question has.", "",
        "| File | Open it when |", "|---|---|",
        "| `by-topic.md` | Almost always — the default entry point. |",
        "| `by-region.md` | The question has a country or regional dimension. Many foreign-policy scholars carry regions but no topic tags. |",
        "| `by-center.md` | The question maps onto a standing body of work rather than a subject area. |",
        "| `untagged.md` | Rarely — people Brookings files under no facets at all, including some institutional leadership. |",
        "",
        "**Tier 2 — detail.** `roster/<program>.md`, one file per program. Full titles,",
        "outside institutional posts, centers, topics, regions, profile URL. Open only the",
        "files your shortlist needs; see `roster/README.md` for the mapping.", "",
        "**Output shape.** `memo-template.md` holds the required memo structure and a",
        "worked example.", "",
    ]))

    if data.get("supplementary"):
        lines = [
            "# Expert-tagged people missing from the public directory", "",
            f"{len(data['supplementary'])} people carry Brookings' `expert` person-type but do not",
            f"appear in the /experts/ directory the other index files are built from. Built {data['built']}.", "",
            "**Read this list carefully -- it is the messy one.** It mixes two very different",
            "groups that the tag does not distinguish:", "",
            "- Current people the directory simply omits. The Vice President and Director of",
            "  Global Economy and Development is in here, so omission is clearly not a signal",
            "  of departure.",
            "- Scholars who have left, whose profiles kept the expert tag. Brookings demoted at",
            "  least one departed fellow to `guest-author` instead, so the tag is maintained",
            "  inconsistently and cannot be trusted either way.", "",
            "These records carry no topic, region or center facets, so they cannot be routed on",
            "subject. Use this file as a **recall backstop**: when a name surfaces in search and",
            "is missing from the dimension files, check here before assuming they are not at",
            "Brookings -- and verify the affiliation live either way.", "",
        ]
        for r in data["supplementary"]:
            lines.append(f"- {r['name']} — `{r['slug']}`")
        lines.append("")
        (refs / "supplementary.md").write_text("\n".join(lines))

    sizes = {f: (refs / f).stat().st_size / 1024
             for f in ("by-topic.md", "by-region.md", "by-center.md")}
    print(f"experts : {data['counts']['experts']}")
    print(f"topics  : {data['counts']['topics']}  regions: {data['counts']['regions']}")
    print(f"units   : {len(index_rows)}  stranded: {len(stranded)}  supplementary: {len(data.get('supplementary', []))}")
    print("tier 1  : " + ", ".join(f"{k} {v:.1f}KB" for k, v in sizes.items()))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    ap.add_argument("--fast", action="store_true",
                    help="skip the person-type scan (~270 requests); roster will miss "
                         "current people the /experts/ directory omits")
    args = ap.parse_args()
    write_outputs(build(deep=not args.fast), args.root)
    return 0


if __name__ == "__main__":
    sys.exit(main())
