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
npm run roster     # photographs every enemy type, the cage, every gun's volley, hits, kills and the pops
npm run rescue     # forces a cage open at seven army sizes; asserts the reward and its label
npm run rail       # forces the HUD's widest and narrowest states; fails if two texts' INK touch
npm run sway       # injects waves 30 / 31 / 36 / 41; asserts the cards sway inside their lane, with grooves
npm run perf       # frame cost at 4x CPU throttle, four injected scenarios: cpu ms, draws, uploads, fill
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

`npm run moments` photographs every feedback moment mid-animation - the
judgment at each grade, a MISS, a breach, a contact, a volley of fire, a rescue, a
wave clear, the Titan's warning and its bar, and the death beat at 250ms and
900ms. Each is FORCED (a body moved into the ring, a one-hit cage dropped into
the column, the wave clock zeroed) rather than waited for, and it asserts the
expected text is on screen and that the end screen is held back for the beat.
Stills are not motion; look at them, and read `npm run neutral` beside them,
because a feedback change that reached the simulation would pass this. Since
the 2026-09-24 redesign it FORCES a BAD too: a `'bad'` bot mode re-reads the
live deltas and takes the unique-worst damage option of an offer that can
grade BAD (the worst of three is not what the game grades BAD - on seed 5 it
graded GOOD), and the probe asserts the word in `moment-pick-bad.png`. Every
grade word is now asserted on screen, not only hoped for.

`npm run perf` is the instrument for the 2026-09-24 performance target (the
author: 60fps with no dropped frames on a 3-4 year old mid-range Android at
wave 41 with a full ring, ECHO and a dense stream). It serves `dist/`,
throttles the CPU 4x through the DevTools protocol (`PERF_THROTTLE`; the
Lighthouse convention for a mid-range phone), injects four scenarios through
`__startOverride` - `early` (wave 1 from the real start), `mid` (wave 16, the
`hud-mid` build), `late` (wave 41, the `hud-late` build plus ECHO 4, SHIELD 3,
SENSE 2 and MOVE 3: the most the renderer can be asked to draw) and `titan`
(the same build on the wave-40 Titan) - steers the ring on a seeded sine
through `__autopilot` so it moves and takes gates, and after a 2.5s warm-up
reports per scenario: **cpu ms a frame** (Phaser's PRE_STEP to POST_RENDER -
simulation, render-list build and GL submission; the number to hold under
budget), rAF frame intervals with the share dropped, **GL draw calls and
texture uploads a frame** (the context's draw and texImage calls, wrapped),
live display objects, and a **fill estimate**: the on-screen area of every
visible textured object in screens' worth of pixels, Graphics counted apart
because they have no cheap bounds (`2.40+3g` reads 2.4 screens plus three
Graphics). `PERF_PROFILE=1` adds the top
functions by self time; `PERF_DIST` measures a snapshot, `PERF_ONLY=late`
one scenario, `PERF_SECONDS` a longer window; stills land in
`.verify/perf-<scenario>.png`.

**What it cannot say.** Headless Chromium draws WebGL on SwiftShader, a CPU
rasteriser, so GPU fill lands on the CPU clock and is inflated against a
phone's GPU, and the clock is one contended machine's. The absolute figures
are a pessimistic CPU-raster proxy: only a before/after pair on the same
machine is a finding, a difference under ~10% needs a second run, and it
never runs beside another Chromium probe. **60fps on a real phone GPU is
unverified** - nothing here has run on one. The fill estimate exists for the
half SwiftShader hides: mobile GPUs are fill-bound, so a change that grows
fill is suspect even when cpu ms holds still. Measured across the redesign,
`late` at 4x, the pre-redesign build against the finished one:

| late, wave 41, 4x | cpu ms/frame med / p95 / p99 | draws/frame | uploads/frame | fill |
| --- | --- | --- | --- | --- |
| before | 10.9 / 21.5 / 23.7 | 18 | 11.1 | - |
| after | ~6.7 / 12.6 / 14.0 | ~12 | 0.1 | ~0.8 screens |

**The eleven uploads were the finding, and no static count could have seen
them.** They were there on an empty field too: every HUD Text re-rasterised
its canvas and re-uploaded its texture every frame, because the rail and the
strip called `setColor` each frame, and a Phaser Text re-renders on
`setColor` as on `setText`, changed or not. HUD text now renders WHITE once
and takes its colour by tint, a vertex attribute (`hud/HudText`); a string is
re-set only when it differs; the kill count re-renders at most at 4Hz; and an
unchanged frame builds no strings at all (`TopRail.update` returns on eight
unchanged payload fields). The draws came down on the HUD, which now draws
only baked Images (18 to 8 a frame in the HUD workstream alone, before the
field and the sprites added theirs), and on the field through one atlas and
one MULTIPLY batch fewer (see "The highway" and "Art" below). Hold the new
figures: a per-frame `setText`, `setColor` or `setStyle` anywhere on screen
shows up here as uploads before it shows up anywhere else.

**HUD and feedback, as built** (restructured in the 2026-09-24 redesign,
inside the same fixed rows: `HUD_ROWS` rail 72 / strip 94 / Titan row 18,
bottom 184, still the spawn line; `hud/HudLayout` holds every coordinate and
`art/ui` bakes a texture to each). `UIScene` draws:

- **The rail** (`hud/TopRail`): WAVE with kills under it | **the duel** |
  SENSE | SHIELD | PAUSE. The duel is the one question the rail exists to
  answer, so it is no longer one column among five: an inset well (`DUEL`,
  x 92 to 306) with YOUR DPS as the biggest figure on the HUD (31px 800,
  tinted the standing colour) at its left and PAR DPS smaller and neutral
  (21px) at its right, over one **tug bar** that splits at `ratio / (1 +
  ratio)` - dead centre is level with par, your colour past it is ahead,
  par's grey past it is behind. `DIFFICULTY.targetFraction` is a notch under
  the bar; crossing it swells the bar once (no continuous pulse). `% PAR`
  and BEST PLAY stay under the figures because nothing may assume the reader
  knows what par is. SENSE is three drawn pips (baked discs, not glyphs) over
  `N% MARKED`; SHIELD is `ready/capacity` over READY. PAUSE is a baked raised
  face with a two-bar glyph over the word at `PAUSE_BUTTON`'s exact geometry,
  drawn by `UIScene` because `GameScene` owns its hit test.
- **The strip** (`hud/BonusStrip`, directly beneath the rail since
  2026-09-20 because on a phone the thumb covered it at the bottom; the lane
  and breach line moved down 88px with it in 0.7): five baked rounded chips
  of UNEQUAL width sized to the late state (`CHIP.widths` 100 / 118 / 118 /
  80 / 80 - DMG and RATE hold `+1.84K%`), pool big and multiplier under it,
  axis-coloured label, all left-aligned on one x per chip, anything wider
  scaled into its chip by `HudText` - `+1.84K%` used to run into `+720%`. A
  held chip wears the note's head, a lit cap and faint wash in its axis
  colour; an unheld chip's face, figures and cap dim to neutral, so colour
  on the strip means "you have this". A change punches the figure
  (`MOTION.punch`, the overshoot capped to the chip's padding) and flashes a
  baked glow in the colour of WHY - the pick's grade, green for army gained,
  red for lost. ARMY's `-N` lands in the chip's always-empty third line.
- **The Titan row** (`hud/BossBar`): its own baked panel, only while a boss
  lives, TITAN tag, a lavender-to-purple 8px fill cropped to HP with a white
  chunk trailing each hit (eased), so damage is seen landing.
- **The stage banner** (`hud/WaveBanner`): three 0.32-alpha lane slabs
  docked at the HUD's bottom edge (`BAND`, y 184 to 228 - it once sat 84px
  deep at y 330, in the decision zone) wipe in lane by lane (`MOTION.wipe`,
  `wipeStagger`), the word snaps in slanted at 32px with a dark stroke, the
  sub-line sits at the band's right end, and the lanes wipe out. WAVE N holds
  400ms. It also carries the Titan warning - TITAN in lavender between
  edges lit the Titan's purple, WAVE N as its sub-line, pulsing twice, for
  `TITAN_WARNING_MS` (1.2s), after which the bar arrives - and TITAN DOWN.
- **Damage** (`hud/EdgeFlash`): a soft baked vignette - one falloff texture
  stretched along four thin edge images, so the empty middle costs no fill
  - whose strength and reach (56 to 160px) scale with the event's `share`,
  tinted breach red, fire orange or loss red, in the UI scene so it does not
  shake.

Every figure on the HUD is a `HudText` (white, tinted, `setText` only on a
changed string, fit by scale); every panel, gradient and shadow is baked once
in `art/ui`. `npm run perf` reads 0.1 uploads a frame and is the check that
it stays so.

Field-space feedback is `scenes/fx/FieldFx` inside `render/FieldRender`.
**The judgment is the signature moment**: on a pick the note flashes in its
own footprint and throws a ring and ten sparks in the grade colour
(`fx/Bursts`: pooled four / four / 48, additive, one depth, the scene clock,
spark directions from a hashed counter), and the grade word - `PERFECT` /
`GOOD` / `BAD`, or `INVEST` for a MOVE / TIME / SENSE / SHIELD pick - punches
in 44px above the note, slanted (Saira italic 800, 30px), 1.7x to 1 with a
Back.out overshoot in `MOTION.snap` (140ms), holds `pickHold`, then lifts 26px
and fades over `pickFade`. From the second PERFECT in a row a `N IN A ROW`
line lands under it; any other grade, a MISS or the run's end resets it. That
count is feedback only, kept in `FieldFx` from `pick` events and read by
nothing - and it is new, awaiting the author's approval (`notes.md`). Then
`MISS` (slanted, 60px over the lane line, clear of the ring's heads), `+N
ARMY` over a rescue, `-N` at a contact (60px over the line, MISS's stroke),
`BLOCK` over an absorbed bullet, and the death beat: the field dims over
`deathBeat`, and a Titan landing flares the fail line. Floating words are
`fx/FloatingLabels`, a pool of six that snap in and rise. The `toast` string
event and the 420ms halo are long gone.

`render/GateCards` owns the notes. Labels, operators and the SENSE caption
sit at depth 15, above the squad's stream (12.5), and each label is two
lines - the magnitude (`1.05`, `2`) at 26px 800 over the axis word (`DMG`,
`PIERCE`) at 14px 600 tracked - split at the label's last space (`+SENSE` is
`+` over `SENSE`), because from wave 10 dead space narrows the card to 83px.
The magnitude's OPERATOR is not typed: `render/Operator` splits it off and
draws `×` or `+` as a baked white glyph of one size and weight (in Saira `×`
is x-height small and read as a speck, and the form is the whole question a
card asks); `GateCards` and the screens' `CardTile` share the split and the
layout. Glyph and figure shrink together to the card's inner width when they
overflow (`+1840%` at 26px) rather than the whole ladder being sized for the
rare case. `type.label` is unchanged; all of this is display only.

Every button's hit area is a fixed `Zone` at least 44px tall, and the end
screen restarts only from `REPLAY_BUTTON`, which `GameScene.bindInput`
hit-tests - a tap anywhere else leaves the shareable screenshot alone (and
REPLAY is deliberately NOT interactive: an interactive one swallowed that
tap). The pause screen's SOUND line emits `mutetoggle` and follows the
`muted` answer; it never asserts a state audio is not in.

**Every control is a card button, and the pause screen has a HOW TO PLAY
page** (2026-09-20, the author's UX round; rebuilt for the highway
2026-09-24). `cardButton` lives in `hud/ScreenButton` (re-exported from
`hud/CardTile`, signature unchanged) and takes a variant, each a baked
rounded face drawn through NineSlice (`art/screens`) with a lit top edge and
a soft offset shadow: `primary` - the one filled action per screen (START
MATCH, RESUME, REPLAY THIS MATCH), a lit face in its colour over a baked
glow, dark ink, the brightest object on the screen; `secondary` - a raised
neutral plate with a ring and the word in the button's colour (link teal
for most); `danger` - the same in red (RESTART). `bind` wires the tap with
hover and a press that scales every part to 0.96 about the centre with a
darker face for 140ms; nothing runs per frame. `segmented` is a row of
secondaries with one lit - its face filled a deep step of its colour, the
ring full, the word `#e8ecf8` (difficulty on the start screen, the three
pause tabs). Every part is a flat object at the button's centre, never a
nested Container, because the probes find a control by its label's
position. `hud/PauseGuide` is twelve topic
buttons and one explanation at a time, in words that do not assume PAR,
RISK or DPS are known; `PauseScreen.show(h, 'guide')` opens the same
screen from the start screen's HOW TO PLAY at depth 65 (over the start
screen; 55 when pausing), with BACK for RESUME and no RESTART. GameScene
publishes one HUD frame in `announceMatch` so that page has the start
state's numbers. The rail reads WAVE | the duel (YOUR DPS against PAR DPS
over the tug bar) | SENSE | SHIELD | PAUSE since the 2026-09-24 redesign
(five unequal columns from 1.1 until then), labels and sub-lines at 13px,
with BEST PLAY under PAR. Instrument anchors moved with the words: ENTER
A CODE, NEW MATCH (start and end), the NORMAL / HARD segments (the lit
one's text is `#e8ecf8`), HOW TO PLAY, BACK; `npm run endscreen` presses
them all and asserts the demo offer changes between passes.

**The three screens are built from the gate card** - the note, since the
highway (impeccable, 2026-09-20, code-led; rebuilt 2026-09-24; rendering
only, no `systems/` change either time). `hud/CardTile.ts` is the field's
note off the field, in the direction contract's anatomy: 9px corners
(`RADIUS.card`), a baked gradient body in the axis colour with a lit cap,
a lighter inner edge, an untinted white gloss over the upper half and a
soft offset shadow, magnitude over axis word with the shared drawn operator
(`render/Operator`), both lines shrunk to fit a late `RATE ×1.02K`, drawn
pips for SENSE. `select` still draws white L-brackets at the tile's bottom
corners on the pause page - the field itself no longer does (see the
receptors, under "The highway") - never a white outline, which is the SENSE
mark. Every screen stands on `hud/ScreenWipe`'s `ScreenBackdrop`: three
opaque lane beds, the highway's own floor, drop in lane by lane each led by a
white-hot edge (`MOTION.wipe`, `wipeStagger`), then the content fades up -
four tweens per entrance, nothing while the screen is up.

`StartScreen` is a first wave on a demo highway: three lanes run down to a
judgment line (y 410) with the squad from the real textures standing on it;
the demo offer (real conversions, a different one each 2.6s pass, a scene
tween, never the simulation) descends at ~73px/s, near the field's wave-1
speed; the note in the squad's lane is taken where it meets the heads - it
swells, bursts and the receptor under the squad lights in its colour - and
the other two run on under the line. The pitch is the author's verbatim.
`PauseBonuses` keeps the ruler and shows ten notes on a 4x3 grid of 120x64
tiles, the six DPS axes over two rows and the INVEST four across the third,
named by a label in the second row's two free slots (`MOVE INVEST` on a
120px tile ran past it), with one tap-to-read line beneath (it opens on
ARMY); the DPS · PAR line takes `standingColor`, exported from `TopRail`.
DETAILS lines were rewritten to fit the measure, and the block shrinks as
one if a late build still overflows. `EndScreen` is a rhythm game's results
screen - see "The end screen's plot, and the word INVEST" below. The
direction contracts are `.impeccable/surfaces/src-scenes-hud-startscreen-ts.md`
(2026-09-20) and, superseding its look, `src-scenes-render-fieldrender-ts.md`
(2026-09-24). The instrument anchors (`START MATCH`, `enter a code`, `new
match`, `tap to change difficulty`, `RESUME`, `RESTART`, `DETAILS`, `REPLAY
THIS MATCH`, `or start a new match`) are unchanged; `npm run endscreen`
presses them all, and since the redesign waits 2600ms (was 900) for the
end screen's entrance to settle before it reads the screen and takes the
still - every assertion unchanged.

**Finish review** (impeccable, end of the 2026-09-19 session; rendering
only, `npm run neutral` identical on 5/5 seeds). *History: the 2026-09-24
highway redesign superseded nearly all of the rendering below (the rail is
opaque, the SENSE mark is a crown, the boss bar has its own row), and what
survives is mostly its silhouette, colour and wording decisions.* It changed: the rail
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

Par takes its pick from it, `DecisionLog` grades the player with it, the
judgment burst colours from it, and the probe bot chooses with it. Two implementations
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

### Scoring prices DPS and nothing else; MOVE, TIME, SENSE and SHIELD are RISK

`x MOVE`, `+TIME`, `+SENSE` and `+SHIELD` change no damage number, and
`scoreOffer` prices each at **exactly zero**: `progressValue` is `squadDps`,
full stop. `RISK_AXES` in config names the four (SHIELD since 1.1). For two sessions they were priced
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
  `0xc9a7ff`, off every axis colour, and `GRADE_WORD.risk` is `INVEST` on
  screen (`RISK` until 1.5). The judgment burst and word, the strip's chip
  flash and the `pickRisk` cue (a rising tritone) all read the same grade.
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
run's first offer therefore descends at wave-6 speed (×1.32) and draws from
the wave-6 root table (the tenths); the finest legibility tier arrives at
real wave 20 instead of 25, dead space caps at 25 instead of 30, gate speed
at 35 instead of 40, and sway begins at 26 instead of 31 (the 1.7 curve).

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
`GATES.maxSpeedMult` (**3.5 at `speedCapWave` 40 since 1.7**, rolling
continuously from wave 2 at a derived ~0.064 a wave; it was 3.25 at 31 and
2.5 at 21 before). Later waves do not hand you a harder sum, they give you
less time to do it in - deliberately separate from enemy pressure, which is
closed-loop against par and never keys off the wave number. `+TIME` divides it
back down for the rest of the run.

Squad movement is rate-limited in `Squad.update`. Under a pointer it used to
assign the finger's x directly, so the squad teleported, travel was free and the
whole movement economy was inert. `SQUAD.moveSpeed` came down from 620 to 260
when the movement bonuses landed, and to **195** in 1.6 (the author: a
quarter off); set it high again and `+MOVE` buys nothing. **MOVE is three
levels since 1.6**: `Upgrades.move` 0 to `MAX_MOVE` (3), `MOVE.mult` in
config the ladder x1 / x1.5 / x2 / x2.5, `Progression.moveMultiplier` the
one reader, `moveSpeed(u)` = base x that. The card is `+MOVE` (form `raw`,
value 1), filtered out of the pool at the cap through `OfferContext.move`
like SENSE, SHIELD and ECHO; `HudPayload` carries `move` and the derived
`moveMult`. `npm run model` asserts all of it.

### Gate sway is the fifth judgment lever

From judgment wave 31 (normal; hard 26) - the bracket after the one in
which dead space reaches `max` at wave 30 (1.7: "introduced in brackets
after the difficulty section of the last width adjustment") - each card
drifts left and right inside its lane. `GATES.sway` is `{ fromWave: 30,
tierWaves: 5, periods: [0.5, 1, 1.5] }`, read through
`Progression.gateSway(wave)` (periods per descent and the amplitude, half
the dead space) and `swayOffset(y, periods, amplitude)` (a sine of the
card's descent progress: centre at spawn, `periods` cycles by the lane
line). `Gates.spawnOffer` fixes a card's `laneX`, `swayPeriods` and
`swayAmplitude` at spawn, clamped so `|x - laneX| + width / 2 <= lane / 2`;
`Gates.update` sets `g.x` from `g.y` every step, so the hit test
(`checkGates`, `findTarget`) and the drawn card are one position. Nothing
here reads the RNG or a clock: `npm run repeat` is 0.00%. Because the pace
is per descent, `+TIME` slows the sway with the fall.

Tiers: 0.5 periods a descent at waves 31-35, 1 at 36-40, 1.5 from 41 on;
peak lateral speed 49 / 109 / 177px/s against the 195px/s squad. The
author's ceiling was "up to 1.5x periods of movement across the whole
length of the screen"; `npm run model` fails if the fastest tier is not
1.5, if a tier starts on the wrong wave, if the amplitude exceeds half the
dead space, if a card is off-centre at spawn or at the line, or if the peak
speed outruns the squad. `render/GateCards` sets a swaying card in a
GROOVE (the 2026-09-24 redesign; a flat grey track before): a recessed
channel the width of the card's whole travel (`g.width + 2 x
swayAmplitude - GATES.gap`, centred on `laneX`), darker than the road, a
faint rail through its middle and a lit stop at each limit, in the highway's
grey rail light only - never an axis colour and never white, so it reads as
the road and not as a fourth option. It sits at depth 2 under the note, fades
in with the card's reveal, and is drawn behind no still card.
`RENDER.gate` in config (`fill`, `roof`, `track`...) describes the flat card
and is no longer read by anything. `npm run sway` injects a late build at
waves 30 / 31 / 36 / 41 and asserts movement (or none), the lane bound and
the groove count per state (the code still calls it `track`), photographing
`sway-NN.png`; its wait predicate guards `g.gates`, because Boot now takes
~70ms longer baking and the probe could read the Game scene before
`create()`.

### Dead space is the fourth judgment lever

From wave 10 (judgment wave) each gate is narrower than its lane, and the
band between neighbours belongs to no option: `GATES.deadSpace` is
`{ fromWave: 9, capWave: 30, max: 97 }` since 1.7, read through
`Progression.gateDeadSpace(wave)` beside `waveGateSpeedMult` - zero through
wave 9, then one linear slope of ~4.62px a wave to 97px at wave 30 and
flat after, so a 180px lane holds a 175px gate at wave 10, 129px on the
fourth Titan at wave 20, and 83px from wave 30 - the leader must then be
within ±41px of a card's centre. It keys off `judgmentWave` like speed and
legibility, so hard mode starts it at real wave 5 and caps at 25. `max` is
what `minWidth` (80) allows: the axis word needs ~76px and the magnitude
already shrinks. `npm run model` asserts the zero through `fromWave`, the
constant step, the cap at `capWave` and that `max` never breaches
`minWidth`. History: 6px a wave from wave 5 to 72px at 16 (0.5), a second
2.5px stage to 97px at 26 (0.8), the author's one slope from 10 to 30
(1.7). The width
IS the hit test (`checkGates` and `FieldRender.findTarget` both read
`g.width`) and the note is drawn to it: its body is exactly `g.width -
GATES.gap` wide (a 3-sliced NineSlice, so a continuous width costs no
redraw), `GATES.gap` being the drawn inset on top of the dead space, so what
the eye sees as a gap is dead space plus 8px. The note's soft drop shadow and
the target's breathing glow spill past the body by design and are soft enough
never to read as its edge. The receptor that lights on the judgment line
under the target is drawn at that same body width, with a bracket at each
edge over the squad, so the footprint the leader must be inside is visible
where the leader is. `GATES.minWidth` (80) floors the width whatever the
config asks, and `npm run model` fails if `max` would ever breach it.

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

`pierceMultiplier` is `1 + q x P`, **q = 0.7 since 1.4** (0.5 before; the
author's call, see `notes.md`, and `npm run model` asserts pierce 1 is
1.7x). The measurements below were taken at 0.5. It was the geometric series
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

### `+SHIELD` is a charge pool the squad owns

`Upgrades.shield` (0 to `SHIELD.maxLevel`, 3) is the level held;
`systems/Shield.ts` is the pool: `SHIELD.blocksPerLevel x level` charges
(2 per level), refilling continuously at that many per
`SHIELD.windowSeconds` (5), so a level is "blocks up to 2 bullets per 5s"
whether the bullets arrive together or apart. The squad owns one
(`Squad.shield`), stepped in `Squad.update` on the fixed clock; a level
change fills the pool to its new capacity at once. `GameScene.applyIncomingFire`
hands `EnemyBullets.collide` an `absorb` callback that spends a charge per
landing bullet - shell or dart, one charge - and pushes a `block` event
(position, `shell`, `body`, charges `left`) for the BLOCK word, the ring's
flash, the shard puff and the `block` cue; an absorbed bullet costs nothing
and is not a `fire` hit. **Since 1.4 a body touching the ring is blocked
the same way** in `applyContacts`: one charge per body whatever its tier,
consumed for nothing, `body: true` on the event. A breach is never blocked
and neither is the Titan. `npm run moments` forces a body into a shielded
ring and asserts BLOCK, `blocked + 1` and no contact loss
(`moment-block-body.png`). `stats.blocked` counts them and `npm run balance` prints
`shield: N held, M blocked` per seed. The pool is filtered out of the
candidate pool at the cap like SENSE (`OfferContext.shield`). `npm run
model` asserts the fill on a pick, the drain, the refill of exactly
`capacity` per window from empty, the cap, the pool filter and the zero
price; `npm run moments` forces one level and three bullets and asserts two
BLOCK words and `blocked === 2`.

Rendering: `SpriteRender.renderShield` draws a segmented energy ring
around the leader at depth 19, between the shards and the squad - one baked
arc per charge the pool can hold (`fx-shield-2` / `-4` / `-6` in `art/fx`,
a hot core line in a soft band, radius `SQUAD.unitSpacing` x 2.6, the
ring's centre outside the texture box so a segment rotates about the leader
without a mostly-empty full-ring texture), tinted `AXIS_COLOR.shield`. A
ready charge is lit at full alpha, the one refilling brightens from 0.2
toward 0.55 as it fills, the rest sit at 0.2, and the whole ring goes white
for two hit-flashes (0.14s) after a block, with a ping ring and a shard
puff in the shield colour where the bullet was stopped. The rail's SHIELD
column is `ready/capacity` over READY (pips at the value size were 123px at
six charges, wider than the lane; `npm run rail` is what caught it), and
the pause BONUSES tile shows the same.

### `+SENSE` is a roll at spawn and a mark computed live

`Gates.spawnOffer` draws ONE extra number from the seeded generator per offer,
always, whatever sense is held, and compares it with `senseChance(sense)`
(25 / 50 / 75% at one, two, three held; the author raised it from 25 / 40 /
50 in 0.7 because SENSE is a RISK axis and the pick has to pay for itself) -
so the stream advances identically on every run of a seed and a player's
sense level cannot shift the enemies and offers that follow. That decides
whether the offer is *sensed*. Which of its three options wears the mark is
NOT stored: `GameScene.render` asks `scoreLiveGates` every frame and hands
`FieldRender` the set of `pair:index` keys it marks, and the option that is
best against the player's state right now is the one marked. If taking the
previous gate changes the answer, the mark moves, and at arrival it is the
option the `DecisionLog` will grade best - the two cannot disagree because
they are one call.

The mark (`render/GateCards`, since the 2026-09-24 redesign) is a pulsing
white CROWN - a baked pill with a notch pointing down at the note head,
`SENSE` in dark 13px 800 on it - above the card, and a 2.5px white edge ON
the card's own edge. White and above, never coloured and around: the target
is marked in the axis colour on the judgment line (the receptor), so the
answer and the target never look alike. While its card is still emerging
from under the HUD the crown is held just under the HUD's edge, but never
lower than over the card's own head, so a sensed offer is told as soon as
its head shows. The pulse reads the simulated clock and touches nothing.

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
not reliably hit, so every tappable line now has a fixed hit area behind it
(a Rectangle then, a `Zone` since the 2026-09-24 redesign; either way it
keeps the target still when the label changes length or the press scales);
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
in `data/roots.ts` is four tiers at waves 1 / 5 / 15 / 25 (1.7; it was
1 / 6 / 11 / 16): `[1.1, 1.25, 1.5]`, the tenths from 1.1, every `.05`,
every `.01` (three significant figures on raw numbers from wave 25, two
before). Round tables inside a fixed
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
a SHARE of the army, floored in whole power, by the body's `tier` (`CONTACT`
in config; the roster names one per type). **Since 1.6 the share is of
`Contact.damageBase(power, peak)` = `max(held, peak x ARMY_DAMAGE.mercy)`**,
the run's peak army (`Squad.peak`, a lazy high-water mark) declining with
the army held to half the peak and no further - the author's ask, because
a share of the army held made every hit cheaper than the last and the
spiral "surprisingly slow". Enemy fire reads the same base through
`Contact.bulletCost`. The table below is the `peak === held` case; from a
peak of 1,000 a Basic contact is 20 / 10 / 10 at 1,000 / 500 / 1 held, a
bullet 10 / 5 / 5, and `npm run model` prints the decline and counts Basic
contacts from 1,000 to zero: 225 on the 1.5 rule, 86 on 1.6. The `share`
on a `contact` / `breach` / `fire` event is still cost over the army held,
clamped to 1, because it sizes the edge flash and the cue.

| tier | types | share | floor | at 19 | at 100 | at 640 | at 38,912 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| basic | Grunt, Runner | 2% | 1 | 1 | 2 | 12 | 778 |
| medium | Shielder, Spitter, Splitter, Lancer, Mortar | 4% | 2 | 2 | 4 | 25 | 1,556 |
| large | Brute, Bomber | 6% | 3 | 3 | 6 | 38 | 2,334 |
| titan | Titan | 100% | - | run ends | run ends | run ends | run ends |

A bullet is 1% floor 1 for comparison, so a Basic contact is never cheaper
than a bullet and a Large is three. The share overtakes the floor at 100 /
75 / 67 power. `npm run model` asserts the floors, the shares at the old cap,
the Titan as the whole army, monotonicity over the three ordinary tiers, and
that the roster is ten types with no Healer (the Mortar joined in 1.1). The flat table it replaces
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
- **A cage is a body to the stream** (1.2, the author's ask). The shots
  that open it spend one pierce and fly on, the rest carry on untouched,
  and a bullet meets a cage once through the same `struck` guard a body
  has. Until 1.2 `collide` called `strike` with `through` false and the
  bars spent every shot whatever its pierce. `npm run rescue` drops a
  one-hit cage at pierce 0 / 1 / 2 and asserts the opener is spent at 0
  and flies on at 1 and 2.
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

## The highway (2026-09-24 redesign)

**The world.** The author asked for an intensive visual and UX pass ("the
game is frankly ugly") with performance "extremely important" on a phone at
the late, chaotic waves, and chose the **rhythm-game note highway** over a
war-table diorama and the glossy mobile-ad canon (`ASKS.md`, 2026-09-24;
`notes.md`, "The field is a note highway"). The field is three lanes of a
note highway: offers are NOTES riding their lanes down to a lit JUDGMENT
LINE at the squad (`ARENA.laneY`, 888), RECEPTORS on the line say which note
the squad will take, the grade lands as a judgment burst, BEAT LINES stream
down at the live gate speed so the tempo is seen, and the breach line is the
FAIL line (950) - the one warm light on the road. The direction contract is
`.impeccable/surfaces/src-scenes-render-fieldrender-ts.md`; `DESIGN.md`
carries the system; this section is the mechanics. Every old visual rule was
lifted ("all bets are off ... we can adjudicate later"), and the calls the
author has not yet seen are listed in `notes.md` as pending approval.

**It is rendering only, and measured as such.** Nothing under `systems/`,
`data/` or `GameScene.ts` and no value in `config.ts` changed across the
workstreams; outside `scenes/` the changes are the font's plumbing
(`fonts.ts`, `main.ts`, the font files, Vite's asset naming). No version
bump, and `NEUTRAL_REF=<pre-redesign dist> npm run neutral` reads **5/5
seeds identical** against the build before it. Every animation is phased
off the simulated clock (the field's sprites, beat lines, pulses) or the
scene clock (tweens, bursts, screens), and every variation (spark angles,
shard angles and spin) comes from an integer hash - never `Math.random()`,
never the seeded RNG.

**The font** is Saira Semi Condensed (OFL, licence at
`src/assets/fonts/LICENSE-OFL.txt`), latin subset, weights 500 / 600 / 700 /
800 at ~18KB each, bundled by Vite into `dist/` as `game.<name>.woff2`
(`assetFileNames` gained `[name]` so four files do not collide) - a static
file beside the game, never a network fetch. Condensed because a late note
is 75px inside and must hold `+1.84K%`; tall, open numerals because the game
is reading three numbers under time pressure. Canvas text measures with
whatever face is ready when a Text is created, so `main.ts` awaits
`loadFonts()` (`src/fonts.ts`) before `new Phaser.Game`: it resolves when
the four faces are in `document.fonts` or after 2.5s whatever happens, falls
back to the system stack in `FONT`, and never throws or logs (`verify`
fails on any console error). There is no italic file; the grade words ask
for italic and the browser slants the upright.

**Tokens** live in `scenes/theme.ts`, which nothing in `systems/` may
import: `SURFACE` (void `#07070d`, lane beds `#0d0e18` / centre `#10111d`,
panel, raised, hairline), `LIGHT` (the highway's own light: rail `#c9ccff`
for dividers and beat lines, the white-hot judgment line, fail red
`#ff3b5c`), `INK` (four text greys, the floor ~4.6:1 on the panel), `MOTION`
(snap 140ms Back.out, punch 1.18 to 1 in 180ms, a 260ms lane wipe staggered
40ms, exits never overshoot), `TYPE` (one scale in Saira: 800 upright for
numbers, 800 slanted for grade words, 600 tracked caps for labels, nothing
under 13px) and `RADIUS` (card 9, button 12, chip 6). The road is
near-neutral on purpose: axis, rank, creature and grade colours are
vocabulary and live in `data/` and `hud/types`, and the highway's light is a
cool desaturated white that never competes with a colour that means
something.

**The texture makers**, all called once from `BootScene`, all baked on a
2D canvas (real gradients, `shadowBlur`) or by `art/draw` `bake`:

- `art/cards` (`HW.*`, keys `hw-`): the beat line, the note body (a
  luminance ramp the axis colour multiplies: lit cap, seam, body 0.58 to
  0.30, inner highlight, crisp edge), its shadow, glow, rim, SENSE edge and
  solid fill, the sway groove, the two operator glyphs, the SENSE crown,
  the receptor bar, brackets, leader ring and chevron (each a tinted edge
  plus an untinted white core), the breach tick, the burst ring and spark,
  the fail-line flare. `NOTE` and `ROAD` export the geometry.
- `art/fx`: the contact shadow, glow, ring, puff, health bar and backing,
  the SHIELD arcs - and it packs the field atlas (below).
- `art/ui`: the HUD panel with its lit edge and cast shadow, chip faces and
  glows, the duel well and tug bar, pips, the pause face, the Titan row, the
  banner slab and the damage vignette.
- `art/screens` (`SCREEN_TEX`, keys `scr-`): button fill / plate / rim,
  shadow, glow, the screens' note body and gloss, a plain panel - each with
  its NineSlice insets, grey where a face takes a tint.

Plus the sprite families (`creatures`, `squad`, `projectiles`, `cage`) under
"Art" below.

**The road** (`render/Highway`) is ONE Graphics of vertex-coloured rects
drawn once at depth 0: three lane beds (the centre a step lighter) with a
sheen, a calm tonal gradient sinking to the void at the far end, two lit
dividers fading up the road, the ground band (a full ring's front rank down
to the line: where contact happens), the judgment line at 888 with its glow,
the fail line at 950 glowing up the band, dark ground below for the thumb.
It is deliberately NOT a baked image: a full-screen textured quad measured
~25% slower frames under `npm run perf` than the flat fills it replaced (a
texture fetch on every one of 518k fragments; SwiftShader inflates that, but
full-screen fill is also what a phone's GPU is shortest of); per-corner
colours carry the same gradients with no fetch and no stacked fills. **Beat lines** are 8
pooled images of one baked texture at depth 1, tinted rail light, 96px apart
with every fourth a brighter bar line; their offset integrates
`gateSpeed(wave, upgrades)` - the speed `Gates.update` uses - over the
simulated clock, so they stop on pause, quicken when a wave raises the
speed, slow under `+TIME`, and restart with the run. They fade in under the
HUD and out before the ground band. The rail's backing on the game scene
(depth 30) is opaque `SURFACE.panel`: nothing needs to show through it, and
the notes are revealed below it.

**The notes** (`render/GateCards`) are NineSlices of the baked note, exactly
`g.width - GATES.gap` wide (see "Dead space"). A note fades in over its own
height as it comes out from under the HUD (`cardReveal`, keyed off
`HUD_ROWS.bottom`, which the receptor reads too). States: at rest (shade
0.88 of the axis colour, alpha 0.9); TARGETED - the one the squad is lined
up on - full colour, a white inner rim and a glow breathing on the
simulated clock; its SIBLINGS barely stepped down (0.8, alpha 0.85, labels
at full strength), because mid-decision they are the alternatives still
being compared and at 0.5 they read as already rejected. **Colour names the
axis, never the form**: both forms of an axis share its colour, and the
operator is a drawn white glyph, so multiply-versus-add is read by shape.

**The receptors** (`render/Receptors`) replace the old selection guide
(white L-brackets on the card, a stub and a ring over the leader). The
target's footprint - its x and drawn width exactly as `findTarget` decides -
lights on the judgment line in its axis colour: a glowing bar at depth 5
under the squad, and a keylined bracket at each edge at depth 25, over
everything on the field, so a full ring standing on the bar cannot hide
where the footprint ends. The leader wears a ring and a chevron pointing up
the lane in the same colour. Every mark over the squad has a white core
over its coloured edge, so it reads on a shirt of its own hue (Gold rank
under a RATE note). The approaching offer's other options show where they
will land as faint rail-light bars that never take a colour. All of it
brightens as the note nears.

**The judgment burst** (`fx/Bursts`, `fx/FieldFx`) is described under
"HUD and feedback, as built": flash, ring and sparks in the grade colour,
the slanted word punching in.

**Probes that changed with it.** `npm run moments` now forces and asserts
BAD (above). `npm run rail` judges the INK bounds of every HUD text - rail
and chips - at the widest and the narrowest state, after the punches
settle, against neighbours and panel edges. `npm run hud` adds `hud-close`
and `hud-behind`, the duel seen near and far behind par. `npm run roster`
adds `roster-fx.png`. `npm run endscreen` settles 2600ms before reading.
`npm run sway` guards its wait predicate. `npm run perf` is new.

**The rules that keep it fast**, each paid for:

- **Bake once, at boot.** Every glow, gradient, shadow, rounded corner and
  outline is baked into a texture in `BootScene`; nothing redraws a Graphics
  path per frame on a moving thing (the static road and the end screen's
  plot are drawn once each).
- **No runtime filters or post-processing.** Glows are baked alpha; the
  additive ones are blend modes on pooled sprites.
- **No per-frame `setText` / `setColor`.** Text renders white and takes
  colour by tint; strings change only when they differ. `npm run perf`'s
  uploads column is the alarm.
- **Pools and ring buffers, never allocation.** `SpriteLayer` pools per
  depth, `Shards` and `FxPool` are fixed rings that overwrite their oldest,
  the bursts are four / four / 48, the floating labels six.
- **One atlas for the field** (`art/draw` `packAtlas`, why below), and
  sprites grouped by depth and blend so a frame pays for few batch breaks.

## Art

Entirely procedural, generated in `BootScene` from the modules in
`scenes/art/`: the sprite families (`creatures`, `squad`, `projectiles`,
`cage`) through `Graphics#generateTexture` and `art/draw`, and the
highway's surfaces (`cards`, `fx`, `ui`, `screens`) on 2D canvases - see
"The highway" above. The one file loaded is the bundled font. No image
assets, nothing fetched at runtime, which is what keeps the build a static
folder. `TextureManager.generate` and the Create palettes were **removed in
Phaser v4**; see `.claude/skills/phaser4-migration/`.

**White with black detail, then baked.** Every sprite is drawn white with
its details - eyes, seams, mouth slots - in pure black, at 2x, and shown at
`setScale(0.5)`, so one texture serves every hue under the multiply tint
and a 3px seam stays crisp. Since the redesign each drawing is then
FINISHED once by `art/draw` `bake`, pixel by pixel, still for the multiply
tint: the lit back stays white in the texture (so it takes the vocabulary
colour exactly), the belly falls to grey (the colour in shade), the
silhouette's edge darkens a little more, a dark outline is dilated around
the whole shape, and hot things get a baked halo of their own hue. The one highlight a multiply tint cannot show -
a colour lighter than itself - is a separate untinted GLOSS texture
(`<key>-gloss`, cropped, `GLOSS_ORIGIN` pinning it to the body's centre so
it turns and swells with it) drawn above the body. Anything needing a SECOND
hue (the Shielder's plate, the Bomber's ember, the Spitter's tube, the
Lancer's trident, the Titan's haloed eyes) is a separate overlay tinted
`EnemyType.accent`, one depth above its body. `accent` is a rendering field
and nothing in `systems/` reads it. `bake` adds `PAD` (8px) on every side,
symmetrically, so the texture's centre is still the hit circle's.

**One field atlas, and why it is a correctness fix before it is a batching
win.** Phaser 4.2.1's quad shader selects its texture unit with
`outTexDatum == float(INDEX)` and its tint mode with `tintMode == 5.0`, both
exact float comparisons on values INTERPOLATED across the triangle. On a
ROTATED quad the interpolation drifts off the integer and one triangle
samples the wrong unit or the wrong mode: in the roster stills a turned
Shielder lost its plate, then half its body; under the OVERLAY tint mode it
drew grey-and-black. So `art/fx` packs every field texture (bodies, glosses,
accents, cage, bullets, shards, soldiers, holograms, shadows, glows, rings,
bars, SHIELD arcs) into ONE canvas texture (`field-atlas`, shelf-packed,
frames named as the textures were) and every `SpriteLayer` draws from it;
unit 0 is the one index no drift can miss, and a batch that starts on the
atlas binds it there - the MULTIPLY layers (shadows, bar backings) exist
partly to start fresh batches so the next NORMAL layer does. Tint stays
MULTIPLY (mode 0) everywhere for the same reason. The source textures stay
registered, so the start screen still draws `body` and `head` by key. If a
rotated sprite ever loses a triangle again, suspect a second texture in its
batch first.

**Radius is simulation; the sprite is fitted to it.** `EnemyType.radius` is
the hit circle and never changes for a drawing. Each creature's box is
`2 * (2r + margin)` with the circle centred; solid mass stays inside it and
only thin appendages cross, by a quarter of r at most (the Runner's nose is
the worst, ~4px). `CREATURE_ART` in `art/creatures.ts` is the table the
renderer reads - body key, accent key, whether it rotates to its travel
(walkers) or stays upright (gun types), whether it is drawn in the Titan
pools, and its one authored motion (the Splitter swells, the Bomber's and
the Mortar's embers pulse, the Spitter's tube tracks the squad; nothing else
animates). `SpriteRender.renderEnemies` has no per-type branch; a new
creature is a texture and a row.

**Hit feedback is a lift and a bleach, never pure white and never an alpha
fade.** `Enemies.damage` stamps `hitFlash = e.timer` (its own clock) and
`GameScene.collide` stamps `c.hitFlash = elapsed` on a cage; the renderer
compares and nothing is read back - `grep hitFlash src/systems` must show
the field, the two `-1` initialisers and the one set, nothing else. A flash
LIFTS the body's own colour halfway to white for `RENDER.hitFlash` (0.07s)
and fires at most once per 0.5s of the body's clock (`FLASH_REPEAT`, per
slot, reset on a recycled seed): under a stream every stamp is always fresh,
and the first sprites pass - pure white, at most every 0.2s - still held a
wave-41 swarm ~35% white, so the colours that name a body never showed. Now
it is lit under 15% of the time and a flashing Brute is still red; the
gloss stays through a flash, and accents and cages lift the same way. A
wound bleaches toward white by damage taken, capped at `RENDER.bleach` x
0.55 (~19% at zero HP) - enough to see a body is hurt, never enough to wash
the hue out. **No live body is ever drawn pure white**; the kill pop is the
brightest thing a body does. Health bars stay for `radius >= 14`, only
once hurt: rounded baked sprites on a dark backing, no Graphics.

**Shadows only where they read.** Ordinary enemies cast NO contact shadow:
black at MULTIPLY on the `#10111c` road measured invisible in the stills,
and at a wave-41 swarm it was ~60 sprites of fill for nothing - dropping it
took one MULTIPLY batch out (14 to 12 draws a frame). The Titan (a wider,
darker shadow plus a breathing aura in its own colour), the cages and the
squad keep theirs. That call is pending the author's approval.

**Squad bullets are additive glowing streaks** (`bullet-streak`): a soft
capsule, bright head leading, tail fading inside a faint halo, drawn ADD at
depth 12.5 and tinted by the density ladder (`bulletTint`), so the whole
streak IS the ladder colour and a heavier bullet reads as its tier; tier 0
is still the cream a bullet has always been. No outline: nothing the squad
fires has one.

**Death pops are a fixed budget.** `render/Shards.ts` keeps
`RENDER.shardRing` (96) shard records and one sprite pool; `render/FxPool`
keeps fixed rings of pop records (48 additive, 16 normal). An ordinary
`kill` throws `shardsPerKill` (3) baked shards for `shardLife` (0.28s), each
at its own HASHED angle, speed ±20%, thrown tumbling off its line, plus a
0.1s glow flash in the body's colour lifted halfway to white - and **no
ring**: a thin ring with three shards 120deg apart round it read as a gun
sight in an empty lane (the finish review flagged it in both rounds before
it went).
Only the Titan's death rings: twelve spoked shards, a big glow, and three
staggered rings (the middle one white). A `contact` throws two dull shards
and a puff; a `block` a ping ring and two shards in the shield colour. Past
the budget the oldest record is overwritten, so a burst never allocates.
Everything is timed off the simulated clock and hashed from the ring slot,
never the RNG.

**Enemy bullets are darts, not small enemies.** `ebullet` is a
black-outlined teardrop with a hot core, rotated along its velocity, in
`COLORS.enemyBullet` (hot magenta - no body wears it), inside a baked halo
of its own colour at NORMAL blend, with a faint smaller copy behind it
(`RENDER.bulletTrail`). The opposite of the squad's stream on every axis
that reads at a glance - outlined, haloed, normal blend over an additive
stream - and never a Runner, which has legs, eyes and no glow.
`ENEMY_FIRE.radius` is unchanged; the dart is 8x16 on screen around a 5px
hit circle, the halo is extra.

**A shell is a big slow round** (1.1). `GunSpec.shell` marks a gun whose
bullets are `eshell` - a black-outlined disc with a bright core inside a
baked halo, 20px on screen around `ENEMY_FIRE.shellRadius` (9) - in
`COLORS.enemyShell` (scarlet). `EnemyBullet.shell` carries the flag;
`EnemyBullets.radiusOf` picks the hit radius per bullet, so the swept test
is per bullet too. The only shell gun is the **Mortar**'s
(`data/enemies.ts`: medium tier, wave 10, weight 11 and `interval 6` since
1.3, `speed 105, damage 2, aimed`), so a shell costs twice a dart through
the same `powerShare` arithmetic. The Mortar is drawn upright as a squat pot
with a black muzzle (`c-mortar`) and the loaded shell glowing in it as its
accent (`a-mortar`, pulsing like the Bomber's ember). `npm run behaviour`
picks it up as a shooter automatically; `npm run roster` puts a shell
beside the darts in the volley still.

**Depth map**, bottom to top. The game scene (field; the constants live at
the top of `SpriteRender` and in each render module):

| depth | what |
| --- | --- |
| 0 / 1 | the road (one Graphics) / beat lines |
| 2 | sway groove |
| 3 / 3.5 | note shadow / the target's glow (ADD) |
| 4 / 4.2 / 4.3 | note body / target rim / SENSE edge |
| 5 | receptor bars (target, and the idle ones ADD) |
| 6 | breach ticks; cage HP bars (Graphics) |
| 7 / 7.5 | contact shadows (MULTIPLY: Titan, cages) / Titan aura |
| 8 / 8.5 / 9 | Titan body / gloss / accent (`bigPool`) |
| 10 / 10.5 / 11 | enemy bodies / gloss / accents |
| 12 / 12.5 / 12.6 | cage inmates / squad streaks (ADD) / kill flashes, Titan rings, block pings (ADD) |
| 13 / 14 / 14.3 | cage bars / shards / puffs |
| 14.5 / 15 | SENSE crown / every label: operator, magnitude, axis word, SENSE tag, cage reward |
| 17 / 17.1 | ECHO ghost bodies / heads (ADD) |
| 18 / 18.1 | health-bar backing (MULTIPLY) / bar - above the bodies they annotate |
| 18.9 / 19 | squad shadows (MULTIPLY) / SHIELD ring |
| 20 / 21 | squad body / head (`head-lead` for slot 0, with a visor) |
| 22 / 23 | enemy bullet trail / enemy bullets - above the squad they hit |
| 25 / 25.1 | receptor brackets, leader ring, chevron / their white cores |
| 26 | judgment bursts (ADD) |
| 27 | grade words and floating labels |
| 28 / 29 | fail-line flare (a Titan landing) / death dim |
| 30 | the rail's opaque backing |

The UI scene draws over all of it: the HUD panel and texts, the Titan row
(42), the stage banner (44), the damage vignette (45), then the screens -
end 50, pause 55, start 60, HOW TO PLAY over the start screen 65. Additive
layers are grouped (the stream with the kill pops; the ghosts alone) so a
frame pays for as few blend switches as possible.

**`npm run roster`** photographs the set: `roster.png` (one of each type in
a row, the Titan, a cage, every gun's volley, the squad at `hud-mid`),
`roster-hit.png` (bodies flashing, bodies bleached, two kills popping, a
contact mark, a flashing cage), `roster-late.png` (`hud-late`) and, since
the redesign, `roster-fx.png` (the pops mid-flight - a Titan burst, two kill
pops, a contact puff, a block ping - with SHIELD 3 and ECHO 2 held).
`ROSTER_SCALE=3` adds `*-zoom.png` crops at 3x. It asserts only that nothing
errored; the questions to put to the stills are whether every type can be
named from silhouette with colour ignored, whether any enemy bullet could be
taken for a Runner, and whether a swarm under a stream still shows its
colours.

### The end screen's plot, and the word INVEST

`EndPayload.series` (1.5) is `{ t, wave, standing }[]`: `GameScene.sample`
pushes one on the run's first step (in `step`, lazily, because the first
run never passes through `restart` and `from`'s injected state must be in
first), one per `wave` event and one in `emitGameOver`. `EndScreen.drawPlot`
draws it once per run (one Graphics, redrawn only on `show`) in the `PLOT`
frame (262x78 at 68,468) on a baked rounded panel (`SCREEN_TEX.panel`,
tinted `SURFACE.panel`): a hairline baseline, a dashed PAR line at 100% in
the rail light, the y axis to `max(1.5, peak)` with 13px labels, and the
player as a soft filled area under a 2.5px line with a dot per wave and the
last point ringed, all in `standingColor` of the last point; `PEAK_X` (432)
holds peak DPS through `compact` at 38px over PEAK DAMAGE / SEC. The "% OF
THE GROWTH ON OFFER" number is gone from the screen;
`DecisionLog.fractionOfOptimal` and `stats.optimal` stay for the
instruments.

Since the 2026-09-24 redesign the end screen is a rhythm game's RESULTS
screen, in the order the author's intent sets: the cause as a slanted
heading (YOUR SQUAD WAS OVERRUN / THE TITAN LANDED - the run's last
judgment), the waves headline counting up and punching, then the tally as a
results TABLE of five rows - PERFECT / GOOD / BAD / INVEST / MISS, word
slanted at 21px in its grade colour (MISS in caption grey), a share bar
scaled to the largest count, the count at 27px - revealed in a stagger
(260ms after the headline, 70ms apart, each counting up over 280ms), then
the plot, the match code and REPLAY THIS MATCH. The
choreography runs on the UI scene's clock after the death beat, and nothing
runs once it has landed. The results-table layout is new and pending the
author's approval (`notes.md`). On screen the zero-DPS grade reads
**INVEST** (`GRADE_WORD.risk`, the table's fourth row, the label naming the
third row of pause tiles, the guide topic); the key is still `risk`
everywhere in code and stats, and `npm run moments` accepts INVEST as a
grade word.

### Numbers on screen

`src/format.ts` is the one formatter (1.5): `compact` is whole below 1000
and three significant figures on the thousands ladder above (`1.02K`,
`10.2K`, `102K`, `1.02M`, then B / T / Q / Qi / Sx / Sp / Oc / No / Dc),
`formatMult` is `×1.32` / `×10.2` / `×102` / `×1.02K`, and `compactLabel`
keeps a value's exact digits below 1000 for text that is also a promise
(a card's `+12.5%`). `hud/types.ts` re-exports the first two. The rail's
`% PAR` has no `>999%` cap any more. Its lanes are no longer five equal-ish
columns (88 / 100 / 96 / 94 / 82 until the redesign): WAVE from x 12 (the
figure fit to 70px, `1.23K KILLS` to 72), the duel's well from 92 to 306
(YOUR DPS fit to 56% of its 194px inside, PAR to 38%, `% PAR` stopping
short of the target notch), SENSE from 314, SHIELD from 406 (fit to 56px),
PAUSE in the last 80 (`RAIL_PAUSE_WIDTH`); the strip's chips are 100 / 118 /
118 / 80 / 80. Every figure is fit by scale (`HudText`), and `npm run rail`
holds 8px between inks side by side, 3px ink to ink stacked and 4px inside
a panel's edge, at the widest and the narrowest state. `npm run model`
asserts the ladder.

### Analytics

`src/analytics/Analytics.ts` is GoatCounter, installed from `main.ts` the
way audio is: it reads `game.events` and nothing else, no scene knows it
exists, and nothing in it can reach the simulation. `ANALYTICS.site` in
config is the GoatCounter site code (public by nature; empty means OFF, and
it is `brhkim`, the author's site). Instrument pages (`?seed=`) and local
hosts (`localhost`, `127.0.0.1`, so the dev server and `npm run verify`)
never load the script: the counter ignores localhost anyway, and in a
sandbox that cannot reach it the failed load is a console error `verify`
would count. It counts a pageview, then three events per run as
paths - `run/start`, `run/end/<mode>/wave-NN` (title: the cause), and
`run/time/<bucket>` from the `elapsed` the end payload now carries (under
30s, 30s-1m, 1-2m, 2-4m, 4-8m, over 8m) - because GoatCounter stores counts,
not values. Every call is in try/catch; a blocked script costs nothing.

### Audio

Sound follows the art's rule: no files, everything synthesised. It is raw
WebAudio in `src/audio/`, and Phaser's sound manager is switched off
(`audio: { noAudio: true }` in `main.ts`, accepted by the 4.2.1 types and
honoured at runtime) so there is exactly one context. **Rebuilt
2026-09-24** (the author: "the sound design sorely lags ... some kind of
music track ... with a separate music disable option"); the intent is in
`notes.md`, "Sound", and every call there is pending the author's ears.

```
src/audio/
  cues.ts         the effects palette: CueName -> recipe (parts, level, send, priority, cap, bundle rule)
  synth.ts        recipe -> nodes on ANY BaseAudioContext: FM, unison, vibrato, drive, pan, ADSR; master chain
  harmony.ts      scales, chords, chord tones; HARMONY, the chord the music is playing, which effects resolve against
  space.ts        the room: one convolver reverb (generated impulse) and a tempo echo, both on sends
  collapse.ts     the Bundler: N events in a window become ONE voice encoding N
  Audio.ts        context lifecycle, unlock, buses -> duck -> master, voice budget, effects / music switches
  AudioEvents.ts  the game.events subscription: event -> cue, pan, kill climb, PERFECT streak; conducts the music
  install.ts      installAudio, window.__audio
  offline.ts      offline renders of music (+ effects laid over it) for the instruments
  music/
    types.ts        the track shape and the line / drum token grammar
    composer.ts     pure: phrase plans and bar events from a track, a mode, a level, a seed
    rig.ts          the music's buses (layers, pump, duck, pause lowpass) and scheduleBar
    Music.ts        the engine: lookahead scheduling on the audio clock, modes, rotation, harmony timeline
    instruments.ts  kit and instrument recipes (the same Cue shape)
    tracks/         NEON LANES, OVERDRIVE, BREAKLINE, CHIPRUSH, and what they share (common.ts)
```

**It reads `game.events` and nothing else.** `installAudio(game.events,
location.search)` (`install.ts`) is called once from `main.ts`; no scene
file knows audio exists. It subscribes to `moment` (the `SimEvent[]`
GameScene drains each frame), `hud` (its per-frame tick, which also carries
the wave and the Titan's descent), `paused`, `restart`, `showstart`,
`startmatch`, `gameover`, `mutetoggle`, `musictoggle`, `uitap` and
`uiready`, and emits `muted`, `music` and `musictrack` for the pause
screen's labels (on `uiready` too, so they start from the truth). Scenes
emit only requests: `ScreenButton` emits `uitap` on every press, M
`mutetoggle`, N `musictoggle`. Nothing in `systems/` imports `audio/`;
`npm run audio` greps for that, for `Math.random` and for `Rng` in
`src/audio/`. Variation (the kill's +-8 cents, the music's arrangement)
comes from hashed counters, never a random source. Audio may read
`performance.now()` because nothing it does can reach the simulation -
`npm run repeat` and `npm run neutral` are what keep that true.

**The audit, and what changed.** The palette was single oscillators, mono,
dry, with no relation to anything musical. Rebuilt on three practices
(sources in the session log): **transient / body / tail** layering - a
click or noise attack on every impact (it is also all a phone speaker
plays of a 50 Hz thud: the missing-fundamental trick), a body naming the
event, and a tail from a shared room rather than the recipe; **rewards in
the music's key** (Tetris Effect): positive cues name a `tone` - a chord
tone, a step above the chord's root, a scale step or a step of the key -
resolved when they play against `HARMONY`, which the music publishes per
bar by audio time (`Music.syncHarmony`, called by `Audio.play`); and
**mix for a phone**: nothing below 150 Hz alone, gentle panning (at most
0.45 - one speaker, or two a hand covers), a glue compressor and a limiter
at the end of the chain. Failure is deliberately NOT in key: BAD is a
flat second bending flat, a breach carries a flat second on the tonic.

**Mapping.** `kill` -> `kill` (bundled; a Titan kill is `titan down` ->
`titanKill`), and successive kill voices within 600 ms CLIMB the chord
and fall back (`KILL_CLIMB`, the `climb` voice option adds to every chord
tone); `contact` / `breach` -> the same-named cues, level rising with
`share`; `fire` with hits -> `fireHit`; `block` -> `block`; `pick` ->
`pickPerfect` / `pickGood` / `pickBad` / `pickRisk` by grade, and a
PERFECT climbs the arpeggio a chord tone per PERFECT in a row (up to four;
counted here from `pick`, reset by any other grade, a miss, the end);
`miss`, `rescue`, `wave`, `sense` -> the same names; `titan arrive` ->
`titanArrive` (and the music's boss section); `titan volley` ->
`titanVolley`, at most every 250 ms; `titan down` -> `titanKill` (and the
music back, with a crash); `over` -> `playerDeath` or `titanLand` by
cause; `startmatch` -> `start`; `paused` -> `pause` / `resume`; `uitap` ->
`uitap`. The Titan's heartbeat (`titanPulse`, quickening with the
`hud`'s descent) plays only when the music is off: with it on, the boss
section carries the dread in tempo rather than against it. Every event
with an x is panned by it.

**The collapse.** Kills, contacts, breaches, fire hits and blocks go
through the `Bundler`: a lone event plays at once; inside a 100 ms window
(80 / 120 / 60 / 60 for the others) further events are tallied and play as
ONE voice when it closes, so the kill voice rate is at most 10/s. A bundle
of `n` is 1.5 dB quieter per doubling and from four carries a partial an
octave down - heavier, never louder. It no longer drops a semitone per
doubling: the kill is a chord tone now, and a semitone off it is a wrong
note.

**Budget.** Twelve effect voices, per-cue caps (kill / contact / breach /
fireHit / block / uitap 2, the rest 1), priorities `titanLand 100 >
playerDeath 95 > titanKill 90 > titanArrive 85 > breach 70 > pick 65 >
rescue 60 > wave 55 > contact 45 > sense 40 > titanVolley 35 > block 32 >
titanPulse 30 > miss 25 > fireHit 20 > kill 10 > ui 5 > uitap 4`. A full
mix evicts the lowest priority below the newcomer or refuses it
(`stats.refused`). Breach and the Titan cues duck the kill and hit buses
6 dB for 300 ms; the kill bus eases to -6 dB past 30 kills/s. Effects also
duck the MUSIC: an event cue 3 dB for 260 ms, a Titan cue 6 dB for 500 ms,
a ducking cue 5 dB for 300 ms. Voices are released by wall clock, not
`onended`, so a context that never runs cannot leak them - and every voice
DISCONNECTS from the graph when its last source ends (see "Cost" below).

**The music.** Four tracks, data in `music/tracks/`: **NEON LANES**
(synthwave, 100 BPM, A minor), **OVERDRIVE** (electro house, 124, E
Dorian), **BREAKLINE** (drum and bass, 172, D minor, half-time at low
intensity) and **CHIPRUSH** (chiptune, 150, C major). A track is authored
cells - progressions with lead lines written in chord tones, one-bar bass /
arp / stab / drum patterns, fills - and the composer only chooses which
cells meet: nothing is generated note by note. `types.ts` documents the
token grammar (`0-6` chord tones, `a` / `b` below the root, `+` / `-` a
scale step, `_` hold, `.` rest; drums `X x g .`). Chord roots FOLD into
-5..+6 semitones of the tonic (`harmony.rootOffset`), so a line written in
chord tones moves by steps across a progression instead of leaping.

- **Layering** (vertical): `AudioEvents.level()` sets intensity 1-4 from
  `0.25 + 0.06 x (wave - 1)` plus up to 0.2 from recent damage (a decaying
  share-weighted sum, 6 s half-life). The level picks which list of
  sections phrases cycle through (`tracks/common.ts`, `ARRANGEMENT`).
- **Re-sequencing** (horizontal): a phrase is eight bars of one section
  (menu / intro / groove / build / drop / break / boss / boss2); a level's
  list is cycled so a drop is followed by something else; the lead plays
  only in drops and breaks (60-65% of phrases at the top levels);
  progressions rotate every two phrases and lead lines per phrase (hashes
  of the music seed); fills end half the phrases, crashes mark drops and
  mode changes; builds carry a riser.
- **Modes**: `menu` on `showstart` and 3.5 s after the run ends (under the
  end screen), `play` on `startmatch` / a replay, `boss` on `titan
  arrive` - its own darker progressions (mostly Phrygian: the flat second)
  under `TITAN_MOTIF`, a four-note leitmotif shared by every track - and
  back to `play` on `titan down`, forced into a drop from intensity 2. A
  mode change lands on the next BARLINE, never mid-bar. A new run starts
  the next track and a new variation seed; so does every second Titan
  felled. A `restart` that the start screen follows in the same tick (a new
  match) waits for START MATCH instead (`AudioEvents.onRestart`).
- **Pause** muffles it (a 650 Hz lowpass, -5 dB) rather than stopping it;
  the run ending closes the filter and fades it over 1.8 s.
- **Scheduling** is the "tale of two clocks": a 25 ms `setInterval`
  decides when to schedule, the AudioContext clock when each note sounds.
  A bar is PLANNED on its downbeat and its notes CREATED a sixteenth at a
  time within a 150 ms lookahead (`Music.advance`) - not a bar ahead, for
  the cost reason below. A clock that jumped (a background tab) skips
  forward and counts `late`.
- **The rig** (`rig.ts`): layer buses (the track's mix plus a measured
  `BALANCE` trim) -> drums, or tonal -> a sidechain PUMP the kick
  automates (house breath: 0.65 in OVERDRIVE) -> the effects duck -> the
  pause lowpass -> `out` (the mode's level, -10 dB in play) -> the master.
  Per-layer reverb and echo sends; the echo's time is the track's tempo.

**Switches.** SOUND (effects) and MUSIC are separate: the pause screen's
row is SOUND | MUSIC | RESTART (SOUND | MUSIC centred on HOW TO PLAY), with
NOW PLAYING and the track's name under it; M and N on a keyboard.
`localStorage['shooter_ad.audio.muted']` and `['shooter_ad.audio.music']`
persist them; with no music choice stored, music follows an old SOUND OFF
(off) and is otherwise on. `?mute=1` and `?music=0` / `?music=1` override.

**Unlock and safety.** The context is created inside the first
pointerdown, touchend or keydown (capture listeners on `window`; the START
MATCH tap is the usual one) and never before; the music begins then, in
whatever mode was asked for. `?seed=` pages - every instrument - create NO
context unless they add `audio=1`. Every WebAudio and storage call is in
try/catch (`Audio.guard`) and counts into `stats.failures`; nothing in
`src/audio/` logs. `npm run verify` prints the audio line and a music line
(`on running track section level bars late`) and fails on any failure, or
on music on with a running context and no bar scheduled.

**Cost, measured.** Offline in headless Chromium (`OfflineAudioContext`
render time over audio time, 40 voices each): a static biquad 0.038x real
time, the same filter with its cutoff automated 0.105x (Chromium
recomputes coefficients per sample), FM 0.063x, a vibrato LFO 0.072x, a
panner 0.024x, buffer sources 0.006x, the one convolver 0.015x. The
finding: **nodes waiting in the graph cost more than sounding ones** -
2,000 idle gains 0.37x, 2,000 oscillators scheduled for later 0.61x. So
the music creates notes a sixteenth at a time, every voice disconnects
when its last source ends, and a part's level is its envelope's peak (one
gain node a part, not two). The first version scheduled whole bars ahead
and rendered 185 s of NEON LANES in 487 s; after, in 16 s (0.09x, the
instrument's own suspend round trips included), identical output. Across
the four tracks the busiest sections create 160-255 nodes a bar. Real-time load on a phone's
audio thread is **unmeasured** (Chromium has no render-capacity API here);
the offline ratio is a proxy.

**`npm run audio`** plays every cue live and asserts nodes were created,
stresses the bundler, checks the music starts on the gesture, schedules
bars without falling behind and stops when switched off, drains on
`gameover`, then renders every cue offline through a clone of the master
chain and the room to `.verify/audio/<cue>.wav` (stereo), `palette.wav`,
`kill-bundle-N.wav`, `kill-climb.wav` and `perfect-streak.wav`, printing
duration, peak, RMS, dominant frequency and the share of energy above
200 Hz. Every cue must peak between -40 and -1 dBFS.

**`npm run music`** is the music's instrument, described in its header:
a STATIC half (Node, the game's own TypeScript) that checks every pattern
is a whole bar, every lead covers its progression, every name resolves,
and - arranging 40 phrases per mode and level - that every note is in the
scale of its chord and in its layer's register, printing the variety; a
RENDER half writing each track through menu, intensities 1-4, the Titan
and a drop to `.verify/music/<track>.wav` with a spectrogram
(`<track>.png`), printing per section BS.1770 loudness, peak, the energy
under 150 Hz / 150 Hz-2 kHz / above, and width; and a MIX half laying a
synthetic stream of effects over NEON LANES and asserting every PERFECT
stands 3 LU over the music under it. `MUSIC_ONLY=<track>` renders one;
the probe puts the game loop to sleep first (left running, the game drew
on the software rasteriser beside the render and starved it). It cannot
say whether any of it is good: listen to the files.

`window.__audio` on every page has `play` (the event path, with a
synthetic clock `t`), `voice` (direct), `tick`, `render`, `renderMusic`,
`tracks`, `cues`, `stats` (with `music`), `setMuted`, `setMusic`,
`stopAll`, `voicesOf`.

### The spawn line is the HUD's bottom edge, and the descent is scaled to it

`ARENA.spawnY` is `HUD_ROWS.bottom` (184: rail 72 + strip 94 + Titan row
18, the three HUD files read their heights from that one block in config).
Until 1.0 it was -40 and the top 224px of every descent happened under the
panels. Speeds in `data/enemies.ts` and `CAGE.speed` were NOT retuned:
`ARENA.descentScale` (766/990, derived from the geometry) multiplies every
vertical speed once, at the bottom of `applyMotion` and in `driftCages`, so
a body reaches the line in the seconds the data says. `MOTION.ceilingY` is
the spawn line too, so a retreating harasser never rises under the HUD.
The Titan spawns at `TITAN_SPAWN_Y` (40px above the line) and its travel
seconds - the one input to `titanHp` - come from `titanTravelSeconds()` in
`data/enemies.ts`, which `Enemies.titanBudget`, `npm run model` and `npm run
titan` all read (it lives in the data module because the instruments load
it under Node's type stripping and cannot load `Enemies.ts`). `npm run
model` asserts the line, the ceiling, the invariant per body and cage, and
that the Titan's descent moved under 2%.

### An army multiplier adds at least one body

`applyGate` for `army` / `mult` adds `max(1, round(power × (value − 1)))`
rather than rounding the product: `×1.1` on 1 gave 1. Par takes gates
through the same function, so the floor is in its valuation and in the
grade. `npm run model` asserts 1 → 2 at ×1.1 and that par takes it.

### Rescue cages roll once per wave, and for two versions they did not

`Enemies.updateCages` rolls `CAGE.chancePerWave` when its accumulator
passes the wave duration. Until 0.8 the accumulator was reset only when
the roll SUCCEEDED, so a failed roll was re-rolled on the very next step,
sixty times a second, until one passed - a cage within ~40ms of every
deadline, whatever the constant said. Watched on the 0.7 build with a
scratch page script: cages at 17.0 / 32.2 / 47.5 / 61.7s on every seed.
The clock now restarts on every roll (the failure path returns after
drifting the live cages), `cagesSpawned` is counted into the `stats`
registry as `cages`, and `npm run balance` prints `cages/min` with the
per-seed counts. Read that line after touching anything near the roll: it
is the first instrument this project has had for the frequency, and the
bug lived two versions because there was none.

**The reward is `cageReward(power)` in `Progression`**, a tenth of the army
held when the cage opens, whole, never under `CAGE.minReward` (2), priced
once so the label the cage carries (`FieldRender`) and the army the open
grants (`GameScene.collide`) cannot disagree. It was +5 flat under 100
power for three versions and no instrument saw that a first-wave cage was a
×6; `npm run rescue` now forces one open at seven army sizes on the built
game and asserts reward and label, and `npm run balance` prints `opened`
per seed (`stats.rescues`, `stats.rescuedPower`). The bot never aims at a
cage, so `opened` reads 0 on every probe row: the reward is measured by
`rescue`, never by `balance`.

## Extending content

- **Enemy**: append to `ENEMIES` in `data/enemies.ts` with a `tier` (what it
  costs on contact - see `CONTACT`). A type with a `gun` is a shooter: half
  the weight its body would carry, and one new shooter per TEN waves
  (Spitter 5, Mortar 15, Lancer 25 since 1.7; 5 / 10 / 15 in 1.3) is the
  shooter curve - the
  author chose spawn rates over a live cap so clearing a ranged body is
  rewarded rather than answered. The guns fire every 3 / 4.5 / 6s
  (Spitter / Lancer / Mortar) since 1.3. Movement is a `motion` union with one
  case each in `systems/EnemyMotion.ts`; only genuinely new movement needs a
  case there, and every case is used by at least one of the ten types. A
  gun is a `GunSpec`; `shell: true` makes its bullets big slow rounds
  (the Mortar). Add a row to `CREATURE_ART` and two textures, or the type
  draws as the fallback disc.
- **Bonus**: append to `CANDIDATES` in `data/gates.ts` plus one case in the
  progression model. Magnitudes are never hardcoded — every bonus draws from the
  root table in `data/roots.ts` and presents the draw according to its form.
  The discrete axes do too: from `GATES.scaleDiscreteFrom` held, `+N GUNS` and
  `+N PIERCE` are the whole number whose effect is nearest the draw
  (`Progression.discreteAmount`), so `OfferContext` carries `guns`, `pierce`
  , `sense`, `shield` and `echo` beside the pools. A bonus that changes no damage
  number - MOVE, TIME, SENSE, SHIELD - is a RISK axis (`RISK_AXES`): priced
  at zero, never taken by par, told RISK when the player takes it; `npm run
  model` asserts the zero. A ninth axis also means a ninth pause tile
  (`PauseBonuses` is a 3x3 grid of 160x64 tiles since 1.1) and, if it has
  live state, a rail column - run `npm run rail` after touching either.
  **`+ECHO`** (1.4, retuned 1.5) is the tenth axis and a DAMAGE one:
  `Upgrades.echo` 0 to `ECHO.maxLevel` (4), `echoColumns` the ladder
  (half left, half right, full left, full right - strength is the damage
  share and the drawn size), `echoMultiplier` (`1 + 0.7 x` strength fired:
  1.35 / 1.7 / 2.05 / 2.4) in `squadDps` and out of `singleTargetDps`, one
  spawn per column in `GameScene.fire` (`ECHO.offset` 150px, the same
  bundle at the column's strength of the damage) and `echoCopies` in
  `bundleFactor` so the sim cap holds; the ghosts are drawn by
  `SpriteRender.renderSquad` in the army's own shirts, scaled by strength
  around their own leader, as HOLOGRAMS since the 2026-09-24 redesign: the
  soldier drawing baked flat and cut by scanlines (`sq-holo-body` /
  `-head` / `-head-lead`), drawn ADDITIVE at `RENDER.echoAlpha` (0.38) with
  a faint flicker off the simulated clock and no shadow - light on the
  road, never a second squad standing on it. They have no body in
  `systems/`. The pause grid is 4x3 of 120x64, the INVEST four on the
  third row.
  `npm run hud` photographs `hud-echo.png` and `npm run model` asserts the
  price, the cap, the pool filter, the Titan exclusion and that par takes
  it.
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
  it and back to **1** at the author's ask (0.9): a lone unit, the first
  leak ends the run, and `npm run verify` had to stop sweeping and stand
  under the lowest enemy to kill anything. Any new source must be a choice
  the player makes. A cage is `cageReward(power)`; a `×ARMY` gate adds at
  least one body.
