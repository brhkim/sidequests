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
npm run hud     # screenshots the HUD in early / mid / late upgrade states
npm run endscreen  # screenshots the end screen after a real run
npm run matchcode  # round-trips share codes; pure logic, fast
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

`npm run endscreen` plays a real run, ends it, and photographs the end screen at
two qualities of play. `verify` stops while the squad is still alive, so the
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
- **Measure in SIMULATED seconds, never wall-clock.** The simulation advances on
  clamped frame deltas, so how much game happens per real second depends on how
  much the scene is rendering. A verify run spanning ~24s of wall clock covers
  ~43s of simulated time. `stats.elapsed` is the honest axis; the probe reports
  it.
- **A seed reproduces content exactly; timing wobbles ~2%.** Three repeats of
  one seed at one skill level gave 40.2s, 41.1s and 40.2s of simulated time,
  with identical decisions and the same wave every time. Measured in WALL-CLOCK
  the same three runs read 15s, 15s and 20s - a 33% spread, entirely an artefact
  of the clock. The residual 2% is frame-timing jitter in collision resolution
  and will not go until the simulation runs on a fixed timestep. Treat
  differences under ~5% as noise.

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

**`optimal` saturates, so do not use it to compare good play against excellent
play.** Swept across seeds 1-5:

| PROBE_SKILL | survival median | optimal median | standing median |
| --- | --- | --- | --- |
| 0.3 | 55s | 39% | 0.56 |
| 0.5 | 55s | 56% | 0.59 |
| 0.7 | 50s | 98% | 0.85 |
| 0.9 | 35s | 100% | 0.68 |
| 1.0 | 35s | 96% | 0.73 |

It separates 0.3 from 0.5 from 0.7 cleanly and then hits a ceiling. Part of that
is real - a bot reaching for the best option 70% of the time captures most of
the available growth - and part is an artefact: the metric compounds over
DECISIONS, and a run that dies at 35s makes ten of them, so there is little room
to fall behind. A short excellent run and a long excellent run are not
comparable on this number.

**Choosing is not the same as getting.** At skill 1.0 the bot reaches for the
best option every single time and still lands at 96% median, with one seed at
50%. The gap is gates it chose and could not reach. Any future claim of the form
"a player picking well gets X" has to account for that gap, because the game
charges for travel and the scoring does not.

**Survival falls monotonically as skill rises** - 55s at 0.3 down to 35s at 1.0,
across five levels and five seeds each. That is the opposite of what the curve
is meant to do, and it is consistent enough not to be noise. It is still not
explained. Two candidates, and they need separating before anything is tuned:

- The bot has no threat avoidance, so reaching for the BEST gate means more
  lateral travel across the lane and more breaches taken on the way. Higher
  skill would then buy worse positioning, which is a property of the bot rather
  than of the game. The 50% seed above is direct evidence this mechanism exists;
  what is unmeasured is how much of the survival drop it accounts for.
- The mercy clamp binds hard for a weak player (pressure becomes 1.35x their own
  DPS) and releases for a strong one (pressure becomes 0.7x par). Skill would
  then genuinely buy a harsher run.

**Do not tune the clamp on this.** It is the constant most likely to make the
game miserable if overcorrected, and the signal pointing at it is confounded by
the first explanation. Give the bot minimal threat avoidance first, re-sweep,
and see whether the slope survives.

It also puts a question against the end screen's headline. WAVES SURVIVED is the
biggest number on the shareable artefact, and on this evidence it does not
measure the skill the game tests - it inversely tracks it.

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
- Nothing gameplay-affecting may read wall-clock or raw frame timing. The
  simulation advances on a clamped step.
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

- `delta` is clamped to 1/30s in `GameScene.update`, so fast bullets cannot
  tunnel through enemies on a slow frame.
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
