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
npm run pressure   # sweeps the two knobs that set how hard ordinary enemies are
npm run neutral    # proves a change was RENDERING-ONLY, against a reference build
npm run from       # plays real runs from an INJECTED late-game state, par equal to it
npm run titan      # parks a squad under the boss and reports where on its descent it died
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
these, not off the verify frame. `HUD_DIST=/some/dist` photographs a build other
than the working one, which is how to look at two versions side by side without
rebuilding under a probe that is already running.

It is also the instrument for the bullet stream, and it prints numbers as well
as images. Per state it reports what the build WANTS to fire, what it actually
fires, what the pool refuses, how many bullets are live, how many are drawn, and
the density each drawn bullet stands for. Two of those columns are the whole
subject of the two sections below:

```
hud-mid.png     want  303/s  fired  301/s  refused    0/s  live 272  drawn 55  density x5.1
hud-late.png    want 16943/s  fired 1154/s  refused 3406/s  live 872  drawn 53  density x16.5
```

`npm run pressure` sweeps `DIFFICULTY.pressure` (and, if asked,
`targetFraction`) by injecting the value per page, the way `npm run mercy` does.
The two knobs are not interchangeable and the script prints the clamp threshold
in every row for that reason: `pressure` scales the budget and leaves the regime
boundary alone, while `targetFraction` drags the boundary with it, so a reading
against it is two changes wearing one number.

`npm run neutral` plays the same seeds against two builds at once and asserts
they end in an identical state. It exists because **no other instrument here can
tell a rendering change from a balance change**: a differently-balanced game is
still deterministic, so `repeat` passes it, and `sweep` compares medians against
spreads of 40s to 150s, so it can only ever say "within noise". Give it a `dist/`
built before the change:

```bash
cp -r dist /tmp/dist-baseline     # BEFORE the change - there is no way to make one after
npm run build
NEUTRAL_REF=/tmp/dist-baseline npm run neutral
```

**It compares the state a run ENDS in, not the sampled series, and the reason is
a mistake this file's own instrument made on its first run.** Comparing rows
reported all five seeds as different on a change that was provably
rendering-only, with survival agreeing to the last decimal on every one of them.
The differences were `elapsed: 5.1 vs 5.08` and a spawn rate read either side of
the first throttle: `playSeed` polls on wall clock and buckets on simulated
seconds, so two runs of an identical simulation get photographed at slightly
different simulated instants. That is the standing warning one level up - a
deterministic system measured by a nondeterministic instrument is a
nondeterministic measurement - and it cost the first thirty minutes of the check
that was written to prevent exactly this class of error. A run that hits the
time budget rather than dying was stopped by the poller, so it is reported as
INCONCLUSIVE rather than as a pass.

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
PROBE_VERBOSE=1` for a longer, fuller run. `PROBE_DIST=/some/dist` points it,
and every other probe, at a build other than the working one - the before half
of a before/after pair is measured against a snapshot rather than rebuilt.

`npm run from` is the only instrument that reaches the late game. The probe bot
dies at wave 5 to 9 and has never crossed the delivery ceiling, the old HP pin
or the old power cap; `from` injects a starting `Progress` and a wave, sets par
EQUAL to it (the author's choice - it asks "can a player at standing 1.0
survive here?", not a chosen ratio), and plays real seeded runs from there.
`--dps=1e6` fast-forwards a par-shaped build to that output through the shipped
roller and scoring; `--power= --guns= --damageMult=` and the other `Upgrades`
fields set one by hand; `--wave=` sets the enemy pool, spawn curve and gate
speed to match. The bot is still the bot, so read it as a floor.

`npm run titan` is the instrument for the boss check, on the boss's own terms.
The Titan's HP is a deadline - `bossKillPar` of par's single-target DPS over
`bossKillDistance` of its descent, every shot landing - and nothing else can
say whether that sentence is true of the shipped game: `from` meets the boss
with a bot that is off chasing gates, and `model` checks the arithmetic against
itself. This parks a squad UNDER the Titan, takes no gates, and prints where on
its descent the boss died next to where the budget says it should have, given
the single-target standing the boss was actually sized against. Their ratio is
the **delivery** - how much of the assumed damage arrived. It is a ceiling on
what a player can do to the boss and says nothing about the feel of doing it
while also dodging.

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

**`optimal` responds to skill and then saturates.** Swept with `npm run sweep`
across seeds 1-5, normal mode, on the fixed-step clock and the corrected root
tables, in simulated seconds. A `+` marks a run that hit the 150s budget rather
than dying - its survival is a FLOOR, and so is any median containing one:

| PROBE_SKILL | survival | optimal | standing | waves | died | breach/min | travel/min |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0.3 | 74.4s | 30% | 0.65 | 5 | 5/5 | 21.0 | 3281 |
| 0.5 | 97.6s | 51% | 0.53 | 7 | 5/5 | 29.5 | 3476 |
| 0.7 | 93.8s | 57% | 0.70 | 7 | 5/5 | 26.1 | 3445 |
| 0.9 | 122.9s | 73% | 0.76 | 9 | 5/5 | 21.3 | 3307 |
| 1.0 | 123.2s | 85% | 0.78 | 9 | 5/5 | 21.3 | 3307 |

**Every run now dies inside the budget, so for once no median here is a floor.**
That is a change from the table this replaced, which had 3 to 5 truncations per
level - and that older table also predates the playtest commit `93ffb41`, so it
was describing a different game by the time anyone read it.

**This table is identical before and after the stream collapse and the delivery
ceiling.** Both sweeps were run in full, five seeds at five skill levels, and
every cell matches to the digit except `standing` at skill 0.3 (0.64 to 0.65).
Read that as the honest headline rather than as a null result: the collapse is
rendering-only by construction, and the difficulty work lives past the delivery
ceiling (~988 shots/s) and past the old HP pin (offer 30), **neither of which
the probe has ever reached.** It dies at wave 5 to 9 with a shot rate in the low
hundreds. So the sweep says nothing broke in the regime it can see, and cannot
say anything at all about the regime the change was for.

`optimal` now rises monotonically with skill - 30 / 51 / 57 / 73 / 85% - which
it did not in the table this replaced, where 0.5 and 0.7 came out level. Five
seeds still cannot support fine distinctions, so read the ends and not the
middle. Part of the ceiling is real - a bot
reaching for the best option most of the time captures most of the available
growth - and part is an artefact: the metric compounds over DECISIONS, so a
short run has little room to fall behind. A short excellent run and a long
excellent run are not comparable on this number. It is per-decision rather than
per-second, which is why it survived the clock retraction below.

**Choosing is not the same as getting.** At high skill the bot reaches for the
best option nearly every time and does not always land it. The gap is gates it
chose and could not reach. Any claim of the form "a player picking well gets X"
has to account for it, because the game charges for travel and the scoring does
not.

**Survival does not track skill reliably.** All 25 runs died, so these are real
medians rather than floors - but within-level spreads still run 40s to 124s, and
at five seeds that cannot support a trend. Do not read a slope into it.

**`standing` rises with skill apart from one inversion.** 0.65 / 0.53 / 0.70 /
0.76 / 0.78 - skill 0.5 sits below skill 0.3, which at five seeds is not a
finding either way. With the mercy clamp softened to 2.5 its threshold is
0.28, which no skill level's median reaches, so every row here is par-driven.
The two-regime split the old table showed at 0.52 is gone by design - see the
clamp note below.

### Hard mode measures as EASIER, and the instrument cannot see why not

Every sweep of hard mode has come out easier than normal at every skill level -
longer survival, higher standing, fewer deaths. Two contributions were found and
fixed (the root-table means, above), and a third was proposed and refuted: gate
speed feeds `reach`, which prices access, so hard mode might pay for its own
antidote in `+TIME`. `npm run model` measures that directly - access picks go
DOWN under hard mode, 1.5% to 1.1%, and par DPS after thirty offers is within
4%. Not the mechanism.

**The honest conclusion is that `npm run balance` cannot evaluate hard mode at
all.** Hard mode's whole content is less time to read three labels and do a
conversion. The bot has no reading time: it is handed the scored options and
decides in zero simulated seconds. The only part of gate speed it can feel is
having less time to TRAVEL - and it travels ~25% further per minute under hard
mode, so it is paying that part. Everything the mode is actually for is
invisible to it.

So treat hard-mode probe numbers as a check that the mode does not CRASH or
spiral, and nothing more. Whether it is harder is a question for a human, and
this is the clearest case yet of the standing warning that a bot is not a
player.

### The mercy clamp, measured and softened

`npm run mercy` sweeps `DIFFICULTY.maxOverPlayer` at low skill - the regime it
governs - by injecting the value per page rather than rebuilding per value. Five
seeds at skills 0.3 and 0.5:

| clamp | threshold | runs below it | died | median survival |
| --- | --- | --- | --- | --- |
| 1.35 | 0.52 | 4/10 | 9/10 | 112s |
| 1.8 | 0.39 | 3/10 | 10/10 | 103.5s |
| 2.5 | 0.28 | 0/10 | 10/10 | 99.8s |
| none | 0.01 | 0/10 | 10/10 | 99.8s |

It is now **2.5**. Three readings support that and one claim had to be
withdrawn:

- **The clamp was doing less than this file assumed.** At 1.35, nine of ten weak
  runs died anyway. It was never what stood between bad play and losing.
- **Softening costs about 11% of median survival** for weak play, and hands the
  4/10 runs that lived in the clamped regime a run governed by par instead.
- **2.5 and no clamp at all measured identically**, per-run and not merely in
  median. What the constant still buys is a GUARANTEE that enemies never become
  unkillable, not an observed effect - which is exactly the residue `notes.md`
  asks to keep, and why this is 2.5 rather than removal.
- **WITHDRAWN: "removing it reproduces a reliable death spiral around wave 7".**
  It did not reproduce. That reading predates both the fixed timestep and the
  root-table fix, so it is not comparable and is withdrawn rather than
  contradicted. If the spiral is real, it needs re-demonstrating on the current
  clock before it is quoted again.

**RETRACTED: survival does not fall with skill.** An earlier sweep here reported
survival falling monotonically from 55s to 35s as PROBE_SKILL rose, called it
consistent enough not to be noise, and proposed two mechanisms for it. It was an
artefact of measuring wall-clock time - see the worked example under
"Measurement is the hard part here". The diagnostics that were added to settle it
also refuted the leading hypothesis outright: lateral travel FALLS as skill
rises rather than rising, and breach loss is flat across skill levels. Anything
on this branch that was downstream of those survival medians is unverified,
including the claim that the end screen's headline score inversely tracks skill.

Numbers are comparable only within a version, and this branch has now moved the
axis three times: to simulated seconds, onto a fixed timestep (where the bot's
input arrives at different simulated moments, so runs diverge from the first
offer - seed 1 at skill 0.7 went 42.8s / 4 decisions to 56.3s / 6), and through
the root-table correction. Any figure recorded before all three is stale.

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
or not the player kept up, so without any clamp a missed multiplier gate can
ratchet difficulty out of reach. **Softened from 1.35 to 2.5** — see the measured
table under "The mercy clamp, measured and softened" above, and the config
comment, which carries the reasoning. Re-probe with `npm run mercy` after
touching it.

**Know which of the two regimes you are measuring in.** The clamp takes over
exactly below `standing = targetFraction / maxOverPlayer` — **0.28** at the
current constants, down from 0.52. Above that the curve is par-driven and
skill-responsive; below it, enemy pressure is simply `maxOverPlayer` times
whatever the player is doing, and neither `targetFraction` nor par influences
the run at all. Softening the clamp moves this threshold DOWN and hands more of
the run back to par — at 0.28 no skill level's median standing reaches it, so
the probe now measures the par-driven regime at every level. Note the sign: a
LARGER `maxOverPlayer` is less mercy, because it lets pressure run further above
the player before being capped.

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

### Ordinary enemies stopped scaling, and three ceilings were hiding each other

**The finding, from real play:** non-boss enemies should scale at least somewhat
more with the player's damage output. The budget above is already LINEAR in par,
so the useful question was where that linearity stops. It stopped three times,
each ceiling concealed by the one before it, and fixing any one alone would have
broken the game.

**Ceiling one: `DIFFICULTY.maxHpMult` was 400.** The budget pinned at
`maxHpMult x maxSpawnRate x avgBaseHp` = 46,315 HP/s, reached at a par DPS of
about 80,000 - **offer 30, under four minutes of play**. Past that the wave was
the same wave forever while the player kept compounding by roughly a quarter
per offer. It is now 1e12 and documented as numeric rather than balance;
`npm run model` measures the crossover in OFFERS and FAILS if it lands inside a
run somebody would play.

**Ceiling two: the bullet pool.** `Bullets.spawn` gave up rather than overwrite
a live bullet, so real throughput was the pool's recycle rate - 900 bullets over
a 0.9s flight, ~988 shots/s, a coincidence of two unrelated numbers - and
`squadDps`, which is analytic, did not know. At the late forced state the build
wanted 16,943 shots/s and delivered 7% of the damage the HUD claimed. For one
commit a `deliverableDps` modelled that ceiling so the budget, the HUD and the
scoring would at least stop believing the analytic figure; the honest cost was
that RATE and GUNS became correctly-priced no-ops late, two of six axes dead.

**The author's decision was to remove the ceiling rather than model it**, by
applying the collapse the renderer already does to the simulation. Past
`WEAPON.maxSimShotsPerSecond` (300, a design constant the pool is now sized
FROM, not the reverse) one spawned bullet stands for several real shots and
carries their damage. `Bullets.strike` resolves a bundle meeting a body as the
thin-shot model at one instant: the body consumes exactly `ceil(hp / perShot)`
of the shots, each spends one pierce, the rest fly on untouched. Per bullet that
is a histogram of shots by remaining pierce - a `(pierce + 1)`-entry array, not
entity tracking - consumed from the lowest level up, because the shots that
have hit most bodies are the leading edge and meet the next body first. A
bullet standing for one shot reduces to the old rule exactly, so the regime
below the cap is untouched. `npm run model` asserts the rule case by case.

So there is one `squadDps` again and it is true: the budget, `standing`, the
HUD and `Scoring` all read it, and `deliverableDps` is gone. Measured with
`npm run hud`, delivery is 100% at every forced state up to 124,000 shots/s,
spawns are flat at 300/s and drawn bullets flat at 55.

**Ceiling three was found by that measurement, and nobody knew it existed.**
With the pool no longer refusing, the late state still fired only 81 bullets a
second. `fire` advanced each unit's cooldown once per step, so a unit could
fire at most 60 times a second - 4,560 shot events for a full ring with four
guns, whatever the build wanted. It was invisible behind ceiling two, which sat
lower. A unit now fires every shot it is owed in a step. Below 60 shots/s per
unit that is the same one shot it always was.

**The residual, named rather than smuggled:** a fat bullet is spatially one
column where the thin shots it stands for were spread over a fraction of a
second and across units. Against ordinary bodies that lumps damage; against the
Titan it changes nothing, which is why `singleTargetDps` and the Titan budget
are untouched. The difficulty budget carries no overkill factor because the
bundle wastes at most one shot per body, which is what a thin stream wastes.
Whether the late game past these ceilings is any GOOD is what `npm run from`
exists to ask. Its first answer, twelve runs across four injected states from
1e5 to 1e10 DPS: every ceiling is gone in play, peak power reaches 500,000
with the ring in its second palette cycle, and **every late run ends by a
Titan landing**. Those runs were first read as "the bot survives the first
Titan it meets and dies to the second"; the clock says otherwise - each death
sits at exactly the second the FIRST Titan crossed the line - and the section
below says why no bot could have killed it.

### The Titan budget, and the two multipliers hiding in it

**The finding, from real play:** a player at ~1.1 of par, also dodging and
taking gates, got the first Titan to 75% of its HP before it landed. The
budget said 0.9 of par kills it over 75% of its descent. The constants were
not the problem; three things sat between them and the game:

- **The wave's `hpMult` was applied to the boss.** `Enemies.spawn` scales
  every body by the throttle's `hpMult` to spend the pressure budget, and the
  Titan was spawned through the same path with its deadline budget passed as
  a further scale - so its HP was `titanHp x hpMult`. At wave 5 that is a
  small factor; by the wave-20 Titan it is thousands, which is why every
  `npm run from` run died to the first boss it met. The boss now spawns with
  ABSOLUTE HP (`absoluteHp` on `spawn`), and `npm run model` asserts the
  budget is reached at exactly `bossKillPar x bossKillDistance` of the
  descent with no dependence on the wave.
- **Armor was not in the budget.** The Titan has `armor: 0.35`, which
  `armorAgainst` applies to every hit, so 1.54x the budgeted damage had to be
  fired. `titanHp` now takes the armor and budgets DELIVERED damage.
- **The firing column was ~170px wide against a 72px boss.** Units fired from
  their own slots (a 96px formation) and extra guns spread 72px more around
  each. A perfectly placed squad landed about half its shots. Every shot now
  spawns inside `WEAPON.columnWidth`, the Titan's diameter: the unit's offset
  from the squad centre is scaled down from `FORMATION_HALF_WIDTH`, and the
  guns spread `WEAPON.gunSpread` inside that. `npm run model` fails if the
  column is ever wider than the boss. This is a balance change everywhere,
  not only against the boss - the stream is a beam rather than a curtain -
  and `notes.md` records it as the intent.

**A fourth was found by the instrument built to check the other three.** With
the column, the armor and the `hpMult` fixed, `npm run titan` still reported a
parked squad killing the boss at 20% of its descent against a budgeted 27% -
a delivery of 1.3, at pierce 1, on every seed at 1e5 and 1e8 DPS, and about
1.0 at pierce 0. A piercing bullet had no re-hit guard: `collide` charged it
against every body it overlapped on every step, and a bullet crosses a Titan
in about five steps, so one pierce-1 shot struck the boss twice - 2 hits
against the 1.5x the fixed-q model prices pierce at, which is exactly 1.33.
`Bullet.struck` now records the bodies a bullet has met and `collide` skips
them: one encounter per body, which is what `strike` already resolves at one
instant. It moves the probe regime too (a two-hit shot was hitting ordinary
bodies as well, wherever a body was wider than a step of travel), so the
before/after `npm run balance` pair is in `RESTART.md`.

With those four gone, `bossKillDistance` is now the only thing the boss's
difficulty is made of, and it came down from 0.75 to **0.3** as the author's
next value to feel out. The distance is measured to `ARENA.breachY`, the line
that actually ends the run, not to the lane line.

### Legibility must stay difficulty-neutral, and once did not

`notes.md` says of the legibility axis: "No mechanic changes — only how hard the
arithmetic is." That is a claim about the MEAN of each tier's root table, and it
was false. The original first tier, `[1.05, 1.1, 1.2, 1.3, 1.4, 1.5]`, bunches
low: 1.32% under the ladders on the arithmetic mean and 1.48% on the geometric
one — **about 55% less power over thirty offers**, because bonuses multiply.

So escalating legibility was quietly escalating strength, and hard mode, which
starts a tier in, was handing out bigger bonuses rather than harder sums.

**The first repair was not enough, and that is the more useful half of the
story.** Matching the ARITHMETIC mean left 0.26% per draw on the geometric one —
still 7.5% over a run. A table spread toward its extremes has a lower geometric
mean at the same average, and the geometric mean is the one that governs when
draws compound. The tier is now `[1.05, 1.15, 1.25, 1.3, 1.4, 1.5]`, which
matches on both, and `npm run model` checks both for every tier and fails past
0.5% per draw.

Worth generalising twice over: **any content table indexed by difficulty needs
its mean checked, not just its range** — the range was fixed, and documented as
deliberately fixed, which is exactly what made the skew invisible. And **check
the mean that matches how the quantity combines.** An average is the wrong
summary for anything that multiplies.

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

**The ladder has no last row.** Thresholds double per rank forever
(`tierThreshold(n) = 2^n`), and damage and fire rate continue past the twelve
authored rows at the per-doubling ratio extracted from those rows (x1.80 and
x1.08). The authored table is one CYCLE of the palette: row 12 wears Grey
again, row 20 Gold again, and the cycle is deliberately unmarked - what has to
read is the contrast between one rung and the next, and cycle-2 Gold looking
like cycle-1 Gold is the author's call. `tierRow(n)` is the only way to get a
row; nothing may index `TIERS` by rank.

That is the second time this bug has been fixed and the reason the fix is now
structural. The ladder once saturated at red (608 power) and every army bonus
above it was a measured no-op; adding six prestige ranks moved the cap to
2048 x 19 = 38,912 rather than removing it. `SQUAD.maxPower` is therefore no
longer derived from the table - it is an OVERFLOW GUARD at 1e15, chosen so
`unitShares`'s `floor` and `%` stay exact (2^53 is the real line), and
`npm run model` asserts the army bonus is worth the same ~19% at 1e12 power as
at 19.

**Damage and fire rate interpolate geometrically between rows rather than
stepping at them** — bonus magnitudes are drawn from `[1.05, 1.50]` and
thresholds double, so a stepped ladder would make a `×1.2 ARMY` worth nothing
most of the time. The tier row is the visible rank; the stats are continuous in
power.

## The bullet stream is collapsed for legibility, and the simulation must not see it

**The finding, from real play:** at high GUNS and RATE the stream becomes a
solid mass and it is visually impossible to follow what is going on. The
`hud-late` screenshot before this landed is six solid cream bars.

The fix is the ring cap's answer applied to bullets. The renderer draws a
bounded subset of the SPAWNED stream - `RENDER.maxVisibleShotsPerSecond`, 60,
which is roughly the on-screen bullet count - and tints each drawn bullet by
how many real shots it stands for, on **the shirt ladder from `data/tiers.ts`**.

**There are now two collapses stacked, and they must stay distinguishable in
the code.** The SIMULATION bundles real shots into spawned bullets past
`WEAPON.maxSimShotsPerSecond` (K shots per bullet; see the three-ceilings
section above - this one changes what is hit and is deliberate balance). The
RENDERER then draws one in M of those (this one changes nothing). They are two
Bresenham strides in `GameScene.fire` with separate state - `simCredit` and
`drawCredit` - and the tint encodes **K x M**, real shots per drawn bullet.
Encoding M alone read wrong past the sim ceiling, where every drawn bullet was
already several shots before the renderer thinned it. Like the shirts, the
bullet ladder cycles rather than saturating. That
ladder is already the game's vocabulary for "this thing stands for more than it
looks like", so a player who has learned that a red unit carries 32 power reads
an orange bullet as heavy fire without learning anything new. Tier 0 stays the
cream a bullet has always been, because below density 2 nothing is being
collapsed.

Three properties are load-bearing:

- **It is rendering and nothing else.** `Bullet.drawn` and `Bullet.density` are
  set at spawn and read only by `renderBullets`. Every bullet still flies,
  collides and does damage whether or not it is drawn.
- **The subset is chosen by a Bresenham stride, not by the RNG.** Consuming a
  seeded number here would shift the entire gameplay stream and turn a rendering
  knob into a balance knob. It is also chosen once at spawn rather than per
  frame, so a bullet does not flicker on its way up the screen.
- **The render stride is read off the SPAWN rate**, `min(shotsPerSecond,
  maxSimShotsPerSecond)`, not the rate the build asks for. Reading the intended
  rate once put a density of x212 on the late state and left FOUR bullets on
  screen, because the shots it was dividing by were never spawned. Drawn count
  is flat at ~55 from the earliest state to the latest, which is the property
  that was wanted.

**`npm run neutral` is what keeps this honest.** Measured on the change that
introduced it: five seeds, ends identical on all five (93.8s / 57.9s / 103.2s /
124s / 54.8s, same wave, kills, decisions, tally and par on each). That is a
stronger claim than the sweep can make, and the sweep was the verification
originally asked for.

## Collision is bespoke, not Arcade or Matter

Every interaction is circle-vs-circle with no gravity, stacking, or resting
contact — the case where a physics library costs more than it gives. Two guards
matter and are in place:

- The step is a fixed 1/60s (`SIM.step`), so fast bullets cannot tunnel through
  enemies on a slow frame - and, unlike the clamped real delta this replaced,
  the collision geometry resolves identically on every repeat of a seed.
- Bullet-vs-enemy goes through the uniform `Grid` broad-phase, never a nested
  loop, and each contact is resolved by `Bullets.strike`, which charges a body
  exactly the shots in the bullet's bundle it would have taken.
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
