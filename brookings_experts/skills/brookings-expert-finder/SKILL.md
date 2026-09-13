---
name: brookings-expert-finder
description: >-
  Recommends which Brookings Institution scholars to approach for comment,
  briefing, or a speaking slot on a given news story, policy development, or
  topic, and writes the recommendation as a ranked Markdown memo with verified
  citations. Use this whenever someone shares an article, headline, or issue and
  asks who at Brookings could weigh in, who to call, who the right expert is, or
  asks for a shortlist of scholars or commentators on a subject -- including when
  they only say "find me a Brookings expert on this" or paste a link and ask who
  to talk to. Also use when vetting a specific Brookings scholar's current
  activity and availability on a topic.
---

# Brookings expert finder

Turn a topic into a short, defensible list of Brookings scholars worth
approaching, with the evidence that justifies each one and an honest read on how
hard each will be to reach.

## What makes this hard

The naive version of this task -- match keywords, return famous names -- fails in
three specific ways, and most of this skill exists to prevent them.

**Fame is not fit.** The best-known scholar on a broad subject is frequently not
the one doing current work on the specific question. The person with last month's
byline is often a fellow nobody outside the field has heard of. Rank on evidence
of current engagement, not name recognition.

**A roster tag is not activity.** The bundled index says what Brookings files
someone under, which may reflect work from 2015. Brookings keeps profiles for
emeritus scholars and for nonresident fellows whose attention has drifted
elsewhere. Topic tags tell you where to look; they never tell you who is active.

**Invented citations destroy the deliverable.** This memo's whole value is that a
reader can click through and verify. A plausible-sounding article title that does
not exist is worse than an empty section, because it costs the reader their trust
in everything else on the page. Never write a publication you have not seen in
search results or fetched this session.

## Workflow

### 1. Read the input and name the ask

Extract the substantive question, not just the subject area. "Fed cuts rates
amid soft jobs data" is not a story about monetary policy in general -- it is
about the labor-market read on the Fed's reaction function, and that points at
different people than a story about the Fed's balance sheet.

Note the dimensions in play. Most stories have several: a piece on chip export
controls is simultaneously technology policy, China policy, and trade
enforcement. Experts clustered on only one dimension make for a weak memo.

Infer the **consult mode** from how the request is phrased, and say which one you
assumed in the memo so the reader can redirect you:

| Mode | Phrasing that signals it | What it rewards |
|---|---|---|
| Media comment | "quote", "react", "on background", a breaking story | Recent public writing, plain-language track record, responsiveness |
| Speaking / convening | "panel", "event", "speaker", "keynote" | Prominence and range; a marquee name has real draw |
| Decision briefing | "brief", "advise", "help me understand", "our team" | Synthesis, direct policy or government experience, breadth |

When the phrasing is genuinely ambiguous, default to media comment -- it is the
most common ask and the most demanding on recency, so a list built for it
degrades gracefully into the others.

### 2. Route through the bundled index

The routing layer is split by dimension, because Brookings tags many people on
only one. Open the files your question actually has:

| File | Open when |
|---|---|
| `references/by-topic.md` | Almost always. The default entry point, 115 topics. |
| `references/by-region.md` | The question has a country or regional angle. |
| `references/by-center.md` | The question maps onto a standing body of work. |
| `references/untagged.md` | Rarely; people filed under no facets, some leadership. |
| `references/supplementary.md` | A name surfaced in search but is missing from the files above. |

Opening `by-region.md` on anything geographic is not optional housekeeping. The
director of the John L. Thornton China Center carries regions and centers but
**no topic tags at all** -- a topic-only search on a China story misses him
entirely. Where Brookings tags someone unevenly, the dimension you skip is
exactly where the best candidate hides.

**The index is incomplete, and knowing how is part of using it.** It is built
from Brookings' public `/experts/` directory, which quietly omits people who are
plainly current -- the Vice President and Director of Global Economy and
Development is not in it, and neither is at least one nonresident senior fellow
whose profile page describes an active appointment. So:

- **Absence from the index is never evidence that someone has left.** If search
  surfaces a credible Brookings-affiliated name you cannot find in the dimension
  files, check `supplementary.md`, then verify their affiliation live. Do not
  drop them, and do not describe them as former.
- **Presence is not proof they are current either.** The index is a snapshot with
  a build date in its header.

Treat the bundled files as a recall aid with good coverage and honest edges,
not as the authority on who works at Brookings today. The authority is the
person's own profile plus what they have recently published.

Pull a **long list of 10-15 names** spanning the dimensions you identified. Being
generous here is nearly free -- the expensive step is verification, and you want
a real field to narrow from rather than the three names you thought of first.

Then read the detail files in `references/roster/` for those candidates only --
one or two program files usually covers a long list. See `roster/README.md` for
the mapping. Detail gives you full titles, outside institutional posts, centers,
regions, and profile URLs.

Outside posts matter more than they look. "Nonresident Senior Fellow - Foreign
Policy" alongside "Professor - Yale Law School" tells you both that the person is
credentialed and that Brookings is their side engagement.

### 3. Verify current activity -- the step that decides the ranking

For each shortlist candidate, search for their recent work. Their Brookings
profile page will not help: it is rendered client-side, so fetching it returns
navigation and no publications.

What works is ordinary web search scoped to the site:

```
site:brookings.edu "Full Name" <topic terms>
site:brookings.edu "Full Name" 2026
```

Widen beyond brookings.edu when the mode is media comment -- op-eds in the *Times*
or *Post*, congressional testimony, and podcast appearances all evidence
engagement and responsiveness, and often surface work their Brookings page misses.

Record, for every candidate, the **title, date, and URL** of their most recent
relevant output. Then sort them into recency bands:

| Band | Meaning | Effect on rank |
|---|---|---|
| **Active** | Relevant output in the last ~6 months | Strong claim on the top of the list |
| **Current** | Relevant output in the last ~18 months | Solid; rank on depth of fit |
| **Quiet** | Clear expertise, nothing relevant in ~2 years | Include only with a stated reason, flagged |
| **Dormant** | No visible Brookings output in 2+ years | Exclude unless uniquely qualified; say so plainly |

A candidate you cannot verify at all is not automatically dormant -- you may
simply have searched badly. Try one more query with different terms before
concluding anything, and if you still find nothing, say "no recent work found"
rather than asserting inactivity. Those are different claims.

### 4. Read positionality as logistics, never as merit

Seniority and appointment type change *how you approach someone* and *how long it
takes*. They do not change whether the person is right. A memo that quietly drops
the ideal expert because they seem hard to book has failed at its job; the reader
wanted to know who is best and what it will take.

State the access reality and let the reader decide:

- **Institutional leadership** (president, VP, program director) -- highest
  authority, hardest calendar. Usually routed through a comms or scheduling team.
  Worth naming when the story warrants that level.
- **Named chairs and marquee senior fellows** -- in heavy demand, especially on a
  breaking story where every outlet is calling the same three people.
- **Nonresident fellows** -- the majority of this roster, so treat it as a
  logistics note and nothing more. Their day job is elsewhere, which can mean
  slower replies, an outside press office, and occasionally a conflict on
  commercially sensitive topics.
- **Emeritus scholars** -- frequently the *most* available and glad to talk, with
  deep historical perspective. Check currency carefully; their framing may
  predate the current state of the debate.
- **Fellows and mid-career scholars** -- typically the fastest to respond and
  often the ones actually running the current research. On a tight deadline these
  are frequently the best call, and a memo that only lists famous names is doing
  the reader a disservice.

Also flag genuine conflicts where visible: a scholar who advised a government
currently party to the dispute, or holds a role at an organization with a
position on it, is still recommendable but the reader needs to know.

### 5. Rank and write

Order by, in this priority:

1. **Evidence of current work on this specific question** -- verified, dated, cited.
2. **Depth of fit** -- is this their central subject or an adjacent interest?
3. **Suitability for the consult mode** you inferred.
4. **Access difficulty** -- a tiebreaker only, and only between near-equals.

Aim for **3-5 ranked recommendations**. Fewer is fine when the field is thin --
say so rather than padding with weak matches. Deliberately vary the profile
across the list: a memo of five senior fellows from one program is usually a
routing failure, not a real finding about who is qualified.

Then write the memo using `references/memo-template.md`, which has the required
structure and a worked example.

## Evidence discipline

Everything in the memo has to survive a reader clicking the links.

- Every publication claim carries a **real URL and a real date** you saw this
  session. No URL means no claim.
- Never infer a publication from a topic tag, or reconstruct a title from memory.
  If you believe someone writes on this often but you found nothing specific,
  write exactly that.
- Distinguish "I found no recent work" from "this person is inactive." You have
  evidence for the first and only an inference for the second.
- Training and pedigree claims (degrees, prior government roles) come from their
  Brookings titles or a verifiable source, not from recall. Getting someone's
  former job title wrong is the kind of error that ends the reader's trust.
- **Search summaries misattribute authorship.** A run of this skill was handed a
  2024 IMF paper credited to a Brookings scholar who had nothing to do with it;
  fetching the page showed six entirely different authors. Before you attach a
  publication to a person as evidence, confirm their name is on it -- open the
  page when the byline is doing real work in your ranking.
- When a source is genuinely unreachable, say so and cite what you could confirm
  instead of quietly dropping the claim or presenting it as fully verified.
- Note the roster's build date when currency matters. Someone who joined last
  month will not be in the bundled index at all -- which is a reason to search,
  not a reason to assume the index is complete.

## Refreshing the roster

The index is a snapshot, and its build date is in its header. To rebuild:

```bash
python3 scripts/build_roster.py
```

Two public page fetches, no credentials. It rewrites `references/expert-index.md`
and everything under `references/roster/`. Run it if the index looks stale or a
name you expect is missing.
