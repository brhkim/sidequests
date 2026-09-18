# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo.
The redesign roadmap is complete and both open playtest findings have landed, all
pushed to `claude/laughing-feynman-ghh9r3`. `main` is untouched and no PR is open.

The open decision in the previous handoff has been **made by the author**, and
section 3 is now a plan rather than a question. Nothing here is blocked.

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

## 3. Your task: a looping palette, and the two ceilings it removes

**The author's decision: remove both ceilings by letting the palette cycle.**
This section is the whole job. Do it in the order given — part A is
self-contained and part B is the risky one.

### The finding that connects them

Two apparently unrelated ceilings turn out to be the same mistake: a bounded
ladder used to represent an unbounded quantity.

- **`SQUAD.maxPower` = `MAX_PER_UNIT × ringCap` = 2048 × 19 = 38,912.** It is
  derived from `data/tiers.ts` running out of rows at Prismatic. Past it,
  `clampPower` silently caps and **every ARMY bonus becomes a measured no-op** —
  `×1.5 ARMY` and `+8000 ARMY` both do nothing.
- **`WEAPON.maxBullets` = 900**, and `Bullets.spawn` gives up rather than
  overwrite a live one, so real throughput is the pool's recycle rate — ~988
  shots/s. Past it, **RATE and GUNS become no-ops** for the same reason.

The first is the exact bug this project already fixed once. The ladder used to
saturate at 608 power, which "turned every army bonus above it into a measured
no-op and left par unable to tell its options apart", and two seeds showed par
halving its own army. Adding six prestige ranks did not remove that bug — it
**moved it from 608 to 38,912**. A finite ladder will always reintroduce it
somewhere.

A cycling palette has no last row, so neither ceiling has to exist.

### Part A — an unbounded tier ladder

Replace the 12-row lookup in `data/tiers.ts` with a generated one. The authored
rows stay, as **one cycle** of the palette rather than as the whole ladder:

- `threshold(n) = 2^n`, continuing forever rather than stopping at 2048.
- `damage` and `fireRate` continue their geometric progression past the last
  authored row. Extract the per-step ratios from the existing table rather than
  inventing new ones, so the curve through the authored region is unchanged.
- Colour cycles: row `n` wears `TIERS[n % 12]`'s shirt, and the **pass number**
  `floor(n / 12)` is what distinguishes cycle-2 Gold from cycle-1 Gold. Pick one
  cheap, legible treatment — a trim ring, a brightness step, a pip — and say why
  in a comment. The art is procedural and tinted at runtime, so this is a tint
  and a small overlay, not new assets.
- `SQUAD.maxPower` then has no reason to exist as a *design* limit. Keep a large
  finite guard anyway, chosen so `squadDps` cannot reach a float that stops
  being a number, and comment it as an overflow guard rather than a balance
  constant. Losing that guard entirely trades a no-op bug for a `NaN` bug.

`unitStats` interpolates geometrically between row `i` and `i+1`; with a
generated ladder both are just `row(n)` and `row(n+1)`, so that logic survives.

**How to verify it:** `npm run model` already asserts no army bonus is ever a
no-op. Extend its test points far past 38,912 — the assertion becomes a much
stronger claim than it was, and it should now hold at any power. Then
`npm run hud` at a forced state above the old cap, and **look at it**: the point
is that a second-cycle rank is visibly not a first-cycle one.

### Part B — unbounded delivery

Apply the collapse the renderer already does to the **simulation**: one spawned
bullet carries the damage of the several it stands for.

- `shotsPerSecond(p)` is what the build wants. Spawn at the deliverable rate and
  multiply each bullet's damage by `wanted / deliverable`.
- `deliverableDps` then collapses back to `squadDps`, and the HUD stops
  reporting a number the pool refuses to honour. Measured at the late `hud`
  state, the build wants 16,943 shots/s, fires 1,154, and delivers **7%** of
  what the HUD claims.
- The renderer's tint already encodes density on the shirt ladder. With part A
  done, that ratio is unbounded too, so the visual can keep up.

**Raise `WEAPON.maxBullets` first, as far as performance allows, and collapse
only above that.** A lower collapse ratio costs less fidelity, and the three
costs below are all proportional to it:

- **Overkill.** One fat bullet overkills a weak enemy, wasting damage that
  several thin bullets would have spread across several bodies. This makes
  `WEAPON.pierceQ = 0.5` less accurate, and pierce is priced off it.
- **Pierce.** A fat bullet that pierces carries its whole bundle to the next
  body. Defensible, but it changes what pierce is worth, and `Progression` and
  the death screen must keep pricing it identically.
- **Feel.** Damage arrives in lumpier packets. Nothing here can measure that.

State the chosen ratio and its consequences plainly; do not let it drift in as
an implementation detail.

### Both parts are deliberate balance changes

`npm run neutral` asserts an identical terminal state against a reference
`dist/`. It will fail here, correctly. **Snapshot a baseline before rebuilding**
(`cp -r dist /tmp/dist-baseline`) — there is no way to make one afterwards — and
use it to record before/after rather than to assert neutrality. `npm run repeat`
must still pass at 0.00%: these change what the game does, never whether it does
the same thing twice.

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

- **The probe has never entered the regime any of this is for, and will not
  enter it for section 3 either.** It dies at wave 5 to 9 with a shot rate in the
  low hundreds, so it never reaches the delivery ceiling, the old HP pin, or
  38,912 power. Everything about the late game rests on `npm run model`'s
  arithmetic and on `npm run hud`'s forced states, not on a played run. Expect to
  finish section 3 able to prove the ceilings are gone and unable to say whether
  the game past them is any good. Say so in those words.
- **Nobody has measured whether 38,912 power is reachable in a real run.** The
  sweep does not report peak power; it easily could, and that is worth adding
  before arguing about how urgent part A is.
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
- The **render** collapse is rendering only, proven by `npm run neutral` on five
  seeds with identical terminal state. It draws a bounded subset and tints by
  density; it must never consume the seeded RNG or change a spawn. That rule
  still stands and is not what section 3 part B changes — part B adds a separate,
  deliberate collapse in the SIMULATION, and the two must stay distinguishable in
  the code or the next person will read one as the other.
- Match codes, not raw seed URLs. A shared link lands on a start screen and waits.
- Pierce uses a fixed `q`, not live density.
- Hard mode is a wave offset on the judgment axes only — never enemy pressure.

## 8. How to report

What landed, what the instruments say (with seeds), what you could not verify,
and what you would do next. **Name unverified claims as unverified.** This
project has now been fooled by its own instruments six times, and the most recent
was an instrument written for the sole purpose of not being fooled.
