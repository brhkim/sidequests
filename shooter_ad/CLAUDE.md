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
npm run moments    # forces every feedback moment and photographs it mid-animation
npm run matchcode  # round-trips share codes; pure logic, fast
npm run behaviour  # per-enemy movement signatures, shield taper, enemy fire
npm run pressure   # sweeps the two knobs that set how hard ordinary enemies are
npm run neutral    # proves a change was RENDERING-ONLY, against a reference build
npm run from       # plays real runs from an INJECTED late-game state, par equal to it
npm run titan      # parks a squad under the boss and reports where on its descent it died
npm run roster     # photographs every enemy type, the cage, every gun's volley, hits and kills
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

`npm run moments` photographs every feedback moment mid-animation - the pick
wash at each grade, a MISS, a breach, a contact, a volley of fire, a rescue, a
wave clear, the Titan's warning and its bar, and the death beat at 250ms and
900ms. Each is FORCED (a body moved into the ring, a one-hit cage dropped into
the column, the wave clock zeroed) rather than waited for, and it asserts the
expected text is on screen and that the end screen is held back for the beat.
Stills are not motion; look at them, and read `npm run neutral` beside them,
because a feedback change that reached the simulation would pass this.

**HUD and feedback, as built.** `UIScene` draws the rail, the strip
(directly beneath the rail since 2026-09-20 - `BonusStrip.TOP` is
`RAIL_HEIGHT`, `STRIP_HEIGHT` 94 - because on a phone the thumb covered it
at the bottom; the pause button sits in the rail's right-hand
`RAIL_PAUSE_WIDTH` and the lane and breach line moved down 88px with it in
0.7, so the field is as tall as it was), the pause button and the three
screens, and dispatches the `moment` stream to
`hud/EdgeFlash` (damage, at the screen edges, sized by `share`),
`hud/BossBar` (the Titan's HP under the rail from `HudPayload.titan`) and
`hud/WaveBanner`. Field-space feedback is `scenes/fx/FieldFx` inside
`render/FieldRender`: the grade wash (`PERFECT` / `GOOD` / `BAD`, or `RISK` for a MOVE / TIME / SENSE pick, in
the card's own footprint, held then lifted - the one authored motion), `MISS`
at the lane line, `+N ARMY` over a rescue, `-N` at a contact, and the death
dim. The `toast` string event and the 420ms halo are gone. Gate labels and
the SENSE tag sit at depth 15, above the squad's stream; `render/GateCards`
owns the cards, and draws each label as two lines - the magnitude (`×1.05`,
`+2`) at 26px over the axis word (`DMG`, `PIERCE`) at 14px, split at the
label's last space (`+SENSE` is `+` over `SENSE`) - because from wave 5
dead space narrows the card to as little as 100px. A magnitude wider than
the card (`+1840%` is 121px at 26px) is scaled down to fit rather than the
whole ladder being sized for the rare case. `type.label` is unchanged; the
split is display only. Every tappable line on a screen has a Rectangle hit bar of
at least 44px, and the end screen restarts only from `REPLAY_BUTTON`, which
`GameScene.bindInput` hit-tests - a tap anywhere else leaves the shareable
screenshot alone. The pause screen's SOUND line emits `mutetoggle` and
follows the `muted` answer; it never asserts a state audio is not in.

**The three screens are built from the gate card** (impeccable, 2026-09-20,
code-led; rendering only, no `systems/` change). `hud/CardTile.ts` is the
gate card off the field - roof, tinted body, stroke, magnitude over axis
word, the field's white L-brackets as the selection mark, drawn pips for
SENSE - and `cardButton` is the same shape as every primary action (START
MATCH, RESUME, REPLAY THIS MATCH). `StartScreen` is a first wave: a demo
offer of three real cards descends on a 2.6s loop (a scene tween, never the
simulation), the squad stands on the field's own ground band at the lane
from the real textures, and the pitch is the author's verbatim.
`PauseBonuses` keeps the ruler and shows eight tiles in DPS order then the
RISK three with one tap-to-read line beneath (it opens on ARMY); the DPS ·
PAR line takes `standingColor`, exported from `TopRail`. `EndScreen`'s
tally is five card footprints in the grade colours and the waves headline
counts up (a tween on the UI scene's clock, after the run is over). The
direction contract is `.impeccable/surfaces/src-scenes-hud-startscreen-ts.md`;
the finish review's verdict was ship after one fix round. The instrument
anchors (`START MATCH`, `enter a code`, `new match`, `tap to change
difficulty`, `RESUME`, `RESTART`, `DETAILS`, `REPLAY THIS MATCH`, `or start
a new match`) are unchanged; `npm run endscreen` presses them all.

**Finish review** (impeccable, end of the 2026-09-19 session; rendering
only, `npm run neutral` identical on 5/5 seeds). It changed: the rail
backing and the pause button to 0.96 alpha, what the strip already used,
because the stream and a Runner read through DPS and PAR; OVERRUN / THE
TITAN LANDED to a 28px untracked heading, the step PAUSED uses, instead of
a tracked kicker over the 112px number; the SENSE mark to an 8px bar with
an alpha floor of 0.8, a 14px tag on a 64x22 backing and a white 2px
stroke on the marked card (the targeted card keeps its brackets, so answer
and target never look alike); the Grunt's legs, the Bomber's fuse and
ember and the Spitter's tube and mouth, so those three read by silhouette
at 50% (radii untouched, appendages within a quarter of r); the Lancer to
indigo `0x6a5acd`, off the enemy-bullet magenta; pause notes to 13px with
an alpha floor of 0.75 and the VALUE dimming on unheld rows; the coloured
side stripes on strip cells and pause rows to 1px hairlines (the label is
already in the axis colour); the boss bar to a 6px full-width bar directly
under the standing bar with a small TITAN tag, off the offer at the head
of its descent (the warning band keeps its row for 1.2s); one scale on the
three screens (code 40, button 300x56, label 22, link 15); MISS 60px above
the lane line, clear of the ring's heads; the end screen's two secondary
captions to Small, untracked; the start version at 820; the DETAILS answer
line as the one bright, bold line; ARMY-cell floats at 18px. The one
review item NOT taken: the end screen keeps waves survived as its headline
with the decision score beneath it, which is the author's intent in
`notes.md` and is now recorded in `PRODUCT.md`.

`npm run matchcode` round-trips share codes, including every 32-bit boundary and
the ways a person mistypes one off a screenshot. A sharing code that loses a bit
is worse than no sharing: two people compare scores on what they believe is one
match, and nothing on screen says otherwise.

`npm run behaviour` is the instrument for the enemy roster. `verify` proves the
game boots and `balance` proves it is survivable; neither can see nine types
moving identically, which is a bug this project actually shipped. It spawns a
cohort of each type directly - the bot does not reliably survive to wave 8 - and
prints lateral path length, backward travel, direction changes, peak speed and
net progress per type, then checks that retreat stays bounded, that the
Shielder's armour really is directional, and that enemy guns land damage on the
squad. It samples wall-clock frames, so figures wobble a few percent per run; it
measures movement, not whether that movement is any fun.

`npm run balance` plays several fixed seeds and prints the series. Use it before
and after any balance change. Its footer prints the three ways the army loses
power per minute - `contactLoss`, `breachLoss`, `fireLoss` in the `stats`
registry, which `verify`, `from`, `titan` and `neutral` also read - and, with
every row of `npm run from`, the **pierce instrument**: `hitsPerLanding` (bodies met per shot that
met anything, cumulative over the run) beside the multiplier the build is
priced at, and `landed`, the share of the stream that met anything at all. A
claim well above the measurement means par and the player are both being
credited for damage that does not arrive; the linear price was checked against
it the day it landed (see "Pierce is linear" below). `PROBE_SECONDS=240 PROBE_SEEDS=1,2,3
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

This table predates contact damage (see "Contact damage" below); the bot now
walks into what it does not kill and every survival here is from a game that
no longer ships.

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

**Simulation events.** `systems/SimEvents.ts` is the one typed stream of what
a step DID - `kill`, `contact`, `breach`, `fire`, `pick`, `miss`, `rescue`,
`wave`, `titan` (arrive / volley / down), `sense`, `over` - with
positions, costs and the cost's share of the army before the charge.
`GameScene` pushes into it only inside `step`, and the top of `render()`
drains it and emits the whole array once per frame as the `moment` game
event, so sprites, HUD feedback and audio all read one account of the same
steps rather than each inferring its own from state. The rule that keeps it
off the determinism surface: **nothing in `systems/` reads the queue**, and
nothing that consumes `moment` may feed the simulation. `npm run repeat` and
`npm run neutral` would both miss a consumer that did, because a game with a
feedback loop in it is still deterministic.

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

### Scoring prices DPS and nothing else; MOVE, TIME and SENSE are RISK

`x MOVE`, `+TIME` and `+SENSE` change no damage number, and `scoreOffer`
prices each at **exactly zero**: `progressValue` is `squadDps`, full stop.
`RISK_AXES` in config names the three. For two sessions they were priced
through an access factor (`1 - w / (1 + reach)`) and a sense factor so that
par would sometimes take one; the author's rule (`notes.md`, "RISK: the
three axes par never takes") replaced that, and `SCORING`, `reach`,
`accessFactor` and `senseFactor` are deleted rather than left at zero weight.

What follows, and `npm run model` asserts each:

- **Par never takes one** beside a damage option. In an all-risk offer
  (0.17% of offers over 200 modelled runs) every option scores zero and the
  tie-break picks; that costs par nothing.
- **A risk pick ranks last** (`pickRank` 1) beside any damage option, and an
  all-risk offer ties at rank 0.
- **The player is told RISK, not graded.** `DecisionLog.resolve` returns the
  `Decision`, whose `risk` flag (`Scoring.isRiskPick`) `GameScene` turns
  into `grade: 'risk'` on the `pick` event; `GRADE_COLOR.risk` is lavender
  `0xc9a7ff`, off every axis colour, and `GRADE_WORD.risk` is `RISK`. The
  wash, the strip flash and the `pickRisk` cue (a rising tritone) all read
  the same grade.
- **`fractionOfOptimal` counts it as no growth**: delta is zero. The gamble
  is real and the percentage says so.
- **`tally` has five buckets** - `top / mid / low / risk / miss` - and the
  end screen shows all five. A miss is no longer folded into BAD.

`Difficulty` budgets against raw `squadDps` as it always did; with the
factors gone, par's valuation and the budget are the same number.

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

### Dead space is the fourth judgment lever

From wave 5 (judgment wave) each gate is narrower than its lane, and the band
between neighbours belongs to no option: `GATES.deadSpace` is `{ fromWave: 4,
perWave: 6, max: 72 }`, read through `Progression.gateDeadSpace(wave)` beside
`waveGateSpeedMult`, so a 180px lane holds a 174px gate at wave 5, 144px on
the second Titan at wave 10, and 108px from wave 16 on - the leader must then
be within ±54px of a card's centre. It keys off `judgmentWave` like speed and
legibility, so hard mode starts at 12px and caps at real wave 11. The width
IS the hit test (`checkGates` and `FieldRender.findTarget` both read
`g.width`) and the card is drawn exactly as wide as it hits; `GATES.gap` is
the drawn inset on top of that, so what the eye sees as a gap is dead space
plus 8px. `GATES.minWidth` (100) floors the width whatever the config asks,
and `npm run model` fails if `max` would ever breach it.

Why it exists: past the point where the sum is hard and the time is short,
the author wants the pick to also cost precision of movement through the
noise of a late wave, and to be MISSABLE. That was once deliberately removed
- a gap at wave 1 turned a missed offer into a geometry accident - and it
returns as a curve rather than a constant for exactly that reason. `MISS` at
the lane line is now reachable in play, and the word lands on the option the
squad was nearest.

It is NOT priced by `reach`, and that is acceptable: reach is lane widths of
travel per descent, and dead space narrows the target inside the lane rather
than moving it. Pricing the precision cost would mean pricing the player's
hand, which `scoreOffer` cannot see - par is a little generous late in the
same way it is about bullets the player has to dodge. The bot steers to a
card's exact x, so `npm run balance` barely feels it; a human will.

`GATES.height` grew from 64 to 88 with it, to hold the two-line label at the
narrowest width. That widened the vertical hit window by 24px of descent
(timing, not precision) and lengthened `gateDescentSeconds` by 24px worth,
which `reach` reads - so par's access pricing moved by a hair and the change
is NOT render-neutral; version 0.5. `npm run model` prints the whole curve
per wave under "the judgment curve" for both modes, Titan waves marked.

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
below says why no bot could have killed it. Re-run at 1e5 after that section's
fixes, the same bot passes the wave-20 and wave-25 Titans and dies to the
wave-30 one at standing 0.22 to 0.33; one seed collapsed to attrition first.
The figures are in `RESTART.md`, Part D.

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
  column is ever wider than the boss's hit radius (`radius + bulletRadius`).
  This is a balance change everywhere, not only against the boss - the stream
  is a beam rather than a curtain - and `notes.md` records it as the intent.
  It is **83px** now, 72 widened by 15% after play, and the Titan's radius went
  36 to 38 so the invariant holds; and it is centred on the DRAWN leader
  (`units[0].x`) rather than `squad.x`, because units ease toward their slots
  and under a moving finger the ring trails the centre by ~18px, so the beam
  left the air beside the character. Parked, the two are one point, and
  `npm run titan` reads a median delivery of 1.00 either way.

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
instant. With the guard, `npm run titan` reads a median delivery of **0.98**
over nine kills (0.94 to 1.23 at pierce 0, 0.80 to 1.01 at pierce 1), so the
budget's sentence is now true of the shipped game.

It moves the probe regime too - a two-hit shot was hitting ordinary bodies as
well, wherever a body was wider than a step of travel, and the analytic budget
never credited the second hit. This is the first change on the branch the
probe can see. `npm run balance`, seeds 1-5, skill 0.7, before on a snapshot
of the parent commit and after with the guard and the 72px column:

| | survival | median | optimal | standing | breach/min |
| --- | --- | --- | --- | --- | --- |
| before | 54.8 / 57.9 / 93.8 / 103.2 / 124s | 93.8s | 57% | 0.70 | 26.1 |
| after | 54.4 / 59.4 / 78.1 / 93.0 / 101.5s | 78.1s | 63% | 0.55 | 25.2 |

Three seeds moved under two seconds; two shortened by 16s and 31s. Read the
direction and not the size, and note that the pair cannot separate the guard
from the column, which landed in the same commit. The sweep table above
predates this pair and is stale by that much. This pair in turn predates
contact damage, and so do the Titan deliveries in the paragraph above it.

With those four gone, `bossKillDistance` is now the only thing the boss's
difficulty is made of. It came down from 0.75 to 0.3 as the author's value to
feel out, and after play went to **0.36** - 20% more HP, linear in the
distance. Rescue cages read the same budget (`CAGE.hpTitanFraction`). The distance is measured to `ARENA.breachY`, the line
that actually ends the run, not to the lane line.

### Pierce is linear, and the price is measured against the board

`pierceMultiplier` is `1 + q x P`, q = 0.5. It was the geometric series
`1 + q + ... + q^P`, which saturates at 2x and made pierce a dead axis by the
third pick - no way of drawing `+N PIERCE` could revive it - so at the
author's request the compounding was dropped: pierce 1 is still exactly 1.5x,
and each level adds the same half a hit. `notes.md` carries the argument (a
dense late column is the linear regime anyway). What made it safe to ship was
building the instrument first: `GameScene.collide` counts shots charged
against bodies and shots meeting their FIRST body (the top level of a
bullet's bundle only ever loses shots), and publishes `hitsPerLanding` and
`landed`. Read on the day: pierce-1 bots early measured 1.03 to 1.27 against
1.5 (the board is sparse; the price is generous); from wave 18 on, 2.3 to 2.75
against 2.0 to 2.5 (the price is under the truth). A price above the
measurement late would have meant par budgeting enemies against damage nobody
delivers, which is the failure `deliverableDps` once existed for.

### `+SENSE` is a roll at spawn and a mark computed live

`Gates.spawnOffer` draws ONE extra number from the seeded generator per offer,
always, whatever sense is held, and compares it with `senseChance(sense)`
(25 / 50 / 75% at one, two, three held; the author raised it from 25 / 40 /
50 in 0.7 because SENSE is a RISK axis and the pick has to pay for itself) -
so the stream advances identically on every run of a seed and a player's
sense level cannot shift the enemies and offers that follow. That decides
whether the offer is *sensed*. Which of its three options wears the mark is
NOT stored: `renderGates` asks `scoreLiveGates` every frame, and the option
that is best against the player's state right now is the one ringed and
captioned. If taking the previous gate changes the answer, the mark moves,
and at arrival it is the option the `DecisionLog` will grade best - the two
cannot disagree because they are one call. The pulse reads the simulated
clock for its phase and touches nothing.

Sense is a RISK axis: priced at zero, never in the difficulty budget, never
taken by par beside a damage option (see "Scoring prices DPS and nothing
else"). It is capped by the length of `SENSE.chance`, filtered out of the
candidate pool at the cap (`rollOffer`), and the rail draws it as pips.

### A match is re-seedable, and a restart replays it

`GameScene.rng` is now one level of indirection over `rngImpl`. Every system
holds `rng`; `reseed()` swaps `rngImpl` for `mulberry32(seed)` and rebuilds
the squad (whose constructor draws the first unit's jitter, which must be the
new stream's first draw). `restart()` calls it, so "tap to replay this match"
replays the match - it used to let the stream carry on under the old code,
and no code on screen could reproduce the run it produced. The start screen's
"enter a code" and "new match" and the end screen's "start a new match" all
go through `matchrequest` / `newmatchrequest` events into the same path. Those
listeners are registered on EVERY page, `?seed=` instrument pages included;
they were once behind the instrument early-return, so the end screen's new
match did nothing on any page a script had opened, and `npm run endscreen`
now presses all of them.

Two Phaser facts this cost an hour: a tappable Text inside a Container was
not reliably hit, so every tappable line now has a fixed Rectangle hit bar
behind it (which also keeps the target still when the label changes length);
and the same tap reaches both scenes' pointer handlers, so nothing may depend
on which runs first - `newmatchrequest` is not gated on `over` for that
reason.

### Legibility drifts in strength, by a measured and accepted amount

`notes.md` once said of the legibility axis: "No mechanic changes — only how
hard the arithmetic is." That is a claim about the MEAN of each tier's root
table, and the original first tier, `[1.05, 1.1, 1.2, 1.3, 1.4, 1.5]`, broke
it: 1.32% under the ladders on the arithmetic mean and 1.48% on the geometric
one — **about 55% less power over thirty offers**, because bonuses multiply.
So escalating legibility was quietly escalating strength, and hard mode,
which starts a tier in, was handing out bigger bonuses rather than harder
sums. For a while every tier was held to the same geometric mean within 0.5%
(`[1.05, 1.15, 1.25, 1.3, 1.4, 1.5]` matched on both means).

**The schedule is now the author's, and it drifts on purpose.** `LEGIBILITY`
in `data/roots.ts` is four tiers at waves 1 / 6 / 11 / 16: `[1.1, 1.25,
1.5]`, the tenths from 1.1, every `.05`, every `.01` (three significant
figures on raw numbers from wave 16, two before). Round tables inside a fixed
[1.05, 1.5] cannot share the ladders' mean: measured against the hundredths,
the tenths sit +1.91% per draw and the first tier +0.38%. The author read
that and accepted it. `npm run model` prints the drift per tier under
"legibility tiers: the drift the author accepted", measures it against the
FINEST tier, and fails past `MEAN_DRIFT` (2.5% per draw) or if the schedule
is not four tiers at those waves - so the drift stays a decision on the
record, and a table drifting further is a new decision.

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
rather than left as another unused case. Non-movement behaviour (`gun`,
`escort`, `splitInto`, `frontArmor`) is now plain optional fields read by
`Enemies.applyTraits`, so combining them is data rather than a new case.
`npm run behaviour` is what keeps this honest. The Healer and its `heal` trait
are gone - the author's call, recorded in `notes.md` under "Enemies have a
hurt box".

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
- Enemy-vs-squad (contact) is an ENDPOINT circle test in `Contact.touching`,
  deliberately not swept: the fastest body moves 3.2px a step (a Splitter's
  dash) against a 34px overlap disc (Runner 9 + unit 8, doubled), the squad
  centre adds at most 4.3px a step at x1 MOVE, and the ring's discs overlap
  each other (spacing 24 < 34), so no body can cross the formation between
  two steps. The sweep exists for 16px-per-step bullets. It is a direct loop
  rather than the `Grid` - under 1,900 distance checks a step at a full ring
  - with an early-out per body on the first unit touched.

Squad damage has three sources: **contact** (`contactLoss`, a body touching
the ring), **breach** (`breachLoss`, a body past `ARENA.breachY` that missed
the ring) and **fire** (`fireLoss`, `ENEMY_FIRE.powerShare` per landing
bullet, 1% floor 1). Contact and breach are one price from one function -
`Contact.contactCost` - and shake the camera hard; fire barely nudges it. A
body reaching you is a failure to kill; fire is a tax on standing still.

### Contact damage

An enemy touching the army charges it and is destroyed doing so. The price is
a SHARE of the army held before the step's charges, floored in whole power,
by the body's `tier` (`CONTACT` in config; the roster names one per type):

| tier | types | share | floor | at 19 | at 100 | at 640 | at 38,912 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| basic | Grunt, Runner | 2% | 1 | 1 | 2 | 12 | 778 |
| medium | Shielder, Spitter, Splitter, Lancer | 4% | 2 | 2 | 4 | 25 | 1,556 |
| large | Brute, Bomber | 6% | 3 | 3 | 6 | 38 | 2,334 |
| titan | Titan | 100% | - | run ends | run ends | run ends | run ends |

A bullet is 1% floor 1 for comparison, so a Basic contact is never cheaper
than a bullet and a Large is three. The share overtakes the floor at 100 /
75 / 67 power. `npm run model` asserts the floors, the shares at the old cap,
the Titan as the whole army, monotonicity over the three ordinary tiers, and
that the roster is nine types with no Healer. The flat table it replaces
(1/1/3/2/2/5/1/2 per type, `EnemyType.damage`, now deleted rather than kept
beside `tier`) went dead the way a flat bullet did: at 640 power a leak cost a
sixth of a percent.

Four rules, each with a reason:

- **Breach costs the same, through the same function.** A body past the line
  beside the ring is the same failure as one that walked into it, and
  `SQUAD.breachLoss` is deleted rather than set to 1: a multiplier on one
  contradicts that, on both is a no-op.
- **Consumed, not killed.** `Enemies.consume` sets `active = false` directly,
  never through `damage`, so a Splitter does not split (three Grunts inside
  the ring would each contact next step), and `onKill` is not called, so no
  `kills++` - standing in the stream would otherwise farm the count.
  `Difficulty.observeSpawn` already credited par with the body at spawn.
  Contact with a cage does nothing.
- **Step order is `collide -> applyContacts -> checkGates -> applyBreaches ->
  applyIncomingFire`.** Bullets first, so a body a shot kills on the same step
  is a kill and never a contact; contacts before breaches, so a body that
  satisfies both on one step (a Grunt at y 862 is 17px from the bottom rank at
  845, inside the 19px it takes to touch) is charged as a contact once.
- **A Titan reaching the army ends the run**, `cause: 'titan'`, on the
  `titan` flag `collectContacts` returns - not on the power reaching zero,
  which at 1 or 2 power the whole-army price would leave numerically below a
  Large's floor. `titanChecks[].landedAt` records where on its descent it
  was consumed, and `npm run titan` prints it: a boss that lands does so ON
  THE SQUAD at roughly 85% of its descent, not at the line.

Contact lands earlier than a breach did. (The figures in this paragraph
were measured at lane 800 / line 862; in 0.7 both moved down 88px to 888 /
950 with the strip's move to the top, and every offset between them is
unchanged.) A full ring's front rank sits at
y ~755 and a lone leader at 800, so a Grunt (r 11) is consumed at y ~736 or
~781 against 862 for the line - 81 to 126px sooner, which is 2.4-3.7s of a
Grunt's descent, 1.5s of a Runner's, 4.7s of a Shielder's, 0.8s of a Bomber's
sprint. Bodies the column used to kill in those seconds are charges now, so
the floors do not make the early game the old game. The probe bot parks under
the stream it is killing and does not step aside, so it pays this at the
highest rate any player would. `npm run verify` passes untouched: wave 1 is
Grunts only, the first spawns at ~0.9s and needs ~24s to reach y 781, so the
first possible contact is at the 24s window's end - the verify stats line
reads `contactLoss: 0, over: false` at 29s simulated, kills 10, wave 2.

**Measured on the day it landed**, before on a snapshot of the parent commit
(`e834edf`) and after, seeds 1-5, skill 0.7. `npm run repeat` reads 0.00%
spread on both builds (seed 1: 44.1s, wave 3, 4 decisions, 86%, 14 kills).

| | survival | median | optimal | standing | contact/min | breach/min | fire/min |
| --- | --- | --- | --- | --- | --- | --- | --- |
| before | 41.6 / 42.9 / 44.1 / 46.6 / 87.2s | 44.1s | 78% | 0.86 | 0.0 | 15.4 | 0.0 |
| after | 41.6 / 42.9 / 44.1 / 46.6 / 87.2s | 44.1s | 78% | 0.86 | 2.6 | 15.4 | 0.0 |

**Survival did not move on any seed, to the decimal**, and `npm run neutral`
against the same snapshot says why while failing as a balance change must:
on every seed `contactLoss + breachLoss` is identical before and after
(10/10, 10/10, 15/15, 8/8, 35/35; seed 4 identical in every field) and only
`kills` differs, by one on seeds 1 and 5. In the regime the probe reaches -
under 75 power, where every price is its floor - a body that walks into the
ring is a body that was going to cross the line two to four seconds later at
the same price, and the bot was not going to kill it in between. Contact
re-labels the failure; it does not yet add to it. That is a statement about
the floors and the bot, not about the share: the probe has never held 100
power, so nothing here has measured the 2% / 4% / 6% regime at all.

`npm run from -- --dps=1e5` (wave 18, power 40, seeds 1-3) is the nearest
instrument to it and still does not reach it - peak power after is 46 to 63,
under every crossover - so what it measures is the floors at a wave-18 spawn
rate, where the difference is how often bodies arrive, not what they cost:

| | survival | contact/min | breach/min | fire/min | standing at end | died |
| --- | --- | --- | --- | --- | --- | --- |
| before | 100.7 / 36.7 / 52.9s | 0 / 0 / 0 | 37.5 / 34.3 / 22.7 | 98.3 / 75.2 / 82.8 | 0.04 / 0.09 / 0.12 | attrition x3 |
| after | 62.4 / 55.9 / 52.0s | 14.4 / 5.4 / 21.9 | 16.3 / 15.0 / 19.6 | 60.6 / 83.7 / 75.0 | 0.10 / 0.06 / 0.06 | attrition x3 |

Contact and breach together run 30 to 41 power a minute against 23 to 38 of
breach alone before; the medians (52.9s to 55.9s) are within one seed's
noise and no run meets a Titan either way. The bot does not step aside, so
this is the highest rate a player would pay.

`npm run titan` is unchanged in what it measures - median delivery **1.00**
over six kills before and after (1.00 / 1.07 / 0.69 / 0.95 / 1.04 / 0.69
before; 1.00 / 1.08 / 0.71 / 0.94 / 1.00 / 0.64 after), and the dps-30 state
still dies to the escorts' fire before the boss arrives on all three seeds.
What the parked squad now pays its escorts is visible: 12-17 power to
contact at 1e5 and 55-131 at 1e8, where before it was 0 - the Runners the
Titan spawns walk into the ring at 2% each instead of crossing the line for 1.
No Titan landed in any instrumented run, so `landedAt` is reported but not
yet observed.

`npm run behaviour` needed one change to its tracker and none to its
assertions: the brute cohort now reaches the parked squad inside the 6s window
(300px of sprint at ~59px/s, where the line was ~7s away), the consumed slot
is refilled at the top of the screen by the wave spawner, and a tracker that
checked only `active` read the same object as an 800px retreat. It now keys
each body on its per-enemy `seed` and stops on the first reused slot.

## Art

Entirely procedural, generated in `BootScene` with `Graphics#generateTexture`
from the modules in `scenes/art/` (`creatures`, `squad`, `projectiles`,
`cage`, and `draw` for the helper). No asset files, nothing to load at
runtime — which is what keeps the build a static folder.
`TextureManager.generate` and the Create palettes were **removed in Phaser
v4**; see `.claude/skills/phaser4-migration/`.

**White with black detail.** Every texture is drawn white with its details -
eyes, seams, mouth slots, outlines - in pure black, at 2x, and shown at
`setScale(0.5)`. Under the default multiply tint white takes the runtime
colour and black stays black, so one texture serves every hue and a 3px seam
stays crisp. Anything needing a SECOND hue (the Shielder's pale plate, the
Bomber's ember, the Spitter's gun tube, the Lancer's trident, the Titan's
eyes) is a separate overlay texture tinted `EnemyType.accent`, one depth
above its body. `accent` is a rendering field and nothing in `systems/`
reads it.

**Radius is simulation; the sprite is fitted to it.** `EnemyType.radius` is
the hit circle and never changes for a drawing. Each creature's box is
`2 * (2r + margin)` with the circle centred; solid mass stays inside it and
only thin appendages cross, by a quarter of r at most (the Runner's nose is
the worst, ~4px). `CREATURE_ART` in `art/creatures.ts` is the table the
renderer reads - body key, accent key, whether it rotates to its travel
(walkers) or stays upright (gun types), whether it is drawn in the Titan
pools, and its one authored motion (the Splitter swells, the Bomber's ember
pulses; nothing else animates). `SpriteRender.renderEnemies` has no per-type
branch; a new creature is a texture and a row.

**Hit feedback is a flash and a bleach, never an alpha fade.** A wounded
body used to fade toward the background and vanish. Now `Enemies.damage`
stamps `hitFlash = e.timer` (its own clock) and `GameScene.collide` stamps
`c.hitFlash = elapsed` on a cage; the renderer draws the body pure white for
`RENDER.hitFlash` (0.07s) after the stamp and otherwise tints it
`RENDER.bleach` (35%) of the way to white at zero HP. The stamp is written
by the simulation and read only by rendering - `grep hitFlash src/systems`
must show the field, the two `-1` initialisers and the one set, nothing
else. Health bars stay for `radius >= 14`.

**Death pops are a fixed budget.** `render/Shards.ts` keeps `RENDER.shardRing`
(96) shard records and one sprite pool; a `kill` event throws
`shardsPerKill` (3; 12 for a Titan) for `shardLife` (0.28s), a `contact`
event throws two dull ones for 0.18s. Past the budget the oldest shard is
overwritten, so a burst never allocates. Spoke angles are phased off the
simulated clock, never the RNG.

**Enemy bullets are darts, not small enemies.** `ebullet` is a black-outlined
teardrop rotated along its velocity, in `COLORS.enemyBullet` (hot magenta -
no body wears it), with a faint copy behind it (`RENDER.bulletTrail`). Squad
bullets stay the cream pill on the tier ladder. `ENEMY_FIRE.radius` is
unchanged; the dart is 8x16 on screen around a 5px hit circle.

**Depth map** (UX and HUD layers omitted; see their sections):

| depth | what |
| --- | --- |
| 8 / 9 | Titan body / accent (`bigPool`) |
| 10 / 11 | enemy bodies / accents |
| 12 / 13 | cage inmates / cage bars |
| 12 | squad bullets |
| 14 | shards |
| 18 | enemy overlay (health bars) - above the bodies it annotates |
| 20 / 21 | squad body / head (`head-lead` for slot 0, with a visor) |
| 22 / 23 | enemy bullet trail / enemy bullets - above the squad they hit |

**`npm run roster`** photographs the set: `roster.png` (one of each type in
a row, the Titan, a cage, every gun's volley, the squad at `hud-mid`),
`roster-hit.png` (bodies flashing, bodies bleached, two kills popping, a
contact mark, a flashing cage) and `roster-late.png` (`hud-late`).
`ROSTER_SCALE=3` adds `*-zoom.png` crops at 3x. It asserts only that nothing
errored; the two questions to put to the stills are whether every type can
be named from silhouette with colour ignored, and whether any enemy bullet
could be taken for a Runner.

### Analytics

`src/analytics/Analytics.ts` is GoatCounter, installed from `main.ts` the
way audio is: it reads `game.events` and nothing else, no scene knows it
exists, and nothing in it can reach the simulation. `ANALYTICS.site` in
config is the GoatCounter site code (public by nature; empty means OFF, and
it ships empty until the author creates the site). Instrument pages
(`?seed=`) never send. It counts a pageview, then three events per run as
paths - `run/start`, `run/end/<mode>/wave-NN` (title: the cause), and
`run/time/<bucket>` from the `elapsed` the end payload now carries (under
30s, 30s-1m, 1-2m, 2-4m, 4-8m, over 8m) - because GoatCounter stores counts,
not values. Every call is in try/catch; a blocked script costs nothing.

### Audio

Sound follows the art's rule: no files, everything synthesised. It is raw
WebAudio in `src/audio/`, and Phaser's sound manager is switched off
(`audio: { noAudio: true }` in `main.ts`, accepted by the 4.2.1 types and
honoured at runtime) so there is exactly one context.

```
src/audio/
  cues.ts         the palette: CueName -> recipe (parts, level, priority, cap, bundle rule)
  synth.ts        recipe -> nodes on ANY BaseAudioContext; ADSR; fixed-seed noise; master chain
  collapse.ts     the Bundler: N events in a window become ONE voice encoding N
  Audio.ts        context lifecycle, unlock, buses -> duck -> master -> compressor, voice budget, mute
  AudioEvents.ts  the game.events subscription, event -> cue mapping, Titan heartbeat, window.__audio
```

**It reads `game.events` and nothing else.** `installAudio(game.events,
location.search)` is called once from `main.ts`; no scene file knows audio
exists. It subscribes to `moment` (the `SimEvent[]` GameScene drains each
frame), `hud` (its per-frame tick), `paused`, `restart`, `gameover`,
`startmatch` and `mutetoggle`, and emits `muted, boolean` in answer to the
last. Nothing in `systems/` imports `audio/`; `npm run audio` greps for that,
for `Math.random` and for `Rng` in `src/audio/`. Variation (the kill's +-3%
pitch jitter) comes from a hashed counter, so a replay sounds the same.
The bundler's clock is `performance.now()`, which audio may read because
nothing it does can reach the simulation - `npm run repeat` and `npm run
neutral` are what keep that true.

**Mapping.** `kill` -> `kill` (bundled; a Titan kill is `titan down` ->
`titanKill`); `contact` / `breach` -> the same-named cues, level rising with
`share`; `fire` with hits -> `fireHit`; `pick` -> `pickPerfect` / `pickGood`
/ `pickBad` / `pickRisk` by grade; `miss`, `rescue`, `wave`, `sense` -> the
same names; `titan arrive` -> `titanArrive` and a heartbeat (`titanPulse`)
that quickens over 20 s, since audio cannot see the descent; `titan volley`
-> `titanVolley`, at most every 250 ms; `over` -> `playerDeath` or
`titanLand` by cause; `startmatch` -> `start`; `paused` -> `pause` /
`resume`. `mutetoggle` itself plays nothing.

**The collapse.** Kills, contacts, breaches and fire hits go through the
`Bundler`: a lone event plays at once; inside a 100 ms window (80 / 120 / 60
for the others) further events are tallied and play as ONE voice when it
closes, so the kill voice rate is at most 10/s. A bundle of `n` is one
semitone lower per doubling, 1.5 dB quieter per doubling, and from four
carries a partial an octave down - heavier, never louder. Under 600 kills
2 ms apart the instrument measures 13 voices and 599 bundled.

**Budget.** Twelve voices, per-cue caps (kill/contact/breach/fireHit 2, the
rest 1), priorities `titanLand 100 > playerDeath 95 > titanKill 90 >
titanArrive 85 > breach 70 > pick 65 > rescue 60 > wave 55 >
contact 45 > sense 40 > titanVolley 35 > titanPulse 30 > miss 25 > fireHit
20 > kill 10 > ui 5`. A full mix evicts the lowest priority below the
newcomer or refuses it (`stats.refused`). Breach and the Titan cues duck the
kill and hit buses 6 dB for 300 ms; the kill bus eases to -6 dB past 30
kills/s. Voices are released by wall clock, not `onended`, so a context that
never runs cannot leak them.

**Unlock and safety.** The context is created inside the first pointerdown,
touchend or keydown (capture listeners on `window`; the START MATCH tap is
the usual one) and never before. `?seed=` pages - every instrument - create
NO context unless they add `audio=1`; `?mute=1` starts muted; the mute
choice persists in `localStorage['shooter_ad.audio.muted']`. Every WebAudio
and storage call is in try/catch and counts into `stats.failures`; nothing
in `src/audio/` logs. `npm run verify` prints
`audio: state=running cues=N ... failures=0` and fails on any failure; the
headless context does reach `running` after the real click.

**`npm run audio`** is the instrument: it plays every cue live and asserts
nodes were created, stresses the bundler, drains on `gameover`, then renders
every cue offline through a clone of the master chain to
`.verify/audio/<cue>.wav`, `palette.wav` and `kill-bundle-N.wav`, printing
duration, peak, RMS, dominant frequency and the share of energy above 200 Hz
(a power share: a 55 Hz cue reads ~0% even with its partials present). Every
cue must peak between -40 and -1 dBFS. `window.__audio` on every page has
`play` (the event path, with a synthetic clock `t`), `voice` (direct),
`tick`, `render`, `cues`, `stats`, `setMuted`, `stopAll`, `voicesOf`.

## Extending content

- **Enemy**: append to `ENEMIES` in `data/enemies.ts` with a `tier` (what it
  costs on contact - see `CONTACT`). Movement is a `motion` union with one
  case each in `systems/EnemyMotion.ts`; only genuinely new movement needs a
  case there, and every case is used by at least one of the nine types.
- **Bonus**: append to `CANDIDATES` in `data/gates.ts` plus one case in the
  progression model. Magnitudes are never hardcoded — every bonus draws from the
  root table in `data/roots.ts` and presents the draw according to its form.
  The discrete axes do too: from `GATES.scaleDiscreteFrom` held, `+N GUNS` and
  `+N PIERCE` are the whole number whose effect is nearest the draw
  (`Progression.discreteAmount`), so `OfferContext` carries `guns`, `pierce`
  and `sense` beside the pools. A bonus that changes no damage number - MOVE,
  TIME, SENSE - is a RISK axis (`RISK_AXES`): priced at zero, never taken by
  par, told RISK when the player takes it; `npm run model` asserts the zero.
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
- **Army growth**: gates and rescue cages, and nothing automatic. Kill
  streaks (`STREAK`) and wave-clear bonuses (`WAVE.clearBonus`) were removed
  at the author's request on 2026-09-20, on both the player's side and par's
  (`Difficulty.observeSpawn` credits par with the kill and nothing else) -
  see `notes.md`, "No automatic army". `SQUAD.startPower` went 1 to 5 with
  it. Any new source must be a choice the player makes.
