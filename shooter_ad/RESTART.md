# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo.
The redesign roadmap is complete and both open playtest findings have landed, all
pushed to `claude/laughing-feynman-ghh9r3`. `main` is untouched and no PR is open.

**There is exactly one thing here that is blocked on the author rather than on
work.** It is in section 3. Everything else is follow-through.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, plus a section on subagents
   sharing one working tree.
2. `shooter_ad/CLAUDE.md` — how the code works. Read **"Measurement is the hard
   part here"** twice. It now records six occasions on which this project was
   misled by its own instruments, and the newest one is the most useful: a check
   written specifically to catch a rendering change masquerading as a balance
   change was itself fooled by its own sampler on its first run.
3. `shooter_ad/notes.md` — **the design intent**, and the most important document
   here. If it and `CLAUDE.md` disagree, `notes.md` wins and `CLAUDE.md` is stale
   — say so rather than quietly following the code.
4. `git log --oneline -20` — commit messages carry the reasoning, including two
   explicit retractions and one withdrawal.

Then:

```bash
cd shooter_ad && npm ci && npm run build && npm run verify && npm run model
npm run hud     # look at hud-late.png; it used to be six solid cream bars
```

Do not start until you have seen `.verify/screenshot.png` render.

## 2. What the game is

**DPS golf.** Every few seconds you are shown three bonuses and must judge,
before they arrive, which most increases your damage output.

A stat is `base × (1 + pool) × mult`. `+10% DMG` adds to the pool; `×1.1 DMG`
multiplies the base, which the pool then amplifies. A raw draw is **scaled to
your current pool** — `a = (root − 1) × (1 + pool)` — so at a +210% pool a root
of 1.1 presents as `+31% DMG` and is worth exactly ×1.10. Neither form is ever
dominant; the player's skill is doing the conversion.

## 3. The one open decision: do RATE and GUNS stay dead late?

This is a design call, not a bug, and it is the only thing here you should not
simply decide for yourself.

`WEAPON.maxBullets` caps how many bullets can be alive, and `Bullets.spawn`
gives up rather than overwrite a live one. So real throughput is the pool's
recycle rate — about **988 shots/s** analytically, ~1200 measured. `squadDps` is
analytic and knew nothing about this. Measured with `npm run hud` at the late
upgrade state: the build wants 16,943 shots/s, fires 1,154, and delivers **7% of
the damage the HUD was claiming for it.**

That is now modelled (`Progression.deliverableDps`), and the budget, `standing`,
the HUD and `Scoring` all read it. The consequence is real and unwelcome: **past
the ceiling, RATE and GUNS bonuses genuinely do nothing**, and pricing them
honestly means the game says so instead of recommending them. That is two of six
axes going quiet late — exactly the failure the prestige ranks were added to
prevent on the army axis, and exactly what `notes.md` calls noise to be cut.

The alternative is to **remove the ceiling rather than model it**: let one
spawned bullet carry the damage of the several it stands for — the same collapse
the renderer now does, applied to the simulation. That keeps every axis live and
makes `squadDps` true again. It costs fidelity in overkill and pierce, and it
lives in a regime no instrument here can reach.

Put the choice to the author before building either. The full argument is under
"What one session of real play found" in `notes.md`.

## 4. What landed, so you do not re-derive it

**The bullet stream is collapsed for legibility.** The renderer draws a bounded
subset (`RENDER.maxVisibleShotsPerSecond`, 60) and tints each drawn bullet by how
many real shots it stands for, on the shirt ladder from `data/tiers.ts`. Drawn
count is now flat at ~53 from the earliest state to the latest. The subset is a
Bresenham stride, never the seeded RNG — consuming a number there would turn a
rendering knob into a balance knob.

**Enemies were pinned by two ceilings that were hiding each other.**
`DIFFICULTY.maxHpMult` was 400, which froze the budget at 46,315 HP/s from offer
30 — under four minutes of play — while `squadDps` was simultaneously claiming
damage the bullet pool refused to deliver. Removing either alone breaks the game
in opposite directions. Budgeted DPS now rises monotonically to offer 60 and is
~1000× its old pinned value there. `npm run model` measures the crossover in
OFFERS and fails if it lands inside a run anyone would play.

**Two new instruments**, plus two stale ones repaired:

- `npm run neutral` — plays the same seeds against a reference `dist/` and
  asserts an identical TERMINAL state. This is the only thing here that can tell
  a rendering change from a balance change. Snapshot `cp -r dist /tmp/dist-baseline`
  **before** rebuilding; there is no way to make one afterwards.
- `npm run pressure` — sweeps `DIFFICULTY.pressure` and `targetFraction` by
  injection, printing the clamp threshold in every row because one of those two
  knobs moves it and the other does not.
- `balance` and `mercy` both printed a mercy-clamp threshold of **0.52** from
  hardcoded constants that had moved to 0.28. Both now read it off the build.

## 5. Ground rules

- **A typecheck is not verification, and neither is a green exit code.** Five
  bugs on this branch were found by looking at an image or running the game that
  every automated signal called a pass.
- **The simulation runs on a fixed 1/60s step** (`SIM`). Nothing gameplay-
  affecting may read a real frame delta. `npm run repeat` keeps this honest; a
  nonzero spread is a regression. Currently 0.00%.
- **Measure in simulated seconds, never wall-clock** (`stats.elapsed`).
- **`Progression.ts` is the single definition of squad strength; `Scoring.ts`
  prices every offer exactly once; `Mode.ts` holds the run's difficulty.** Note
  `Progression` now has three DPS functions and they are not interchangeable:
  `squadDps` (analytic build strength), `singleTargetDps` (no pierce, for the
  Titan) and `deliverableDps` (what the pool will honour, for the budget, the
  HUD and scoring). Each carries its reason in a comment.
- Commit subjects prefixed `shooter_ad:`. Stage **explicit paths**, never
  `git add -A` — subagents share this working tree unless given
  `isolation: "worktree"`.
- **No CI on pull requests**, by the user's choice. Pages deploys only after
  merge to `main`. Your local `verify` is the real gate.

## 6. Known gaps — name these as unverified if you report on them

- **The probe has never entered the regime the last change was for.** It dies at
  wave 5 to 9 with a shot rate in the low hundreds, so it never reaches the
  delivery ceiling or the old HP pin. The full sweep is byte-identical before and
  after. Everything about the late game rests on `npm run model`'s arithmetic and
  on `npm run hud`'s forced states, not on a played run.
- **`DIFFICULTY.pressure` was not changed**, and should not be on the strength of
  what is recorded. A two-seed smoke test of `npm run pressure` showed 0.82 →
  1.15 cutting median survival 103.2s → 74.3s and waves 8 → 5, which says the
  knob reaches the enemies and nothing more. Two seeds is not a reading.
- **Nothing is verified at true phone scale.** Every screen judged on 540×960
  PNGs, not a real panel under `Scale.FIT`.
- **The halo flash has never been observed in motion.** Stills only.
- **The Titan-as-loss path has never been seen.** `npm run endscreen` now passes
  against the playtest changes (confirmed this session), but every run in it died
  by attrition, so `THE TITAN LANDED` is still unphotographed and the Titan HP
  budget is still unconfirmed in practice. Consider forcing it the way
  `npm run behaviour` spawns cohorts directly.
- **`SQUAD.moveSpeed` 620 → 260 was never A/B'd** against the new gate speeds.
- **The probe bot cannot dodge.** No threat avoidance, no positioning.

## 7. Settled — do not relitigate

- Raw draws scale to the pool; `npm run model` guards this on both the
  arithmetic and geometric means.
- Scoring prices access; `Difficulty` budgets DPS without it. `×MOVE` and `+TIME`
  must never contribute to par's enemy budget, and do not.
- The bullet collapse is rendering only, proven by `npm run neutral` on five
  seeds with identical terminal state. Do not "improve" it by changing how many
  bullets are spawned.
- Match codes, not raw seed URLs. A shared link lands on a start screen and waits.
- Pierce uses a fixed `q`, not live density.
- Hard mode is a wave offset on the judgment axes only — never enemy pressure.

## 8. How to report

What landed, what the instruments say (with seeds), what you could not verify,
and what you would do next. **Name unverified claims as unverified.** This
project has now been fooled by its own instruments six times, and the most recent
was an instrument written for the sole purpose of not being fooled.
