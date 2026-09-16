# shooter_ad

A squad shooter in the mobile-ad style, being reshaped into **DPS golf**: every
few seconds you are shown three bonuses and must judge, before they reach you,
which most increases your damage output.

**Read `notes.md` before changing gameplay.** It holds the design intent — what
the game is for, which bonuses exist and why, and the roadmap. This file
describes how the code works. When they disagree, `notes.md` is the intent and
this file is stale.

## Commands

```bash
npm ci          # first time in a fresh session
npm run dev     # vite dev server, hot reload
npm run build   # typecheck + production build to dist/
npm run verify  # REQUIRED before claiming a change works
npm run balance # time series of power, DPS, par DPS, standing, enemy knobs
npm run repeat  # plays ONE seed several times; fails if the runs disagree
npm run sweep   # every seed at every skill level; prints the table below
npm run hud     # screenshots the HUD in early / mid / late upgrade states
npm run endscreen  # screenshots the end, start and pause screens after real runs
npm run matchcode  # round-trips share codes; pure logic, fast
npm run behaviour  # per-enemy movement signatures, shield taper, enemy fire
```

`npm run verify` does not build — run `npm run build` first. It serves `dist/`,
plays the game headlessly with simulated input, and fails on any console error,
a blank frame, zero kills, a stalled wave counter, or a ring over cap. The
screenshot lands in `.verify/screenshot.png` — **look at it**, don't just trust
the exit code.

`npm run hud` forces the squad into fixed progress states and photographs each
one into `.verify/`. `verify` plays from scratch, so it only ever photographs an
empty build - no multipliers, no guns, no pierce - and the readout beneath the
red line exists for the state `verify` never reaches. Judge HUD legibility off
these, not off the verify frame.

`npm run endscreen` plays real runs and photographs every screen that is not the
playfield - the end screen at two qualities of play, the start screen reached by
a shared link, and the pause screen at two different bonus pools. It asserts
behaviour rather than only producing images, because a frozen simulation and a
working one make the same screenshot: it checks the start screen is actually
showing a match code, and that pause leaves by both resume and restart. `verify` stops while the squad is still alive, so the
screen carrying the score, the decision tally and the match code - the entire
shareable artefact - is never otherwise seen by any automated check, and it is
the screen most likely to be wrong because it is the only one built from values
that do not exist until a run ends.

`npm run matchcode` round-trips share codes, including every 32-bit boundary and
the ways a person mistypes one off a screenshot. A sharing code that loses a bit
is worse than no sharing: two people compare scores on what they believe is one
match, and nothing on screen says otherwise.

`npm run behaviour` is the instrument for the enemy roster. `verify` proves the
game boots and `balance` proves it is survivable; neither can see eight types
moving identically, which is a bug this project actually shipped. It spawns a
cohort of each type directly - the bot does not reliably survive to wave 8 - and
prints lateral path length, backward travel, direction changes, peak speed and
net progress per type, then checks that retreat stays bounded, that the
Shielder's armour really is directional, and that enemy guns land damage on the
squad. It samples wall-clock frames, so figures wobble a few percent per run; it
measures movement, not whether that movement is any fun.

`npm run balance` plays several fixed seeds and prints the series. Use it before
and after any balance change. `PROBE_SECONDS=240 PROBE_SEEDS=1,2,3
PROBE_VERBOSE=1` for a longer, fuller run.

**A passing typecheck is not verification.** Never report a gameplay change as
working without `verify` output.

## Measurement is the hard part here

Three separate balance conclusions in this project turned out to be wrong for
measurement reasons rather than game reasons. Before trusting any number:

- **Seed it.** An unseeded run varies ~2× on gate luck alone — more than most
  changes being evaluated. `?seed=123` fixes the sequence. The probe always
  seeds; the squad's firing jitter is seeded too, so runs are reproducible.
- **Compare like with like.** `standing` is a ratio of *DPS*, not power. Par
  optimises for DPS and will sit on a small potent squad, so comparing its power
  against a player who stacked army-size gates is meaningless and once produced
  standings above 20.
- **One run proves nothing.** Read medians across seeds.
- **Measure in SIMULATED seconds, never wall-clock.** `stats.elapsed` is the
  honest axis and the probe reports it. The two clocks now run at roughly 1:1
  because the simulation is on a fixed step, but they are still different
  quantities: only one of them is a property of the game rather than of the
  machine it ran on.
- **A seed now reproduces a run EXACTLY, and `npm run repeat` is the check.**
  Three repeats of seed 1 agree to the last decimal: 56.3s, wave 4, 6
  decisions, 62% of optimal, 16 kills - 0.00% spread on simulated survival
  while wall clock still moves 0.67%. Before the fixed timestep the same three
  repeats gave 40.2s / 41.1s / 40.2s. A nonzero spread from `npm run repeat` is
  a regression, and the usual causes are a stray `Math.random()` or gameplay
  reading a real frame delta instead of `SIM.step`.

  **Fixing the simulation clock alone was not enough**, and this is the part
  worth remembering. With the simulation already deterministic, the probe bot
  was still steering by wall-clock mouse moves, so its input landed at a
  different SIMULATED moment on every repeat - and the same three repeats
  diverged *further* than before, to 4 / 6 / 4 decisions and a 30% survival
  spread. Both clocks had to move. The bot now steers from inside the page
  through `window.__autopilot`, which the simulation calls once per fixed step.
  A deterministic system measured by a nondeterministic instrument is a
  nondeterministic measurement.

**A worked example of all three failing at once, because it is the fourth time
this project has been fooled by its own instruments.** A sweep reported survival
falling monotonically with skill, 55s down to 35s across five skill levels and
five seeds each - consistent enough to look like a result, and two plausible
mechanisms were proposed for it. It did not reproduce: the same sweep later gave
40s / 35s / 40s, flat. Nothing about gameplay had changed in between. What had
changed was the scene's render load - a halo flash, an end screen and a start
screen had been added - which moved the ratio between simulated and wall-clock
time, and the probe was measuring wall-clock. The diagnostics added to settle
the question also refuted the leading hypothesis outright: lateral travel FALLS
as skill rises rather than rising.

The cost of catching it was three repeats of a single seed. Do that before
reporting any difference.

The probe's bot now chooses from the game's own `scoreOffer`, so it answers the
question the game actually asks. `PROBE_SKILL` is the probability of reaching
for the best option, otherwise picking at random; its RNG is seeded per run, and
it commits once per offer rather than re-rolling each tick, which would average
the knob away.

Read `optimal` and `PROBE_SKILL` as different quantities. Skill is an INPUT -
the chance of reaching for the best option. `optimal` is the OUTPUT: the share
of achievable damage growth actually captured, after misreached gates and missed
offers. They will not match, and should not be expected to.

**`optimal` responds to skill and then saturates.** Swept across seeds 1-5 on
the corrected clock, in simulated seconds:

| PROBE_SKILL | survival | optimal | standing | breach/min | travel/min |
| --- | --- | --- | --- | --- | --- |
| 0.3 | 98.5s | 24% | 0.49 | 26.0 | 2002 |
| 0.5 | 95.4s | 51% | 0.58 | 29.6 | 2151 |
| 0.7 | 75.0s | 85% | 0.81 | 28.0 | 1686 |
| 0.9 | 82.8s | 88% | 0.67 | 32.6 | 1821 |
| 1.0 | 82.7s | 88% | 0.76 | 29.3 | 1629 |

Two things hold and one does not. `optimal` separates 0.3 / 0.5 / 0.7
cleanly and hits a ceiling above that, so do not use it to compare good play
against excellent play. Part of that is real - a bot reaching for the best
option 70% of the time captures most of the available growth - and part is an
artefact: the metric compounds over DECISIONS, so a short run has little room to
fall behind. A short excellent run and a long excellent run are not comparable
on this number. It is per-decision rather than per-second, which is why it
survived the clock retraction below.

**Choosing is not the same as getting.** At high skill the bot reaches for the
best option nearly every time and still falls short of 100%. The gap is gates it
chose and could not reach. Any claim of the form "a player picking well gets X"
has to account for it, because the game charges for travel and the scoring does
not.

`standing` rises with skill, 0.49 to roughly 0.8, so the difficulty curve IS
skill-responsive - which is what `PROBE_SKILL` existed to test. Note the 0.3 row
sits at 0.49, just under the 0.52 mercy-clamp threshold, while every higher
skill sits above it: weak play is governed by the clamp and competent play by
par, which is what the two-regime design intends.

**Survival does not track skill.** 98.5 / 95.4 / 75.0 / 82.8 / 82.7 is not
monotonic, and within-level spreads run 39s to 155s, so at five seeds these
medians cannot support a trend either way. Do not read a slope into it.

**RETRACTED: survival does not fall with skill.** An earlier sweep here reported
survival falling monotonically from 55s to 35s as PROBE_SKILL rose, called it
consistent enough not to be noise, and proposed two mechanisms for it. It was an
artefact of measuring wall-clock time - see the worked example under
"Measurement is the hard part here". The diagnostics that were added to settle it
also refuted the leading hypothesis outright: lateral travel FALLS as skill
rises rather than rising, and breach loss is flat across skill levels. Anything
on this branch that was downstream of those survival medians is unverified,
including the claim that the end screen's headline score inversely tracks skill.

Survival is now measured in simulated seconds. Numbers taken on that axis are
not comparable with any figure recorded before the switch, since the two clocks
then differed by roughly a factor of two. They are also not comparable across
the fixed-timestep change: on a fixed step the bot's input arrives at different
simulated moments than it used to, so runs diverge from the very first offer.
Seed 1 at skill 0.7 went from 42.8s / 4 decisions to 56.3s / 6 decisions on that
change alone. **The sweep table above predates it and is therefore stale.**

**The mercy clamp stays untouched** until a sweep on the fixed-step clock says
something about it. It is the constant most likely to make the game miserable if
overcorrected, and every reading that pointed at it so far came from an
instrument timing the browser.

It is still a crude player: no threat avoidance, no positioning for breaches,
and it cannot dodge enemy fire at all. A floor on difficulty, not a verdict on
how the game feels.

## Architecture

```
src/
  config.ts            every tunable number — balance lives here, not in logic
  data/                content tables: tiers, enemies, gates
  systems/             simulation; no Phaser display objects except SpritePool
  scenes/              Boot (textures), Game (sim + render), UI (HUD)
```

`systems/` holds plain classes with no display objects; `GameScene.render()`
syncs pooled sprites to that state once per frame. Gameplay is therefore
readable and testable without touching Phaser.

**Keep files small and split early.** Agents add features well and restructure
large files badly. Past ~250 lines, split before adding.

**Content lives in tables, not `if` chains.** Adding an enemy or a bonus should
be an append to `data/`. Editing a `switch` to add content means the design is
wrong.

### `Scoring.ts` prices every offer, exactly once

Par takes its pick from it, `DecisionLog` grades the player with it, the halo
flash colours from it, and the probe bot chooses with it. Two implementations
would drift, and the failure is silent and nasty: the death screen telling a
player they made a mistake the difficulty curve never charged them for, or
charging them for one it refuses to name.

Ties break toward the option leaving the most power, then toward the first
offered, and the comparison is relative rather than exact. That is load-bearing
rather than fussy - on a strict `>` against a flat DPS curve, par kept whatever
it scored first and two seeds showed it halving its own army.

`DecisionLog` measures each option against the state the player was ACTUALLY in
when the offer arrived, not against a counterfactual perfect run. Missed offers
are logged as decisions with no pick, because driving past three gates should
show up in the score. One ordering trap, already paid for: `consumePair` is what
opens the log entry for a gate taken before it reaches the lane line, so
resolving before it silently left every such decision unrecorded.

### Scoring prices ACCESS; difficulty budgets DPS. Keep them apart.

`x MOVE` and `+TIME` change no damage number at all. Priced by resulting DPS
they score a flat zero, so par would never take one, the halo would flash every
one of them red, and the death screen would call them mistakes. That is not the
game judging them harshly - it is the scoring failing to see a cost the game
already charges. **You only get the bonus you can reach**, and at `PROBE_SKILL`
1.0 the bot reaching for the best option every single time still lands a median
88% of optimal, the gap being gates it chose and could not get to.

So a state is valued as `squadDps(p) x accessFactor(reach(wave, upgrades))`:

```
reach        = moveSpeed x descentSeconds x SCORING.reachShare / laneWidth
accessFactor = 1 - SCORING.accessWeight / (1 + reach)
```

Three properties are load-bearing:

- **`Scoring.scoreOffer` uses the value; `Difficulty` uses raw `squadDps`.**
  Access buys future picks, not kills, so folding it into the enemy budget would
  tell the curve a squad that merely moves well is destroying more than it is.
  Par still *chooses* on value, because that is the decision - the asymmetry is
  deliberate and is commented at both ends.
- **`accessFactor` saturates but never reaches 1**, and `reach` is NOT clamped.
  A clamp would price every `x MOVE` past saturation at exactly zero, which is
  the failure the valuation exists to remove. `npm run model` asserts the floor
  is positive at every wave and at stacked multipliers up to x8.
- **`SCORING.reachShare` is a tuned constant, for the reason `WEAPON.pierceQ`
  is.** The true share of a descent the squad can spend travelling swings
  second to second with the board; a value read at the instant of a decision
  scores the pick against a truth that lasted one second. Stable and identical
  for par and player beats precise and unrepeatable.

`x1.5 MOVE` and `+50% TIME` are exactly equivalent by construction - both
multiply reach by the same root. When two such draws land in one offer the
options genuinely tie, and the tie-break decides. Mismatched roots
(`x1.2 MOVE` against `+30% TIME`) are a real comparison, and that is the usual
case.

### Hard mode is a wave offset on the judgment axes, and nothing else

`systems/Mode.ts` holds the active mode and one number: `waveOffset`. Hard mode
sets it to 5, and `judgmentWave(wave) = wave + offset` feeds exactly two things
— `waveGateSpeedMult` and the legibility tier `rollOffer` draws from. A hard
run's first offer therefore descends at wave-6 speed (×1.375) and draws from
the wave-6 root table; the top legibility tier arrives at real wave 6 instead of
11, and gate speed caps at real wave 16 instead of 21.

Three things are deliberately NOT mode-dependent, and `npm run model` fails if
any of them becomes so:

- **Enemy pressure.** `DIFFICULTY.targetFraction` is identical in both modes.
  `notes.md` allows raising it and it is still the wrong lever: it is a claim
  about how much damage the curve expects rather than about how hard the
  decision is, and it would move the mercy-clamp threshold, so every reading of
  hard mode would be confounded with a regime change.
- **Which bonuses exist.** The candidate pool filters on the REAL wave. Hard
  mode makes the sum harder, not the content earlier.
- **The knob count.** `MODES.hard` may carry `waveOffset` and nothing else, so
  a future "just one more tweak" cannot quietly reach the enemy budget.

The mode is set once per run by `GameScene` and read from module state rather
than threaded through the four call paths that must agree — the descending
gate, the offer roller, par's valuation and the player's. Same argument as
`Progression.ts` and `Scoring.ts`: a second copy drifts silently.

A player picks it by tapping the difficulty line on the start screen, which
rewrites the match code as it switches. That is not cosmetic — a hard run is
not the same match as a normal one on the same seed, and the code is what
people compare off a screenshot, so the two must not share an identity.

### Gate approach speed is the judgment-axis difficulty lever

`GATES.speedPerWave` raises how fast offers descend, capped at
`GATES.maxSpeedMult`. Later waves do not hand you a harder sum, they give you
less time to do it in - deliberately separate from enemy pressure, which is
closed-loop against par and never keys off the wave number. `+TIME` divides it
back down for the rest of the run.

Squad movement is rate-limited in `Squad.update`. Under a pointer it used to
assign the finger's x directly, so the squad teleported, travel was free and the
whole movement economy was inert. `SQUAD.moveSpeed` came down from 620 to 260
when the movement bonuses landed; set it high again and `x MOVE` buys nothing.

### `Progression.ts` is the single definition of squad strength

The squad fires from it and the difficulty model budgets against it. Two copies
would drift and the difficulty curve would silently stop matching the game. Any
new stat, bonus form, or damage term goes here — including the pierce valuation,
so that par and the player price it identically. If they diverge, the death
screen's "optimal pick" scoring becomes a lie.

### Difficulty is closed-loop

Enemy strength is **not** keyed to wave number. `systems/Difficulty.ts` tracks a
shadow "par" player who takes the best gate offered every time — scored by
resulting DPS, not raw power — and collects every bonus. Enemy HP is derived:

```
budget/sec = squadDps(par) * targetFraction * pressure
hpMult     = budget/sec / (spawnRate * avgPoolHp)
```

Spawn rate keeps a hand-authored curve, so pacing stays authored while
difficulty stays automatic.

Two properties are easy to break:

- **The budget spends two knobs, not one.** Toughness first, wave thickness
  second. Spending only toughness let a weakened player drown in trivial
  enemies whose count still cost power on every breach.
- **Par is eased over `smoothingSeconds`.** Multiplier gates double par at an
  instant, which otherwise halves the player's standing with no warning.

`DIFFICULTY.maxOverPlayer` is a mercy clamp: par grows on perfect play whether
or not the player kept up, so without any clamp one missed multiplier gate
ratchets difficulty out of reach and the run spirals. **It is slated to be
softened substantially** — see `notes.md`; losing control should be legible, not
prevented. Removing it entirely reproduces a reliable death spiral around wave
7, so re-probe after touching it.

**Know which of the two regimes you are measuring in.** The clamp takes over
exactly below `standing = targetFraction / maxOverPlayer` — 0.52 at the current
constants. Above that the curve is par-driven and skill-responsive; below it,
enemy pressure is simply 1.35× whatever the player is doing, and neither
`targetFraction` nor par influences the run at all. Softening the clamp moves
this threshold up and hands more of the run back to par.

The bot used to live almost entirely below 0.52, which made every conclusion
about the par-driven regime a conclusion about a regime it never entered. **That
changed when par stopped being credited at gate spawn.** Offers were handed to
par about eight seconds before the player could reach them, so par banked every
bonus a full interval early and ran ahead of any achievable play. Measured
across seeds 1-5, before and after:

| | survival median | mean | standing, seeds 3/4/5 |
| --- | --- | --- | --- |
| credited at spawn | 45s | 43s | 0.71 / 0.44 / 0.51 |
| credited on arrival | 45s | 49s | 0.72 / 0.59 / 0.54 |

Median survival did not move. The number that matters is standing: two of the
three seeds crossed **from below 0.52 to above it**, which means those runs moved
out of the mercy-clamped regime and into the par-driven one. The curve is now
doing the job it was designed for on seeds where it was previously bypassed
entirely.

Read that as a regime shift, not as "the game got easier" — and read it as a
floor, since the bot still cannot see the decision it is making. Five seeds is
also a small sample for the mean; the median moving not at all is the honest
headline.

Raise `targetFraction` toward 1 to make the game meaner; lower it to make wins
feel bigger.

### Legibility must stay difficulty-neutral, and once did not

`notes.md` says of the legibility axis: "No mechanic changes — only how hard the
arithmetic is." That is a claim about the MEAN of each tier's root table, and it
was false. The original first tier, `[1.05, 1.1, 1.2, 1.3, 1.4, 1.5]`, bunches
low: mean 1.2583 against 1.2750 for both ladders, which are symmetric over the
range by construction. **1.32% less per draw, and draws multiply — about 48%
less power over thirty offers.**

So escalating legibility was quietly escalating strength, and hard mode, which
starts a tier in, was handing out bigger bonuses rather than harder sums. It is
why the probe measured hard mode as easier than normal at every skill level.
The first tier is now symmetric (`[1.05, 1.1, 1.2, 1.35, 1.45, 1.5]`, gaps
0.05/0.10/0.15/0.10/0.05, every value still a multiple of 0.05) and
`npm run model` computes each tier's mean and fails if they drift apart by more
than 0.5% per draw.

Worth generalising: **any content table indexed by difficulty needs its mean
checked, not just its range.** The range was fixed and documented as
deliberately fixed, which is exactly what made the skew invisible.

## Known-broken, measured, not yet fixed

These came out of `npm run balance` and are load-bearing for the roadmap. Do not
tune balance around them — fix them first.

Fixed: **enemy behaviour variety**. Movement is now a discriminated `motion`
union in `data/enemies.ts`, one case each in `systems/EnemyMotion.ts`, and every
kind is used by at least one type - a plain straight-down walker was deleted
rather than left as another unused case. Non-movement behaviour (`gun`, `heal`,
`escort`, `splitInto`, `frontArmor`) is now plain optional fields read by
`Enemies.applyTraits`, so combining them is data rather than a new case.
`npm run behaviour` is what keeps this honest.

Fixed, and worth knowing why they mattered: the rank ladder used to saturate at
608 power, which turned every army bonus above it into a measured no-op and left
par unable to tell its options apart — it kept whatever it scored first on a
strict `>`, including a trap, and two seeds showed it halving its own army. The
ladder now runs six ranks past red, `SQUAD.maxPower` is derived from the top row
so that dead region cannot return, and par breaks ties toward the option leaving
the most power.

## Determinism is a product requirement

Seeds are meant to be shareable — replay your run, or hand a friend the same
one. That makes reproducibility a feature, not a testing convenience:

- Every consumer of randomness goes through the seeded generator from
  `systems/Rng.ts`. A stray `Math.random()` anywhere breaks it; the squad's
  firing jitter already caught this once.
- Nothing gameplay-affecting may read wall-clock or raw frame timing.
  `GameScene.update` drains real time into FIXED `SIM.step` increments and
  `GameScene.step` is the only thing below it that sees a `dt` at all - always
  the same one. Rendering is snapped to the latest step rather than
  interpolated; at a 1/60s step against a 60Hz display there is nothing visible
  to interpolate, and snapping keeps the frame a photograph of a real
  simulation state rather than of one that never existed.
- `SIM.maxStepsPerFrame` caps the drain, so a slow frame loses time instead of
  queueing more work than the next frame can do. The game runs briefly in slow
  motion; it does not spiral.
- **Balance changes change outcomes.** A seed is only comparable within a
  version, so a version tag travels with it.

## The ring cap

The formation never exceeds **three hex rings (1 + 6 + 12 = 19 units)**, set by
`SQUAD.ringCap`. This is the fix for the genre's classic failure, where a large
army becomes an unmanageable blob and positioning stops mattering.

`Squad.power` drives both size and strength: visible units = `min(power,
ringCap)`, and power beyond the cap is dealt evenly across those units as
power-per-unit, which maps to a shirt colour in `data/tiers.ts` (grey → green →
blue → purple → orange → red, then six prestige ranks: bronze → silver → gold →
platinum → diamond → prismatic). The remainder goes to innermost units first, so
the leader ranks up before the outer ring — which is why a mid-run squad shows
two colours at once.

Thresholds double per rank, from 1 to 2048 power-per-unit; `SQUAD.maxPower` is
derived as that top threshold × `ringCap`, so there is no power range the ranks
do not cover. **Damage and fire rate interpolate geometrically between rows
rather than stepping at them** — bonus magnitudes are drawn from `[1.05, 1.50]`
and thresholds double, so a stepped ladder would make a `×1.2 ARMY` worth
nothing most of the time. The tier row is the visible rank; the stats are
continuous in power.

## Collision is bespoke, not Arcade or Matter

Every interaction is circle-vs-circle with no gravity, stacking, or resting
contact — the case where a physics library costs more than it gives. Two guards
matter and are in place:

- The step is a fixed 1/60s (`SIM.step`), so fast bullets cannot tunnel through
  enemies on a slow frame - and, unlike the clamped real delta this replaced,
  the collision geometry resolves identically on every repeat of a seed.
- Bullet-vs-enemy goes through the uniform `Grid` broad-phase, never a nested
  loop.
- Enemy-bullet-vs-squad is **swept**: `EnemyBullets.collide` measures each unit
  against the segment the bullet travelled this frame, not against its endpoint,
  and movement is additionally split into substeps of at most
  `ENEMY_FIRE.maxStep`. The squad is a cluster of 8px units, which is the exact
  geometry an endpoint test slips between.

Squad damage now has two sources, and they are deliberately different: a breach
costs `SQUAD.breachLoss * enemy.damage` and shakes the camera hard, while a
bullet costs `SQUAD.fireLoss * gun.damage` and barely nudges it. A breach is a
failure to kill; fire is a tax on standing still.

## Art

Entirely procedural, generated in `BootScene` with `Graphics#generateTexture`.
Everything is drawn white and tinted at runtime, so one texture serves every
colour. No asset files, nothing to load at runtime — which is what keeps the
build a static folder.

`TextureManager.generate` and the Create palettes were **removed in Phaser v4**;
see `.claude/skills/phaser4-migration/`.

## Extending content

- **Enemy**: append to `ENEMIES` in `data/enemies.ts`. Only genuinely new
  movement needs a case in `Enemies.applyBehaviour`. Note five of the eight
  current types move identically because their cases fall through to `default`,
  and `charger` is dead code — fixing that is on the roadmap.
- **Bonus**: append to `CANDIDATES` in `data/gates.ts` plus one case in the
  progression model. Magnitudes are never hardcoded — every bonus draws from the
  root table in `data/roots.ts` and presents the draw according to its form.
  Colour names the axis and both forms of an axis share it, so the player cannot
  read the raw-versus-multiplicative choice off the tint instead of doing the
  conversion.
  Every bonus must change damage output and must not be trivially rankable by
  label alone — see the taxonomy in `notes.md`. Pierce is valued with a fixed
  ratio rather than live enemy density, deliberately: density swings across a
  wave, so a density-derived number scores a pick against a truth that lasted
  one second. Par and the player must price every bonus with the same function
  or the death screen's "optimal pick" marker lies to the player about their
  own mistake.
- **Army growth**: gates, rescue cages, kill streaks (`STREAK`), wave-clear
  bonuses (`WAVE.clearBonus`). Add another by calling `squad.addPower()`.
