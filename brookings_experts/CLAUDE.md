# brookings_experts

A demonstration skill for a workshop on progressive disclosure. Given a news
article or topic, it recommends a ranked shortlist of Brookings Institution
scholars worth approaching, as a Markdown memo with verified citations.

Not a game — no `package.json`, no build, no Phaser. Python 3 standard library
only; nothing to install.

## Layout

```
brookings_experts/
  scripts/build_roster.py    # regenerates the bundled roster from two page fetches
  data/roster.json           # full structured roster (build output, committed)
  skills/brookings-expert-finder/
    SKILL.md                 # workflow, ranking rubric, evidence discipline
    references/
      by-topic.md            # tier 1 routing: 115 topics (~43KB)
      by-region.md           # tier 1 routing: 71 regions (~9KB)
      by-center.md           # tier 1 routing: centers/initiatives (~12KB)
      untagged.md            # tier 1 catch-all: people with no facets
      roster/<program>.md    # tier 2: detail, opened only for shortlisted names
      memo-template.md       # output structure + worked example
  evals/                     # test prompts for the skill-creator loop
```

## Rebuilding the roster

```bash
python3 scripts/build_roster.py
```

Two public page fetches, no credentials, ~10 seconds. Commit the diff.

## What the data path actually is

Worth writing down, because most of the obvious routes are dead ends and
rediscovering that costs an afternoon.

**What works.** Brookings runs WordPress. `/research-commentary/` carries an
inline `brookingsAlgolia` config object holding the full expert list (name,
profile URL, titles) plus the program, topic and region taxonomies.
`/experts/` carries one card per expert with the facet IDs Brookings files them
under. They join on the profile slug. That is the entire roster in two fetches.

**What does not work, and why:**

- `/wp-json/wp/v2/article?expert=<id>` **looks like it filters and does not.**
  WordPress ignores the unknown parameter and returns the latest articles
  regardless. It returns byte-identical results for any expert ID and for a
  nonsense parameter. Always diff against an unfiltered control before believing
  a filter endpoint — this one reads as working on casual inspection.
- Expert profile pages and article listings are hydrated client-side. Fetching
  `/people/<slug>/` returns navigation chrome and no publications.
- Article filtering runs through the site's Algolia backend on `algolia.net`,
  which is a separate domain and generally not reachable from sandboxed sessions.
  Do not build on it regardless: it is an undocumented internal search index with
  rotatable keys.
- The `person` post type holds **27,350** records, but only ~382 are actual
  Brookings experts. The rest are guest authors. The curated set is the config
  blob; the REST endpoint's `person-type-expert` vs `person-type-guest-author`
  taxonomy says the same thing one record at a time.

**Consequence for the skill:** recency cannot be bundled. Nothing on these pages
says when a person last published, and the tempting proxies are wrong — a person
record's `modified` date moves when someone swaps a headshot. So the roster is
deliberately recency-free and the skill resolves current activity live via web
search. That is also the better design, since a bundled publication list starts
decaying the day it is built.

## Network access

`brookings.edu` and `www.brookings.edu` are **separate entries** in an egress
allowlist, and the site 308-redirects every path to `www`. Allowlisting only the
apex domain looks correct and serves nothing. If fetches fail with a proxy 403,
check that first.

## Verifying a change

There is no headless browser check here; the analogue is:

```bash
python3 scripts/build_roster.py   # expect ~381 experts, 115 topics, 71 regions
grep -A2 '^## China$' skills/brookings-expert-finder/references/by-region.md
```

A build reporting a sharply different expert count means Brookings changed their
page structure — read the output before trusting it. Two things worth watching:

- **Tier 1 sizes** belong around 43/9/12KB. A jump toward 120KB means the name
  packing regressed and tier 1 stopped being cheap to load.
- **The China spot-check** must list Ryan Hass. He carries regions and centers but
  no topic tags, so he is the canary for the sharded routing — if a refactor
  collapses the dimension files back into one topic index, he silently vanishes
  from every China query.
