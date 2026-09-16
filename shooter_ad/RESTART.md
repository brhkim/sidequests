# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo.
The redesign roadmap is complete and a first pass of playtest fixes has landed,
all pushed to `claude/laughing-feynman-ghh9r3`. `main` is untouched and no PR is
open.

**The user has now actually played this game.** That matters more than anything
else in this file: one session of real play produced seven findings, several of
which no instrument here had caught in weeks of work. Two of those findings are
your job.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, plus a section on subagents
   sharing one working tree.
2. `shooter_ad/CLAUDE.md` — how the code works. Read **"Measurement is the hard
   part here"** twice, then **"Legibility must stay difficulty-neutral, and once
   did not"**. Between them they record five separate occasions on which this
   project was misled by its own instruments — including one where a *fix* was
   measured and found insufficient.
3. `shooter_ad/notes.md` — **the design intent**, and the most important
   document here. If it and `CLAUDE.md` disagree, `notes.md` wins and
   `CLAUDE.md` is stale — say so rather than quietly following the code.
4. `git log --oneline -20` — commit messages carry the reasoning, including two
   explicit retractions and one withdrawal.

Then:

```bash
cd shooter_ad && npm ci && npm run build && npm run verify && npm run model
```

Look at `.verify/screenshot.png`. Do not start until you have seen it render.

## 2. What the game is

**DPS golf.** Every few seconds you are shown three bonuses and must judge,
before they arrive, which most increases your damage output.

A stat is `base × (1 + pool) × mult`. `+10% DMG` adds to the pool; `×1.1 DMG`
multiplies the base, which the pool then amplifies. A raw draw is **scaled to
your current pool** — `a = (root − 1) × (1 + pool)` — so at a +210% pool a root
of 1.1 presents as `+31% DMG` and is worth exactly ×1.10. Neither form is ever
dominant; the player's skill is doing the conversion.

## 3. Your two tasks

### A. Cap the visible bullets and tier their colour by density

**The finding, in the user's words:** at high GUNS and RATE the stream becomes a
solid mass and it is visually hard to follow what is going on. The proposal is
to cap how many bullets are drawn and let one drawn bullet *stand for several*,
upgrading its colour the way unit shirts tier with power-per-unit — so a single
bright bullet reads as heavy fire.

**The hard constraint, and the whole risk of this task: the simulation must keep
firing and colliding at the true rate.** This is a rendering change only. If the
number of bullets actually spawned changes, this stops being a legibility fix
and silently becomes a balance change — and every measured number on this branch
becomes stale. `npm run repeat` will not catch that; it would happily report a
deterministic, differently-balanced game.

Shape of the work:

- Collapse true shots-per-second into a maximum *visible* rate. The ratio
  between the two is what drives the tint, so one drawn bullet represents
  `true / visible` real bullets.
- Tier the colour the way `data/tiers.ts` tiers shirts — that ladder is the
  existing vocabulary for "this thing represents more than it looks like", and
  reusing it means the player learns the idea once.
- GUNS and RATE both feed the true rate and both must feed the collapse.
- The volley is now a **parallel cylinder** (`WEAPON.volleyWidth`), not a cone.
  Extra guns widen a parallel column sized to a Titan's diameter. Whatever you
  draw has to stay legible as a column.

**How to verify it did not change balance:** run `npm run sweep` before and
after and show the numbers are unchanged within noise. If they move, you changed
the simulation. Also add a state to `npm run hud` — it already forces early /
mid / late upgrade states, and late is where this problem lives; `verify` only
ever photographs an empty build and will never show you the failure mode.

### B. Scale ordinary enemies harder against par DPS

**The finding:** non-boss enemies should scale at least somewhat more with the
player's DPS, or with par DPS.

The machinery already exists — `systems/Difficulty.ts` budgets enemy HP against
par:

```
budget/sec = squadDps(par) * targetFraction * pressure
hpMult     = budget/sec / (spawnRate * avgPoolHp)
```

So this is a tuning question about `DIFFICULTY.targetFraction`,
`DIFFICULTY.pressure`, or how the budget splits between toughness and wave
thickness. **Do not invent a new mechanism before trying the knobs that exist.**

Four things that will bite you:

- **Most sweep medians are FLOORS.** Runs that hit the 150s budget rather than
  dying are marked `+`, and any median containing one is a floor. Read the
  `died` column. Say "floor" rather than "survival" when quoting one.
- **Differences under ~5% are noise.** Run `npm run repeat` first to confirm the
  instrument is still exact, then `npm run sweep` before and after.
- **The mercy clamp threshold is now 0.28**, not 0.52. At current constants no
  skill level's median standing reaches it, so every sweep row is par-driven.
  Raising `targetFraction` moves that threshold and would confound the reading —
  see the clamp section in `CLAUDE.md`, which has a measured table.
- **Hard mode cannot be evaluated by the probe at all.** Its entire content is
  less time to read three labels, and the bot decides in zero simulated seconds.
  Every sweep reports hard mode as easier. Check it does not crash or spiral;
  claim nothing else about it.

Do not touch the Titan while doing this. Its HP is now derived from the deadline
it creates, not from this budget — see below.

## 4. Ground rules

- **A typecheck is not verification, and neither is a green exit code.** Four
  bugs on this branch were found by looking at an image or running the game that
  every automated signal called a pass. The most recent: removing a HUD column
  left its `update` writing five columns into four, which typechecked cleanly
  and crashed on load.
- **The simulation runs on a fixed 1/60s step** (`SIM` in `config.ts`). Nothing
  gameplay-affecting may read a real frame delta. `npm run repeat` keeps this
  honest and a nonzero spread from it is a regression.
- **Measure in simulated seconds, never wall-clock** (`stats.elapsed`).
- **`Progression.ts` is the single definition of squad strength; `Scoring.ts`
  prices every offer exactly once; `Mode.ts` holds the run's difficulty.** Par,
  the decision log, the halo flash and the probe bot all read the same
  functions. A second copy drifts silently and the death screen starts lying to
  players about their own mistakes.
- Commit subjects prefixed `shooter_ad:`. Stage **explicit paths**, never
  `git add -A` — subagents share this working tree unless given
  `isolation: "worktree"`.
- **No CI on pull requests**, by the user's choice. Pages deploys only after
  merge to `main`. Your local `verify` is the real gate.

## 5. What changed most recently, so you do not re-derive it

The playtest pass that just landed (`93ffb41`):

- **Gate lanes tile the full width.** The old `GATES.gap` was real dead space in
  the hit test — a player could slide between blocks and take nothing. The
  separation is now an inset on the drawn rectangle only.
- **The volley is a parallel cylinder, not a cone.** Extra guns used to fan
  bullets angularly, so more guns *scattered* damage at range.
- **An arriving Titan ends the run**, and the end screen names that death
  differently from attrition.
- **Titan HP is derived from its deadline**: `bossKillPar` (0.9) of par over the
  time to cover `bossKillDistance` (0.75) of the descent.
- **That budget uses `singleTargetDps`, not `squadDps`.** Pierce is worth
  ×1.5 / ×1.75 / ×1.875 at pierce 1/2/3 because a bullet may meet another body
  after a hit — against one Titan there is no other body, so pierce is worth
  nothing. Sizing the boss off `squadDps` would have given a pierce-3 build a
  boss nearly twice as tough as intended, for damage it cannot deliver.
- **SQUAD left the top rail** (it competed with ARMY), and **`startPower` is now
  1** rather than 6.

**Seeds are not comparable across that commit.** Gameplay moved.

## 6. Known gaps — name these as unverified if you report on them

- **Nothing is verified at true phone scale.** Every screen was judged on
  540×960 PNGs, not a real panel under `Scale.FIT`.
- **The halo flash has never been observed in motion.** Stills only.
- **`npm run endscreen` was still running at handoff** and is unconfirmed
  against the playtest changes. Run it early — the end screen gained a new
  title state (`THE TITAN LANDED`) that nothing has photographed yet.
- **The Titan-as-loss path has never been seen.** The probe rarely reaches a
  boss wave, so no automated check has watched a Titan land or confirmed the HP
  budget is achievable in practice. Consider forcing it, the way
  `npm run behaviour` spawns cohorts directly.
- **`SQUAD.moveSpeed` 620 → 260 was never A/B'd** against the new gate speeds.
- **The probe bot cannot dodge.** No threat avoidance, no positioning.

## 7. Settled — do not relitigate

- Raw draws scale to the pool; `npm run model` has guards that fail if this
  regresses, on both the arithmetic and geometric means.
- Scoring prices access; `Difficulty` budgets raw DPS. `×MOVE` and `+TIME` must
  never contribute to par DPS, and do not.
- Match codes, not raw seed URLs. A shared link lands on a start screen and
  waits rather than auto-starting.
- Pierce uses a fixed `q`, not live density.
- Hard mode is a wave offset on the judgment axes only — never enemy pressure.

## 8. How to report

What landed, what the instruments say (with seeds), what you could not verify,
and what you would do next. **Name unverified claims as unverified.** This
project has been fooled by its own instruments five times now, and the most
confident of those was the one where the warning was being quoted while the
mistake was made.
