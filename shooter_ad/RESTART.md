# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo.
The redesign roadmap is **complete**: all 23 items are done and pushed to
`claude/laughing-feynman-ghh9r3`. `main` is untouched and no PR is open.

There is no forced next task. What the project needs most is not on the
roadmap — see §6.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, plus a section on subagents
   sharing one working tree that cost a mislabelled commit to learn.
2. `shooter_ad/CLAUDE.md` — how the code works. Read **"Measurement is the hard
   part here"** twice, and then read **"Legibility must stay difficulty-neutral,
   and once did not"**. Between them they contain five separate occasions on
   which this project was misled by its own instruments, including two in the
   most recent session, one of which was a *fix* that was measured and found
   insufficient.
3. `shooter_ad/notes.md` — **the design intent**, and the most important
   document here. If it and `CLAUDE.md` disagree, `notes.md` wins and
   `CLAUDE.md` is stale — say so rather than quietly following the code.
4. `git log --oneline -30` — commit messages carry the reasoning, including two
   explicit retractions and one withdrawal.

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
| `npm run repeat` | plays ONE seed several times and fails if the runs disagree at all. The determinism gate |
| `npm run balance` | time series across fixed seeds; `PROBE_SKILL`, `PROBE_MODE` |
| `npm run sweep` | every seed at every skill level; the table in `CLAUDE.md` |
| `npm run mercy` | sweeps `DIFFICULTY.maxOverPlayer` at low skill, by injection rather than rebuild |
| `npm run model` | validates the design's load-bearing claims by importing the game's own `Progression.ts` — no reimplementation |
| `npm run endscreen` | photographs every screen that is not the playfield, and asserts behaviour |
| `npm run hud` | HUD at early/mid/late upgrade states `verify` never reaches |
| `npm run behaviour` | per-enemy movement signatures, shield taper, enemy fire |
| `npm run matchcode` | round-trips share codes including 32-bit boundaries |

Every one of these was written because something shipped broken that the
existing checks called green. Treat a new user-facing screen, or a new state of
an existing one, as a bug waiting to happen until an instrument presses it.

## 4. Ground rules

- **A typecheck is not verification, and neither is a green exit code.** Three
  bugs on this branch were found by *looking at an image* that every automated
  signal called a pass.
- **The simulation runs on a fixed 1/60s step** (`SIM` in `config.ts`). Nothing
  gameplay-affecting may read a real frame delta. `npm run repeat` is what keeps
  this true, and a nonzero spread from it is a regression.
- **Measure in simulated seconds, never wall-clock.** `stats.elapsed`.
- **A median containing a truncated run is a floor.** The sweeps mark those with
  a `+` and print a `died` column. Say "floor" rather than "survival" when
  quoting one.
- **`Progression.ts` is the single definition of squad strength; `Scoring.ts`
  prices every offer exactly once; `Mode.ts` holds the run's difficulty.** Par,
  the decision log, the halo flash and the probe bot all read the same
  functions. Two copies drift silently and the death screen starts lying to
  players about their own mistakes.
- **Determinism is a product feature** — seeds are shareable. No stray
  `Math.random()`.
- Commit subjects prefixed `shooter_ad:`. Stage **explicit paths**, never
  `git add -A` — subagents share this working tree unless given
  `isolation: "worktree"`.
- **There is no CI on pull requests**, by the user's choice. The Pages deploy
  runs only after merge to `main`. Your local `verify` is the real gate.

## 5. Measured, current, and honest

Swept with `npm run sweep`, seeds 1–5, normal mode, simulated seconds. 6 of the
25 runs hit the 150s budget rather than dying, so several medians are floors:

| PROBE_SKILL | survival | optimal | standing | died |
| --- | --- | --- | --- | --- |
| 0.3 | 116.6s | 26% | 0.38 | 4/5 |
| 0.5 | 106.5s | 54% | 0.69 | 5/5 |
| 0.7 | 105.9s | 53% | 0.66 | 4/5 |
| 0.9 | 129.3s | 89% | 0.64 | 3/5 |
| 1.0 | 122.3s | 100% | 0.64 | 3/5 |

- **`optimal` separates weak play from strong and is muddled in the middle.**
  0.5 and 0.7 come out level within the noise of five seeds. It compounds over
  *decisions*, so a short run has little room to fall behind.
- **Survival does not track skill.** Not monotonic, spreads of 40s to 150s, and
  six floors. **Do not read a slope into it.**
- **`standing` no longer splits into two regimes**, because the mercy clamp's
  threshold moved from 0.52 to 0.28 and nothing's median reaches it. Every row
  above is par-driven.
- **Choosing is not getting.** The bot reaches for the best option and does not
  always land it; the gap is gates it chose and could not reach.

## 6. What this project actually needs next

**Nobody has played this game.** That has been the highest-value open item for
several sessions and no instrument here substitutes for it. Everything below is
smaller than it.

The most concrete reason it matters now: **the probe cannot evaluate hard
mode.** Hard mode's entire content is less time to read three labels and do a
conversion, and the bot is handed scored options and decides in zero simulated
seconds. It pays only the travel cost — it travels ~25% further per minute under
hard mode — and every sweep therefore reports hard mode as *easier* than normal.
Two real bugs were found chasing that (see `CLAUDE.md`), but the residue is
structural: this instrument cannot answer the question. A human can, in ten
minutes.

Same shape, smaller: the mercy clamp was softened to 2.5 on the evidence that
weak runs died at 1.35 anyway. Whether losing control now reads as *legible* —
the actual design goal — is not something the probe can report.

## 7. Known gaps — name these as unverified if you report on them

- **Nothing is verified at true phone scale.** Every screen was judged on
  540×960 PNGs, not a real panel under `Scale.FIT`.
- **The halo flash has never been observed in motion.** Stills only.
- **The `SQUAD.moveSpeed` 620 → 260 change was never A/B'd** against the new
  gate speeds. It is large and its effect is unmeasured.
- **Movement bonuses are the right pick ~1.5% of the time**, from offers
  containing one 37.3% of the time. The degenerate "always worth zero" case is
  fixed; whether 1.5% is the intended rate is an open design question.
- **The probe bot cannot dodge**, has no positioning, and has no reading time.
  A floor on difficulty, never a verdict on feel.
- **The withdrawn death spiral.** `CLAUDE.md` used to claim removing the mercy
  clamp reproduces a spiral around wave 7. It did not reproduce on the current
  clock. It is withdrawn, not disproven — if you need it, re-demonstrate it.

## 8. Settled — do not relitigate

- Raw draws scale to the pool. Both forms stay competitive; the conversion is
  the skill. `npm run model` has guards that fail if this regresses.
- Legibility tiers must match on **both** the arithmetic and the geometric mean
  of their root tables. Bonuses multiply, so an average is the wrong summary;
  matching only the average left 7.5% of power per run hiding in the legibility
  axis. `npm run model` checks both.
- Hard mode is a wave offset on the judgment axes and carries exactly one knob,
  so it cannot reach the enemy budget. `targetFraction` was considered and
  declined.
- Bonus readout sits beneath the red line; par is always on the top rail.
- Match codes, not raw seed URLs — people share by screenshot and a screenshot
  loses the clipboard. The code is the source of truth; the URL derives from it.
- A shared link lands on a start screen and waits. It does not auto-start.
- Pierce uses a fixed `q`, not live density.
- Scoring prices access; `Difficulty` budgets raw DPS. Keep them apart.
- No PR CI.

## 9. One open design question for the user

**The end screen's headline is `WAVES SURVIVED`**, and survival does not track
skill — six of twenty-five runs did not even end on their own. `% of optimal`
does track skill, but saturates and is not comparable between a short run and a
long one. Neither is clearly right. Raise it with the user before changing it;
it is a question about what the game is *for*, not a tuning knob.

## 10. How to report

What landed, what the instruments say (with seeds), what you could not verify,
and what you would do next. **Name unverified claims as unverified**, and name a
truncated median a floor. This project has now been fooled by its own
instruments five times; the most recent was a fix that was measured, found
insufficient, and fixed again. The game code has held up considerably better
than the things measuring it.
