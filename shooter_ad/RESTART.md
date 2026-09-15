# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo.
The redesign is essentially complete: 20 of 23 roadmap items are done and pushed
to `claude/laughing-feynman-ghh9r3`. `main` is untouched and no PR is open.

Your job is the last three items, in the order below. **Item 1 gates the other
two and gates every balance decision anyone makes after you** — do not reorder.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, plus a section on subagents
   sharing one working tree that cost a mislabelled commit to learn.
2. `shooter_ad/CLAUDE.md` — how the code works. Read **"Measurement is the hard
   part here"** twice. It contains a worked example of a confident, wrong
   balance conclusion made *while quoting that very warning*, and the cheap
   check that caught it.
3. `shooter_ad/notes.md` — **the design intent**, and the most important
   document here. If it and `CLAUDE.md` disagree, `notes.md` wins and
   `CLAUDE.md` is stale — say so rather than quietly following the code.
4. `git log --oneline -25` — commit messages carry the reasoning, including one
   explicit retraction.

Then:

```bash
cd shooter_ad && npm ci && npm run build && npm run verify && npm run model
```

Look at `.verify/screenshot.png`. Do not start until you have seen it render.

## 2. What the game is

**DPS golf.** Every few seconds you are shown three bonuses and must judge,
before they arrive, which most increases your damage output. Two rules follow:

- A bonus that does not change damage output is noise.
- A bonus whose value is *obvious* is not a decision.

The central mechanic, settled and built: a stat is `base × (1 + pool) × mult`.
`+10% DMG` adds to the pool; `×1.1 DMG` multiplies the base, which the pool then
amplifies. A raw draw is **scaled to your current pool** — `a = (root − 1) ×
(1 + pool)` — so at a +210% pool a root of 1.1 presents as `+31% DMG` and is
worth exactly ×1.10. Neither form is ever dominant; whichever drew the higher
root wins; **the player's skill is doing the conversion**, which is why the pool
is on screen in the HUD and taught on the pause screen.

## 3. The instruments, and why each exists

| command | what it does |
| --- | --- |
| `npm run verify` | build first. Plays headlessly, clicks the real START MATCH button, fails on console errors, blank frames, zero kills, stalled waves |
| `npm run balance` | time series across fixed seeds; `PROBE_SKILL` sets pick quality |
| `npm run model` | validates the design's load-bearing claims by importing the game's own `Progression.ts` — no reimplementation |
| `npm run endscreen` | photographs every screen that is not the playfield, and asserts behaviour |
| `npm run hud` | HUD at early/mid/late upgrade states `verify` never reaches |
| `npm run behaviour` | per-enemy movement signatures, shield taper, enemy fire |
| `npm run matchcode` | round-trips share codes including 32-bit boundaries |

Every one of these was written because something shipped broken that the
existing checks called green. Treat a new user-facing screen with no instrument
as a bug waiting to happen.

## 4. Ground rules

- **A typecheck is not verification, and neither is a green exit code.** Three
  bugs this branch were found by *looking at an image* that every automated
  signal called a pass: a translucent end panel, a start screen covering the
  game, and a start screen that never appeared. Look at the screenshots.
- **Measure in simulated seconds, never wall-clock.** `stats.elapsed`. The sim
  advances on clamped frame deltas, so wall-clock time moves with render load —
  that is what produced the retracted result.
- **Run one seed three times before believing any difference.** Differences
  under ~5% are noise at present.
- **`Progression.ts` is the single definition of squad strength; `Scoring.ts`
  prices every offer exactly once.** Par, the decision log, the halo flash and
  the probe bot all read the same function. Two copies drift silently and the
  death screen starts lying to players about their own mistakes.
- **Determinism is a product feature** — seeds are shareable. No stray
  `Math.random()`.
- Commit subjects prefixed `shooter_ad:`. Stage **explicit paths**, never
  `git add -A` — subagents share this working tree unless given
  `isolation: "worktree"`.
- **There is no CI on pull requests**, by the user's choice. The Pages deploy
  runs only after merge to `main`. Your local `verify` is the real gate.

## 5. Do these three, in this order

### 1. Fixed simulation timestep — do this first, alone

The simulation advances on clamped real frame deltas. Consequences, both
measured:

- The same seed does not reproduce a run. Three repeats of one seed gave 40.2s,
  41.1s, 40.2s — about 2% jitter, from collision resolution resolving
  differently. Content is identical every time; only timing wobbles.
- Wall-clock and simulated time diverge by roughly 2× and the ratio **moves with
  render load**. Adding screens to the game changed measured survival by 36% and
  produced a confident, entirely false balance conclusion.

Accumulate real time and step the simulation at a fixed interval (1/60s), with a
cap on steps per frame so a slow frame cannot spiral. Keep rendering
interpolated or snapped — whichever looks right; that is a judgement call worth
screenshotting.

This is a **prerequisite for items 2 and 3 and for the mercy clamp**. Until it
lands, `npm run balance` cannot settle any difficulty question, and seeds are
only half shareable — same offers, different outcome.

**Verify it worked**: run one seed three times and show the spread collapsing
from ~2% to ~0%. That is the acceptance test.

### 2. Hard mode

Mostly plumbing; everything it needs exists. Gate speed already scales with
wave (`GATES.speedPerWave`), legibility tiers already escalate
(`data/roots.ts`), and the match code **already carries a mode flag with `H`
reserved** — `MatchCode.ts` encodes and decodes it and `npm run matchcode`
round-trips it.

Start gate approach speed and bonus legibility at later-wave values. Do **not**
make it "more enemy HP" — it must test the same skill harder, not a different
one. Optionally raise `DIFFICULTY.targetFraction`.

Thread the mode through so a hard run's match code differs visibly from a normal
one, and the start screen says which one you are about to play.

### 3. Soften the mercy clamp — only after item 1

`DIFFICULTY.maxOverPlayer` (1.35) caps enemy pressure at a multiple of what the
player can actually kill. `notes.md` wants it softened substantially: losing
control should be legible, not prevented.

**Do not touch it until the timestep lands.** Every reading that ever pointed at
this constant came from an instrument timing the browser. The corrected sweep
shows the two-regime design behaving as intended — weak play at standing 0.49,
just under the 0.52 threshold, competent play above it — so there is no current
evidence it is broken.

Removing it entirely reproduces a death spiral around wave 7. Move it in steps
and re-probe between each. This is the constant most likely to make the game
miserable if overcorrected.

## 6. Measured, current, and honest

Swept across seeds 1–5 on the corrected clock, in simulated seconds:

| PROBE_SKILL | survival | optimal | standing |
| --- | --- | --- | --- |
| 0.3 | 98.5s | 24% | 0.49 |
| 0.5 | 95.4s | 51% | 0.58 |
| 0.7 | 75.0s | 85% | 0.81 |
| 0.9 | 82.8s | 88% | 0.67 |
| 1.0 | 82.7s | 88% | 0.76 |

- **`standing` rises with skill, 0.49 → ~0.8.** The difficulty curve is
  genuinely skill-responsive. This is the question `PROBE_SKILL` existed to
  answer and it now has an answer.
- **`optimal` responds cleanly to 0.7 then saturates.** It cannot separate good
  from excellent. It compounds over *decisions*, so a short run has little room
  to fall behind — a short excellent run and a long excellent run are not
  comparable on it.
- **Survival does not track skill.** Not monotonic, and within-level spreads run
  39s to 155s. Five seeds cannot support a trend either way. **Do not read a
  slope into it.**
- **Choosing is not getting.** At skill 1.0 the bot reaches for the best option
  every time and still lands 88% — the gap is gates it chose and could not
  reach. The game charges for travel; the scoring only partly sees it.

## 7. Known gaps — name these as unverified if you report on them

- **Nothing is verified at true phone scale.** Every screen was judged on
  540×960 PNGs, not a real panel under `Scale.FIT`.
- **The halo flash has never been observed in motion.** Stills only; whether it
  reads as feedback or as a flicker is unknown.
- **A balance A/B against the new gate speeds and the slower squad
  (`SQUAD.moveSpeed` 620 → 260) never completed.** Run it early — that change
  is large and its effect is unmeasured.
- **Movement bonuses are the right pick 1.5% of the time**, from offers
  containing one 37.3% of the time. The degenerate "always worth zero" case is
  fixed; whether 1.5% is the intended rate is an open design question.
- **The probe bot cannot dodge.** No threat avoidance, no positioning. A floor
  on difficulty, never a verdict on feel.
- **Nobody has played this game.** That is the single highest-value thing that
  could happen to it and no instrument here substitutes.

## 8. Settled — do not relitigate

- Raw draws scale to the pool. Both forms stay competitive; the conversion is
  the skill. `npm run model` has guards that fail if this regresses.
- Bonus readout sits beneath the red line; par is always on the top rail.
- Match codes, not raw seed URLs — people share by screenshot and a screenshot
  loses the clipboard. The code is the source of truth; the URL derives from it.
- A shared link lands on a start screen and waits. It does not auto-start.
- Pierce uses a fixed `q`, not live density.
- Scoring prices access; `Difficulty` budgets raw DPS. Keep them apart.
- No PR CI.

## 9. One open design question for the user

**The end screen's headline is `WAVES SURVIVED`**, and survival does not track
skill. `% of optimal` does — but it saturates. Neither is clearly right. Raise
it with the user before changing it; it is a question about what the game is
*for*, not a tuning knob.

## 10. How to report

After each item: what landed, what the instruments say (with seeds), what you
could not verify, and what you would do next. **Name unverified claims as
unverified.** This project has now been fooled by its own instruments four
times, and the fourth was the most confident of them. The game code has held up
considerably better than the things measuring it.
