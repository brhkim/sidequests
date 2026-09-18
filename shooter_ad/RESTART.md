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
- Colour cycles: row `n` wears `TIERS[n % 12]`'s shirt, and **that is all.** Do
  not mark the pass number. The author's call: nobody is watching for the loop
  itself and a cycle marker would not read; what has to be legible is the change
  from one rung to the NEXT. So the requirement is adjacent-rung contrast, not
  cycle identity. Cycle-2 Gold looks like cycle-1 Gold, on purpose.
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
bullet carries the damage of the several it stands for. The author has answered
the design questions; what follows is decided, not open.

**The cap is a design constant, not the pool's accident.** Today the ceiling is
`maxBullets / flightSeconds` — 900 bullets over 900px/s, which is a coincidence
of two unrelated numbers. Replace it with `WEAPON.maxSimShotsPerSecond` and
derive `maxBullets` FROM it, exactly as `RENDER.maxVisibleShotsPerSecond` is a
design constant the stride is derived from. **The author set it at ~300 real
shots/s** — roughly the `hud-mid` state, where nothing is refused today and the
board is visibly fine — which gives the phone a ~270-bullet live pool instead of
900. Above 300, bullets get fatter. "Let's see how it goes" is the mandate: it is
a first value, not a tuned one.

**What one bullet's damage means against ordinary enemies — the author's
choice, with a fallback.** Three options were put to the author:

- *(a) pure bundle*: one bullet does K× damage, overkill wasted. Simplest;
  lumpier late, and it silently taxes RATE — a `+50% RATE` that only raises K
  fattens bullets that were already overkilling, and par does not see the tax.
- *(b) bundle with spill*: a bullet that kills carries its remaining damage into
  the next body — pierce-until-spent. Near-exact DPS fidelity; makes pierce
  partly redundant late.
- *(c) pure bundle, budgeted against an overkill-corrected `deliverableDps`* with
  a fixed factor, the way pierce uses a fixed `q`.

**Do (b) if it stays simple.** The author called it "really nifty" and chose it
first. The complication the author named is the one to watch: a fat bullet that
overkills has NOT spent a pierce, but the thin shots it stands for that DID land
and kill each spent one — so a spilling bullet has to know, per body it meets,
how much of its bundle was consumed and how many of the represented shots have
used their pierce. If that turns into entity tracking per bullet, **stop and fall
back to (a), pure bundle.** The author is explicit that (a) is fine "especially
if we continue to scale enemy health reasonably well" — which the `maxHpMult`
work already secured. Do not build a half-correct (b); a wrong pierce
interaction lies to the death screen, and an honest lumpy bundle does not.

If you land on (a), take the reviewer's variant of (c) with it: keep `Scoring`
on pure `squadDps`, and put a **fixed overkill factor in the difficulty budget
only**. Here is why that matters and it is the thing this plan most under-said
before: once a bullet carries a bundle, `squadDps` is analytically true again
but practically worse against small bodies, while unchanged against the Titan.
Par's number and the player's score are then honest while what actually lands on
ordinary enemies lags — a **systematic skew toward "harder than the curve
thinks"**, not noise. (b) mostly closes it; (a) needs the budget to admit it.

**The tint must encode both collapses.** With part B there are two stacked:
the sim bundle (each spawned bullet = K real shots) and the render stride (each
drawn bullet = M spawned). The colour has to encode **K×M** — real shots per
drawn bullet — or it reads wrong past the sim ceiling. Today it encodes M alone.

**The Titan is the safe case.** A fat bullet on one large body loses nothing to
overkill, so `singleTargetDps` needs no change and the Titan budget stays as it
is. Ordinary enemies are the risky case, not the boss. See §7 for the author's
ruling on what the Titan is pinned to.

`SQUAD.maxPower` guard, from the review: `unitShares` uses `Math.floor(power)`
and `%`, so a `1e15`-class guard is fine and **2^53 is the real line**.

### Part C — a runner from an arbitrary start

Nothing here can reach the regime parts A and B are for: the probe dies at wave
5–9. Add `npm run from` (or extend `balance`) that injects a starting `Progress`
— power plus every upgrade field, or a shorthand like `--dps=1e6` — and
fast-forwards the curve to match. Two decisions the author made:

- **Par starts EQUAL to the injected player state** — "as if they've perfectly
  kept up, and then we see what happens from there." So the runner measures
  "can a player at standing 1.0 survive here?", not a chosen standing ratio.
- **It also starts at a specified wave** (`--wave=N`), so the enemy pool, the
  spawn curve and the gate speed all match the injected state rather than
  starting from wave 1 under a late-game squad.

This is the instrument that finally lets a claim about the late game rest on a
played run instead of on `npm run model`'s arithmetic. Build it third, after A
and B, and then use it to look at both.

### All three parts are deliberate balance changes

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
- **The Titan is pinned to par SINGLE-TARGET DPS** — `titanHp` reads
  `singleTargetDps(par)`, not `deliverableDps` and not the player's own number.
  Author's decision: the Titan is a damage check, so it is sized against the
  reference player's true single-body output. The reviewer asked whether to pin
  it to the PLAYER's deliverable DPS as a mercy floor instead; the answer was no.
  A fat bullet on one large body loses nothing, so part B leaves the Titan's
  arithmetic alone either way — it is the safe case, and it stays a check
  against par rather than a concession to the player.
- Hard mode is a wave offset on the judgment axes only — never enemy pressure.

## 8. How to report

What landed, what the instruments say (with seeds), what you could not verify,
and what you would do next. **Name unverified claims as unverified.** This
project has now been fooled by its own instruments six times, and the most recent
was an instrument written for the sole purpose of not being fooled.
