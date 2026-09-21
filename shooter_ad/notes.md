# shooter_ad — design notes

Living design document. `CLAUDE.md` says how the code works; this says what the
game is trying to be and why. When the two disagree, this one is the intent and
`CLAUDE.md` is out of date.

---

## The thesis: DPS golf

**The game is a test of judgment under time pressure.** Every few seconds you
are shown three bonuses and must decide, in the time it takes them to reach you,
which one most increases your damage output. Everything else — the mob, the
formation, the breach line — exists to punish a wrong call and reward a right
one.

That reframing settles a lot of open questions:

- A bonus that does not change damage output is noise. Cut it.
- A bonus whose value is *obvious* is not a decision. It is a formality.
- The interesting bonuses are the ones where the right answer **depends on the
  state you are already in**, so the player has to actually think.

The design target is that a knowledgeable player is right maybe 70% of the time
and *knows* when they guessed.

---

## What gets cut, and why

| Removed | Reason |
| --- | --- |
| `sub` (−10), `div` (÷2) | Trap gates. The decision is "avoid the obvious bad one" — no judgment involved. |
| `frenzy`, `slowmo` | Time-bound. Value depends on the next few seconds, not on your build; impossible to reason about and impossible to score afterwards. |
| `shield` | Changes survival, not damage. Off-thesis. |

`pierce` **stays**, because its value genuinely depends on board state — see
below. It is the model case for what a good bonus looks like here.

---

## Bonus taxonomy

Every bonus must (a) affect damage output, and (b) have a magnitude that is not
obvious from the label alone.

### The additive / multiplicative split

The central mechanic. Each stat has two bonus forms that read similarly and
behave differently:

- **`+10% RATE`** — additive into a bonus pool: `rateBonus += 0.10`
- **`×1.05 RATE`** — multiplicative on the total: `rateMult *= 1.05`

Final stat is `base × (1 + rateBonus) × rateMult`.

Early, additive wins easily: `+10%` of base beats `×1.05` of a small total.
Late, it inverts: at `rateBonus = +200%`, another `+10%` adds a tenth of base,
while `×1.05` adds 5% of a 3× total — fifteen hundredths of base. **There is a
crossover point, it moves as you build, and the player has to feel where it
is.** That is the game.

Apply the same split to damage, and to army size.

#### The two forms, and why the raw pool must scale

A stat is `base × (1 + pool) × mult`. `+10% DMG` adds ten points to the pool;
`×1.1 DMG` multiplies the base, which the pool then amplifies. Worked, at base
damage 5 and a pool of +210%:

| | pool | base | total |
| --- | --- | --- | --- |
| now | 210% | 5 | 15.50 |
| after `+10% DMG` | 220% | 5 | **16.00** |
| after `×1.1 DMG` | 210% | 5.5 | **17.05** |

The multiplicative form scales the whole stack; the additive form adds ten
points to a stack already at 310. That gap widens with the pool, and `npm run
model` measures the consequence — the chance the additive form is the right pick
falls from 42% at an empty pool to 22% at +100% and **3% at +800%**. Left alone,
the central judgement of the game becomes a formality exactly when the player is
most invested.

**The fix is at the draw pool, not the formula.** Keep the mechanics above
untouched. Instead, give the raw form a draw range whose *effects* match the
multiplicative form's at the player's current pool. If `×N` draws a root from
`[1.05, 1.50]`, then raw draws:

```
a = (root − 1) × (1 + pool)        displayed as +{a × 100}% 
```

At a pool of +210%, a root of 1.1 becomes `+31% DMG` and is worth exactly ×1.10
— the same as `×1.1`. Both forms now reach the same span of outcomes, so:

- **Neither form is ever dominant or dead.** Whichever drew the higher root
  wins, which is a coin flip across offers rather than a slow slide into one
  answer.
- **The conversion is the skill.** The player sees `+31% DMG` against
  `×1.25 DMG` and must know their pool is 210% to work out which is bigger. That
  arithmetic is the test, and it is why the pool has to be legible in the HUD.
- **The draws settle it, not the forms.** Two independent draws from
  effect-equivalent pools, so the answer genuinely varies offer to offer.

Apply the same treatment to rate. Army already works this way in spirit — raw
presents as an absolute against current size — so it needs the same scaling
against its own growth, not against a bonus pool.

#### One root table, two presentations

**This is the generator for every bonus magnitude in the game.**

Each legibility tier owns a **root multiplier table**. Early tiers are coarse
and mentally tractable:

```
{ 1.05, 1.1, 1.2, 1.3, 1.4, 1.5 }
```

Later tiers are fine — any hundredth in `[1.05, 1.50]`.

**Every bonus draws a multiplier from that table independently**, then presents
it according to its form:

| Form | Draws | Shows |
| --- | --- | --- |
| Multiplicative | `1.2` | `×1.2 ARMY` |
| Raw / additive | `1.2` | `+{round(army × 0.2)} ARMY`, e.g. `+100` |

Two properties fall straight out, and both are the point:

- **Raw bonuses stay proportionally relevant at any army size.** A flat `+50`
  goes dead once the army is in the thousands; a draw of `1.2` never does. This
  is what stops the additive form becoming the no-op it is today.
- **The draws are independent, so the two forms in one offer are usually not
  the same underlying value.** The player cannot assume `+100` and `×1.2` are
  equivalent — they have to divide. That mental conversion *is* the test.

The asymmetry in cognitive load is deliberate: `×1.2` describes itself, while
`+100` means nothing until you know your army is 504. It is also exactly why the
active-bonus readout beneath the red line has to be legible at a glance.

Apply the same generator to rate and damage. A draw of `1.2` becomes
`+20% RATE` in additive form and `×1.2 RATE` in multiplicative form — where the
additive goes into the bonus pool and the multiplicative onto the total, so
those two also diverge compositionally (see above), not only in presentation.

#### Colour names the axis, never the form

One colour per axis, shared by both of its forms: `+120 ARMY` and `×1.2 ARMY`
are the same green, `+20% DMG` and `×1.2 DMG` the same orange. Tinting the forms
apart would hand the player a shortcut past the raw-versus-multiplicative
conversion, which is the decision the whole game exists to ask.

Labels take one grammar — magnitude, then axis — with `+` and `×` as the only
form signal:

| Axis | Raw | Multiplicative |
| --- | --- | --- |
| Army | `+120 ARMY` | `×1.2 ARMY` |
| Damage | `+20% DMG` | `×1.2 DMG` |
| Fire rate | `+20% RATE` | `×1.2 RATE` |
| Guns | `+1 GUN`, `+N GUNS` | — |
| Pierce | `+N PIERCE` | — |
| Sense | `+SENSE` | — |

#### Rounding is part of the legibility axis

Round raw values to **significant figures, not to a fixed step** — nearest-5
stops reading as a game number once armies reach the thousands. Two significant
figures gives `+50`, `+120`, `+1300`: recognisably authored at any scale.

Then make the rounding itself escalate. Early tiers round to 2 significant
figures; later tiers round to 3 (`+127`), which is harder to convert in your
head and harder to compare against `×1.24`. The legibility axis gets a second
dial for free.

### Axes

| Axis | Forms | Notes |
| --- | --- | --- |
| Army size | `+N`, `×N` | Drives both unit count (to the ring cap) and rank. |
| Fire rate | `+N% `, `×N` | |
| Damage | `+N%`, `×N` | |
| Guns | `+N GUN` | Large, discrete, obvious — include sparingly as a baseline to judge others against. **Scales past 3 held**: see below. |
| Pierce | `+N PIERCE` | Each level is worth a fixed share of a hit. **Scales past 3 held.** See below. |
| Move speed | `×1.2 MOVE` | **No direct DPS.** Buys access to future bonuses. |
| Sense | `+SENSE` | **No direct DPS.** A chance that future offers arrive with their best option marked. Capped at 3. See below. |
| Shield | `+SHIELD` | **No direct DPS.** Blocks up to 2 enemy bullets per 5s per level held. Capped at 3. See below. |

### The discrete axes scale, from three held

A flat `+1 GUN` is +100% at one gun, +33% at three and +5% at twenty — the
axis dies by attrition while RATE and DMG keep drawing from `[1.05, 1.50]`.
So from `GATES.scaleDiscreteFrom` (3) held, a GUN or PIERCE offer draws a root
like everything else and presents the **whole number whose effect is nearest
it**: `+2 GUNS` at three guns for a draw of 1.5, `+5 GUNS` at ten, `+13 GUNS`
at fifty. It is the rule raw ARMY already follows — a share of what you hold —
applied to an integer. Below three held the rule would round to `+1` anyway,
and the threshold makes that explicit rather than incidental.

### `+SENSE`: a bonus about the player

The one bonus that changes neither damage nor reach. Each level raises the
chance that an offer arrives **sensed** — with its best option marked on
screen — to 25%, 50% and 75% (raised from 25 / 40 / 50 in 0.7: a RISK axis
has to pay for itself), and it stops being offered once three are held.
The roll is made when the offer is rolled, from the seeded generator, so a
match code reproduces which offers were sensed; *which* option is marked is
recomputed live against the state the player is in now, by the same
`scoreOffer` par and the death screen use, so if taking the previous gate
changes the answer the mark moves with it.

It is **not priced**. It was for a while - as judgment, a factor on value so
that par would sometimes take it - and the author's rule now is the plain
one: a bonus that moves no damage number is worth zero to the scoring. See
"RISK: the three axes par never takes" below. `npm run model` asserts it is
priced at exactly zero and leaves the pool at the cap.

### Move speed is the deliberate oddity

`×1.2 MOVE` has no damage value at all. It makes it easier to reach the gate you
want for the rest of the run — an investment whose return depends on how long
you survive and how spread out future gates are. Offering it against a flat
`+15% DMG` is exactly the kind of call this game should be asking.

The squad should therefore start **slow enough that movement is a real
constraint**, or the bonus is worthless.

### `+SHIELD`: a bonus about surviving fire

**Added 2026-09-21 (1.1), the author's ask.** Each level held blocks up to
**2 enemy bullets every 5 seconds**, to a cap of three levels like SENSE:
a pool of `2 × level` charges refilling at that rate, spent one per bullet
whatever the bullet would have cost. A Mortar's shell (below) is one block
like a Spitter's dart, so a charge is worth twice as much against a Mortar
- that is deliberate; the shell is the bullet the player most wants
stopped. The pick fills the pool at once, so it is felt on the next volley.

It is a RISK axis: no damage number moves, it is priced at zero, par never
takes it beside a damage option, and the player is told RISK. What it buys
is army - the chip damage of standing under fire, which is the late game's
main killer for a bot that never dodges (see "Enemy fire scales with the
army") - and army is health, so a player who values their soldiers over
their DPS has a real gamble to weigh. The ring around the leader shows the
charges; the rail's fifth column shows `ready/capacity`.

### RISK: the four axes par never takes

**Decided, 2026-09-20; SHIELD joined on 2026-09-21.** `×MOVE`, `+TIME`,
`+SENSE` and `+SHIELD` change no damage
number, and the scoring prices them at **exactly zero**. For a while they
were priced by an access factor and a judgment factor so that par would
sometimes take one and the grade wash would not call every one a mistake.
The author's call is the opposite: par is a shadow player who only ever
needs DPS, so it should only ever take DPS, and these three are the
player's gamble alone. Consequences, all deliberate:

- Par never takes one unless the offer is nothing else (then the tie-break
  picks and it costs par nothing).
- The SENSE mark never lands on one beside a damage option.
- A player who takes one is told **RISK** on the field - lavender, off every
  axis colour - instead of PERFECT / GOOD / BAD, and it has its own column on
  the end screen beside MISS. It still counts as **no growth** in the
  optimal-play percentage: the gamble is real and the number says so.
- The pause screen's BONUSES tiles for the four say RISK in the same words,
  and the DETAILS page says taking one is a RISK.

The word is chosen with care. It is not a grade and not a scold: the player
is buying reach or seconds or a hint with a pick the curve will not repay,
and the game names the trade.

### Gate approach speed

Gates spawn at a fixed rate but *travel* at a speed that rises with wave number,
so later waves give you less time to judge. This is the primary difficulty lever
on the judgment axis, separate from enemy pressure.

A `−10% GATE SPEED` bonus buys thinking time for the rest of the run. Same
family as move speed: no DPS, real value. Wording needs care — "slower gates"
sounds like a downside and is not. Candidate label: **`+TIME`**.

### Dead space between gates

**Built.** As the waves go on, the bonus gates stop tiling the width: a band
of dead space opens between them and grows, so players not only need to make
the decision, but need increasing precision in movement to do so despite the
noise of everything going on - and so they can fully miss a bonus. This was a
bug fixed a while ago (a gap at wave 1 let a player slide between two blocks
by accident) and is now part of the design instead: zero until wave 4, 6px a
wave from wave 5, to 72px at wave 16, where a 180px lane holds a 108px
gate. Hard mode starts it five waves in like the other judgment levers.
A missed offer shows `MISS` at the lane line and is graded as the worst pick.

**It no longer flattens there** (the author, 2026-09-20, 0.8: "scale up two
more times, similar curve as-is, in two more increments for 5 waves rather
than flattening out completely"). A second stage runs from wave 16 to wave
26 at 2.5px a wave, ending at 97px of dead space and an 83px gate - the
leader within ±41px. The late slope is shallower than the first on purpose:
6px a wave for ten more waves would leave a 48px card that cannot hold its
own axis word, so the shape is kept and the size is what the label allows;
`GATES.minWidth` fell 100 to 80 with it. Gate speed got the same treatment
with no compromise: the 0.075-a-wave rise that used to cap at ×2.5 (wave
21) now runs to ×3.25 at wave 31, a ~2.8s descent. `npm run model` asserts
both caps land on those waves and that the curve does not flatten after
the first cap.

To keep every label legible at the narrowest width the cards became taller
and the label two-line - magnitude over axis - rather than the numbers
smaller. A late `+1840% DMG` still reads.

---

## Pierce: what is it actually worth?

Each level is worth a fixed share of an extra hit:

```
expected hits = 1 + q × P        (P = pierce level, q = 0.5)
```

so pierce 1 → 1.5×, 2 → 2×, 3 → 2.5×, 10 → 6×. Three things keep `q` below 1:

1. **Path occupancy** — the bullet must actually meet another body.
2. **Overkill** — damage past a kill is wasted, so a weak straggler behind a
   brute absorbs a hit worth far more.
3. **Screen exit** — bullets die at the top.

**This used to compound**, `1 + q + q² + … + q^P`, which is the sparse-field
model (to meet a third body you must have met a second) and at `q = 0.5` it
saturates at 2×: pierce 3 was 1.875× and no fourth level could ever be worth
more than a few percent, so the axis was dead by the third pick and no way of
drawing `+N PIERCE` could revive it. The author's read of the late game is the
other regime — seven bodies a second into a 400px lane is a dense column,
where nearly every level finds a body and the series is close to linear
anyway. So the compounding was dropped, pierce 1 stayed at exactly 1.5×, and
the axis scales with what you hold the way GUNS does.

**Measured, not assumed.** The stats now carry `hitsPerLanding` — bodies met
per shot that met anything — beside the multiplier the build is priced at.
Early, with the board sparse, a pierce-1 bot measured 1.03 to 1.27 against a
claim of 1.5, so the price is generous there; from wave 18 on it measured 2.3
to 2.75 against claims of 2.0 to 2.5, so late the price is *under* the truth.
The linear rule is honest where it matters most and kind where the board is
empty. `npm run balance` and `npm run from` print both numbers.

### Use a fixed `q`, not live density

An earlier draft derived `q` from on-screen enemy density. **Rejected**, and the
reason generalises: density swings wildly across a wave, so the value measured
at the instant of a decision is not representative of the run the bonus actually
lives through. Scoring a pick against a number that was true for one second is
worse than scoring it against a stable approximation.

So `q` is a tuned constant (**0.5**, giving 1.5× / 2× / 2.5× for pierce 1/2/3).
Pierce is worth the same share of a hit per level all run; the *relative*
gain of `+1` still falls as levels stack, which is what the scaled `+N PIERCE`
offers exist to compensate.

This is an admitted approximation — real pierce value does vary with the board.
The properties that matter more:

- **Stable**, so the death screen's verdict on a pick is still true a minute later.
- **Identical for par and player**, or the "optimal pick" marker is a lie.

Both live in `Progression.ts` with everything else.

---

## The rank ladder saturates, and it breaks more than cosmetics

Measured, not theorised. `squadDps` depends on power only through each unit's
*tier*, and tier caps at red (32 power-per-unit). With a 19-unit ring that is
**608 total power — above which extra power changes damage output not at all.**

Three consequences, all visible in the probe series:

1. **Every army-size bonus becomes worthless past 608.** `+30` and `x3` are
   identical no-ops, which quietly deletes a whole bonus axis mid-run.
2. **Par starts picking at random, including traps.** `observeGateOffer` scores
   options by resulting DPS; once DPS is flat in power, all three score equal,
   the strict `>` comparison keeps whichever was evaluated first, and par can
   take a `/2`. Seeds 1 and 3 both show par *halving* — 1448 to 729 at t=110,
   40000 to 20000 at t=140. That is not par playing badly, it is par being
   unable to tell the options apart.
3. **`hpMult` compensates into absurdity** — up to 155x base HP — because par
   DPS keeps rising through weapon upgrades while power does nothing.

So prestige ranks past red are **mechanically required, not decoration**. Until
the ladder extends, roughly a third of the bonus table is inert in the late
game and the difficulty model's reference player is unreliable.

**Extending the ladder is necessary but not sufficient.** Thresholds double,
while bonus magnitudes are drawn from `[1.05, 1.50]` — so on a ladder whose
stats *step* at each row, a `×1.2 ARMY` crosses a threshold only occasionally
and is worth exactly nothing the rest of the time. That is the same "bonus that
does not change damage output" the thesis cuts, arriving by a different route.
Damage and fire rate therefore interpolate geometrically *between* rows, and the
tier row survives as the visible rank only.

Two follow-ons regardless of how far the ladder extends:

- Ties in `observeGateOffer` must break deterministically toward the least
  harmful option, so a saturated par can never take a trap.
- `SQUAD.maxPower` (40000) is reached inside 2.5 minutes of probe play. Either
  the ladder must stretch that far or the cap should come down to something the
  ranks actually cover.

**Done, and done structurally.** Six prestige ranks moved the saturation from
608 to 38,912 rather than removing it, so the ladder is now generated: the
threshold doubles forever and the twelve authored rows are one cycle of the
palette, worn again from row 12. The cycle is unmarked on purpose - what has
to be legible is the change from one rung to the next, not which pass you are
on. `SQUAD.maxPower` survives only as an overflow guard. The bullet pool's
throughput ceiling was the same mistake on another axis, and got the same
answer: past a design cap the simulation bundles shots into heavier bullets
rather than dropping them, and the tint says so.

## Numeric legibility as a difficulty axis

The most interesting difficulty lever is not enemy HP — it is **how hard the
bonuses are to compare**.

Early waves offer round, mentally tractable numbers: `+10% DMG` against
`×1.1 DMG`. A player can do that in their head. Later waves draw deliberately
awkward values: `+12% DMG` against `×1.05 DMG`, where the right answer genuinely
depends on the build you are sitting on and cannot be eyeballed.

Implement as a **legibility tier** that escalates with wave, owning the root
multiplier table every bonus draws from (see "One root table, two
presentations"). Early tiers offer six round values; later tiers offer every
hundredth in the range, and round raw numbers to more significant figures. No
mechanic changes — only how hard the arithmetic is.

This is the axis that scales furthest, because it never stops being interesting.

**When the decimals appear today.** The author's schedule, four tiers of
five waves, built 2026-09-20: waves 1-5 draw three values (`1.1, 1.25,
1.5`); 6-10 the tenths (`1.1` to `1.5`, no `1.25`); 11-15 every `.05`;
16 on every `.01` with three significant figures, which is when `×1.07` and
`+1840%` start showing up. Hard mode is five waves ahead: tenths from wave
1, hundredths from wave 11. `npm run model` prints the whole curve per wave
under "the judgment curve".

**"No mechanic changes" was a constraint on the tables' MEAN, and the author
chose to relax it.** The original coarse table bunched low - 1.32% less per
draw than the ladders, about 48% less power over thirty offers - so moving
up a tier was a power increase wearing a legibility costume, and for a while
every tier was held to the same geometric mean within 0.5%. The round
schedule cannot meet that inside a fixed [1.05, 1.5]: the tenths sit about
**1.9% per draw above** the hundredths, the first tier 0.4%, which over ten
offers of the tenths tier is roughly +20% power. The author read those
numbers and took the round tables anyway, for their readability. `npm run
model` prints the drift per tier and fails past 2.5% per draw, so it stays a
decision on the record rather than a surprise; and the direction is at least
the kind one - the tiers a player meets while learning pay a little more, and
the drift ends as the ladders begin.

## Instant feedback on every pick

A wash over the gate the moment you take it, with the word on it:

- **green PERFECT** — optimal
- **yellow GOOD** — middle
- **red BAD** — worst of the three

and a red **MISS** at the lane line if an offer passes untaken (DDR-style; a
missed offer is graded as a BAD pick in the tally). With dead space between
gates from wave 5, MISS is now reachable in play, and lands over the option
the squad was nearest. The halo it replaced was a
circle the size of a unit on a card three times wider, and read as a hit
rather than a verdict.

The death screen teaches after the fact; this teaches *during*, which is what
actually makes players improve. Both read the same `DecisionLog` scoring, so they
can never disagree.

## Sound

Minimal, procedural, and on the same collapse rule as the rings and the
bullets: more of a thing past the point it carries information is folded
into one sound that says how much, not played more times. No music, no
files, no asset loading; the palette is a table of recipes.

What sounds, and why:

- **Every pick has a grade you can hear.** PERFECT is a rising major triad,
  GOOD is one flat note twice, BAD is a falling minor second. The halo says
  it in colour; the sound says it before your eyes have left the gate.
  A passed offer is a MISS: a quiet whiff, on, at -20 dB.
- **Kills are a texture, not a count.** One kill is a grain at 1.4 kHz. A
  burst of them inside 100 ms is ONE grain, a semitone lower per doubling
  and a little quieter, with a sub-partial from four - so a shredded wave
  reads as heavier, never as louder, and ten voices a second is the cap.
- **Damage to the army is felt, not announced.** Contact is a dull thud,
  breach a heavier one with a sweep that ducks everything else, enemy fire
  a tick. Each scales with the share of the army it cost.
- **The Titan has a heartbeat.** A swell and three warning pulses when it
  arrives, then a low pulse that quickens over its descent; a crunch and a
  released chord when it dies; a drop and a door closing when it lands on
  you. Its volleys pop, quietly.
- **Rescue, streak, wave, sense** are each a short distinct figure, and the
  SENSE chime fires when a sensed offer SPAWNS, which is when it matters.
- **Start is one soft tone**: it is also the proof the browser unlocked.

Sound is on by default, toggled from the pause screen (SOUND ON / OFF) and
remembered. Muting plays nothing. Ducking, the twelve-voice budget and the
priority order in `CLAUDE.md` exist so a Titan landing is never lost under
a stack of kills. Nothing here touches the simulation: audio reads the
event stream and a match code sounds the same on every replay.

## Seeds are shareable

Show the seed on the death screen, and let a player enter one when starting a
game. That turns a run into a challenge: replay your own, or hand a friend the
exact same sequence of waves and offers and compare scores.

**This makes determinism a hard requirement, not a testing convenience.** The
same seed must produce the same game — same enemies, same offers, same numbers —
for everyone on the same version. Consequences:

- Every consumer of randomness routes through the seeded generator. No stray
  `Math.random()`; the squad's firing jitter already caught this once.
- Anything that touches gameplay off wall-clock or frame timing breaks
  reproducibility. **Done**: the simulation advances on a fixed 1/60s step
  (`SIM` in `config.ts`) and a seed now reproduces a run exactly, which
  `npm run repeat` asserts. The instrument had to move too - a bot steering on
  wall-clock input made a deterministic game measure as nondeterministic.
- **Balance changes change outcomes.** Seeds are only comparable within a
  version, so show a version tag beside the seed and treat that pair as the
  shareable unit.

## Sharing: the screenshot is the medium

People share runs by screenshotting them, not by copying links. That single fact
drives the whole end-screen design, because **a screenshot loses the clipboard**.
Whatever identifies the match has to survive as pixels somebody can read off a
photo and type back in.

So a raw URL is the wrong primitive. `.../shooter_ad/?seed=3042291225&mode=hard`
is unreadable at thumbnail size and miserable to retype.

### Match codes

Encode seed and mode into a short, readable code — base32 over a compact
alphabet with the ambiguous glyphs dropped (no `0`/`O`, no `1`/`I`/`l`), grouped
for legibility:

```
MATCH  7K2P-9XQ4-H
```

The trailing group carries the mode, so hard runs are visibly different matches
rather than the same code with a hidden flag. The code is the source of truth;
the URL is derived from it, not the other way round.

That buys three things at once: it fits on screen at a size readable from a
photo, it is short enough to type by hand, and it is short enough to say out
loud.

### The end screen has two jobs

It is both a results page and a piece of social media, and those pull in
different directions. Resolve it by making the *shareable* version the default
layout rather than a separate export:

- **Score, enormous.** One number, instantly comparable.
- **Par delta** right under it — "12% below par" — because a bare number means
  nothing without the curve it was measured against.
- **The match code**, large, with a one-line "same match:" label so a stranger
  seeing the screenshot knows it is playable rather than decorative.
- **The decision summary** in one line: optimal / middle / worst counts. This is
  the DPS-golf scorecard in miniature, and it is what makes two runs on one seed
  worth comparing.
- A **copy-link button** for people who do copy. It is the convenience path, not
  the primary one.

The full decision table (every offer, the pick, the optimum) stays available but
scrolls below the fold. The first screenful must be the part worth
screenshotting.

### What the score should be

Proposal, open to change: **waves survived** as the headline number. It is
integer, instantly comparable, and captures both pick quality and positioning.
Under it, two subtitles:

```
        WAVE 14
   played at 82% of optimal
        18 / 7 / 3
```

`played at N% of optimal` comes from the `DecisionLog` and is the purest measure
of the actual skill the game tests. The triple is optimal / middle / worst picks.

Seeds only make runs comparable **within a version**, so a version tag belongs
on the screen too — small, but present, or people will compare scores from
different games and conclude the leaderboard is broken.

### Intake

A link carrying a match code opens on the start screen with seed and mode
already filled in and the code shown, so the player confirms rather than
configures: one button, "Start match". Never auto-start — a player who follows a
link should see what they are about to play.

### Known constraint

`navigator.clipboard.writeText` needs a secure context and can be refused inside
a sandboxed iframe. The copy button therefore cannot be the only path to the
code, which is the other reason the code has to be legible on screen. Treat a
clipboard failure as expected: fall back to showing the code large with a "type
this in" affordance rather than surfacing an error.

## Hard mode

**Built.** One wave offset, applied to the judgment axes only — see
`systems/Mode.ts`. The `targetFraction` option below was considered and
declined: it is a claim about damage rather than about the difficulty of a
decision, and raising it moves the mercy-clamp threshold, which would confound
every measurement of hard mode with a regime change.

Start the difficulty settings advanced rather than ramping into them:

- gate approach speed begins at a later-wave value, so decision time is short
  from the first offer
- bonus legibility starts at a higher tier, so awkward numbers arrive immediately
- optionally a higher `targetFraction`

Deliberately *not* "more enemy HP" — hard mode should test the same skill the
game is about, harder, rather than a different one.

## Less mercy

**Done: 1.35 → 2.5**, which moves the clamped regime from below standing 0.52 to
below 0.28. Measured with `npm run mercy` at low skill across five seeds; the
table and the reasoning are in `config.ts`.

The intent was: keep only enough to prevent a literally unwinnable state, not
enough to rescue a bad run. What the measurement added is that **the clamp was
never rescuing much** — at 1.35 nine of ten weak runs died anyway — and that 2.5
and no clamp at all measured identically, per run. So what is left is a
guarantee that enemies cannot become unkillable rather than an observed effect,
which is exactly the residue wanted, and is why it was not removed outright.

Still open, and it is the interesting half: **whether losing control now reads
as legible.** The probe can say a run ended; it cannot say the player understood
why. That needs the author playing it.

---

## The death screen is the payoff

After you die, show **every decision you made**, scored:

- each gate offer as a row of three options
- which you took
- which was optimal by the engine's own DPS delta
- the gap, and a top/mid/bottom-tier marker

This is what turns a loss into a lesson, and it is the feature that makes the
whole "judgment test" framing land. It needs a `DecisionLog` recording, for each
offer: the three `GateType`s, the player's progress state at that moment, the
choice, and the computed DPS delta for all three. Scroll for long runs.

Consider surfacing a single headline number: **"you played at 82% of optimal."**

---

## HUD and layout — decided

**Top rail** is *the run*, par always visible:

- **wave**, with kills beneath
- **your DPS**, with standing against par beneath
- **par DPS**
- **SENSE** — three pips that fill, and the chance they buy

Par is permanently on screen, not saved for the death readout. Seeing yourself
fall behind in real time is the feedback that makes the next decision mean
something. The standing bar under the rail flashes ONCE when the run crosses
the curve's target line in either direction and never pulses otherwise.

**The field says what is about to hit you.** The bottom of the lane is a
ground band, not a line, from where a full ring's front rank sits down to the
breach horizon; every body inside it puts a red tick on the horizon that
brightens as it nears. Gate cards wear a solid roof bar in their axis colour
and their labels sit above the bullet stream, so an offer stays readable
mid-wave; the card the centre unit is lined up on brightens and its siblings
fade. Damage flashes the screen's edges (sized by how much of the army went),
never the play space. Everything else - the grade wash, MISS, rescue and
contact labels, the wave banner, the Titan bar, the death beat - is a typed
`moment` from the simulation, so audio and rendering read one account.

**The Titan's bar is a third row under both panels** (2026-09-20): it sat
in the 12px fade between the rail and the strip, where the author read it
as lost in the middle of the two, and before that on the field beside
PAUSE. Now, while a boss lives, a full-width panel row appears directly
under the strip's bottom hairline with the 10px purple bar and its TITAN
tag, so the deadline reads as its own line rather than as a seam.

**Directly beneath the rail** is *the squad*: every input to the DPS
product and nothing else — **ARMY** (power and rank), DMG pool and mult, RATE
pool and mult, GUNS, PIERCE — in the order the pause screen's DETAILS page
multiplies them. ARMY moved down from the rail because it is a conversion
input exactly as the pools are, and it was the one term of the product living
at the other end of the screen; SENSE took its place because it is the one
bonus that is not a DPS input. Chosen over a right rail because the game is
540×960 portrait and widening the canvas shrinks the playfield badly under
`Scale.FIT` on a phone, which is the device this genre is played on.

**The three screens are built from the gate card** (2026-09-20, the
author's four decisions): the card is the one object a player recognises,
so it is the stat tile on the pause page, the shape of every primary button,
and the demo offer on the start screen, which is a first wave rather than a
menu - three real cards descending toward the squad on its ground band.
The pause page keeps the ruler (the lesson) and says one thing at a time: a
tapped tile's line, not ten rows. Two authored motions were allowed on
screens and both are spent: the demo offer's descent and the end screen's
waves number counting up.

**The strip sat beneath the red line until 2026-09-20 and the author moved
it.** The argument for the bottom was that the eye is already at the line;
the phone refuted it: the thumb steering the squad covers the strip, and every
conversion meant flicking the eyes from the bottom of the screen to the rail
and back. Under the rail the two readouts are one glance, the run above the
squad, and the thumb covers nothing but ground. The cost is 94px of an
offer's descent hidden behind the panel at the top of the screen, where it is
furthest from mattering - and then, at the author's ask, the lane and the
breach line moved down by the same 88px (v0.7), so the field is as tall as
it was and the squad stands where the strip used to be; every descent is
88px longer, which is the balance change. In the same pass every text size
under 18px on the
HUD and the three screens went up two to three points: at `Scale.FIT` on a
390px-wide phone the canvas is drawn at 0.72, and the 11px labels the author
had been reading were 8px.

That placement buys space at a cost: the strip is **wide and short**, so the
readout has to be genuinely parsimonious. This is real design work, not a
label dump. Every held bonus must be readable at a glance, mid-wave, while
three gates descend. Expect to iterate on it. Full itemised detail lives on the
pause screen; the strip is the glanceable summary.

---

## The probe bot needs rebuilding too

Today the bot steers toward a gate by a **fixed preference order over bonus
kinds**. Under the new taxonomy that is worthless: the whole point is that
`+12% DMG` and `×1.05 DMG` are the same *kind* and differ in value, so ranking
by kind cannot express a choice. It would measure nothing.

Rebuild it around the scoring the game already has to compute for the
`DecisionLog`: expose a DPS delta per active gate, and let the bot choose from
those.

Then add the knob that matters: **`PROBE_SKILL`**, the probability of taking the
best option, otherwise picking at random among the three. That closes the loop
between design and measurement — `DIFFICULTY.targetFraction` is a claim about
what fraction of optimal the game expects, and `PROBE_SKILL` lets you actually
test the curve against a *defined* skill level instead of against whatever a
sine wave happened to do. Probing at 0.5, 0.7 and 0.9 should produce three
visibly different difficulty experiences; if it does not, the curve is not
responding to skill and something upstream is wrong.

Smaller improvement: when no gate is in reach, steer toward the densest enemy
column rather than sweeping, so kill rate stops being an accident of phase.

Still worth stating in any report: the bot has no threat avoidance and does not
position for breaches. It is a floor on difficulty. **The design needs the
author playing it**, and no amount of instrumentation substitutes.

## Roadmap

Carried over from the earlier backlog, reprioritised against the thesis.

### Done
- **Rewrite the bonus table** to the taxonomy above; delete cut bonuses.
- **Additive/multiplicative stat model** in `Progression.ts`.
- **Fixed-`q` pierce valuation**, shared by squad and par.
- **Prestige ranks past red**, mechanically — and tier stats interpolated
  between rows, without which army bonuses stay mostly no-ops.
- **Par's ties break toward the least harmful option.**
- **HUD top rail** — wave, army power, soldiers, DPS and par DPS, with par
  permanently on screen and a standing bar marked at `targetFraction`.
- **Gate approach speed scales with wave**, plus `×MOVE` and `+TIME`. Squad
  movement is rate-limited now (it teleported to the pointer before, which made
  the whole movement economy inert) and `SQUAD.moveSpeed` came down to 260.
  Neither bonus carries damage, and since 2026-09-20 neither is priced:
  they are RISK axes, worth zero to the scoring — see "RISK: the three axes
  par never takes".
- **Active-bonus readout** beneath the red line — damage pool and mult, rate
  pool and mult, guns, and pierce priced by the shared valuation. The pool is
  the big number in each cell because it is what the raw-versus-multiplicative
  conversion actually needs; an axis at identity fades out. Full itemised
  detail still belongs on the pause screen, which does not exist yet.

### Now
5. **Three gates per offer**, and enlarge the leader unit so it is obvious the
   centre is what selects.
7. **DecisionLog + death screen readout.**
8. **Soften the mercy clamp**, re-probe — *done*, 1.35 → 2.5, with
   `npm run mercy` as the instrument. See "Less mercy" below.
10. **Escalating numeric legibility** by wave.
11. **Pick-quality halo flash** — green / yellow / red on selection.
12. **Seed display and seed entry**, with a version tag.
13. **Hard mode** — *done*. Implemented as a single wave offset (+5) applied to
    gate approach speed and legibility tier, and to nothing else: enemy
    pressure, the bonus pool and `targetFraction` are identical in both modes.
    Reachable by tapping the difficulty line on the start screen, which rewrites
    the match code as it switches. `npm run model` fails if hard mode ever grows
    a second knob.
14. **Rebuild the probe bot** on real gate scoring, with a `PROBE_SKILL` knob.

### Next
0. **Decide the delivery-ceiling question** — see "What one session of real play
   found". The bullet pool caps real throughput at ~1000 shots/s, so RATE and
   GUNS go dead late. Modelled honestly for now; the alternative is to collapse
   the stream in the simulation the way the renderer already does. **This is the
   only thing on this list that is blocked on a design decision.**
15. **Help / pause screen** — *done*, two pages. BONUSES teaches the
   conversion on the player's own pools and lists every held bonus with a
   one-line account of what it does to the sum, MOVE, TIME and SENSE
   included. DETAILS derives the rail's DPS step by step — bodies and rank,
   damage per shot, shots per second, the ring, guns, pierce, total, and the
   same total against one body — from the functions the squad fires with, so
   the last line is the rail's number by construction. `npm run endscreen`
   asserts that equality.
16. **Prestige ranks past red** — metallic / prismatic / glowing, with texture
    and particle treatment, so long runs keep a visible chase.
17. **Enemy behaviour variety** — *done*, with one thing deliberately left
    open. Movement is a `motion` union in the roster with one case each in
    `EnemyMotion.ts`: zigzag, charger, waypoint, harass (bounded retreat), dash
    (diagonal), drift. Two new types shoot back — Spitter leads the squad,
    Lancer hangs back and shells the lane — and bullets cost power through
    `ENEMY_FIRE.powerShare`, which is the second damage source the design
    wanted (contact, below, is the third).

    The Shielder was kept and made genuinely directional rather than renamed:
    its `frontArmor` only applies inside the cone it is walking into, so its
    fast lateral legs are the window where it is soft. That is a real positional
    ask, which a flat damage reduction never was. **Unmeasured, and the honest
    caveat**: the squad only ever fires straight up, so the player influences
    the angle solely by choosing *when* to shoot, not from where. Whether that
    reads as a skill or as random armour is a question for the author playing
    it; `npm run behaviour` can only confirm the taper exists.

---

## The start screen says what the game is

The pitch is the author's: *Pick the best bonuses, avoid damage, and kill the
Titan before it reaches the end — or you lose. Oh, and sub-optimal play is
SEVERELY punished. The math only gets harder. The bonuses only scroll at you
faster. Have fun!* It sits above the match code, because a player who does not
know they are being tested on arithmetic reads every offer as noise.

Beneath the code: **ENTER A CODE** (a native prompt — the medium is a
screenshot, and a code you can read off a photo but cannot type in anywhere is
decoration) and **NEW MATCH**. Both re-seed every consumer of the generator at
once. A restart now replays the *same* match from its first draw; it used to
carry the stream on under the old code, so the "same match" on the end screen
was one nobody could reproduce. The end screen offers both: tap to replay, or
start a new match.

**Buttons look like buttons, and the game explains itself to a stranger**
(the author, 2026-09-20: "why is there so many just text buttons?", "a lot
of our text explanations rely on players already knowing the game
terminology like RISK and Par", "there needs to be more explanation in
places that users can find"). Every control on the three screens is a card
button - the gate card's shape in three weights: the one filled ARMY-green
primary per screen, link-teal secondaries (ENTER A CODE, NEW MATCH, HOW TO
PLAY, COPY LINK, SOUND), loss-red RESTART - with hover and pressed states,
and the difficulty is two segments with the chosen one lit. The pause
screen has three pages: **HOW TO PLAY**, twelve tappable topics (the goal,
the cards, the sum, the top panels, taking damage, the Titan, rescues,
PAR, RISK, the score, match codes, hard mode) each explained in plain
words that never use a term before saying what it means; **BONUSES**, the
ruler and the eight tiles, every note rewritten the same way; **DETAILS**,
the DPS working. The start screen's HOW TO PLAY opens the same screen
before a run exists, against the start state's numbers, with BACK in place
of RESUME. The rail says YOUR DPS and PAR DPS with BEST PLAY under the
latter; the end screen says OF THE BEST PICKS and PEAK DAMAGE / SEC. The
demo offer on the start screen deals a different offer on every pass, six
in rotation, so the whole vocabulary is seen. The pitch is still verbatim.

## Rescue cages are a refund, and they cost something

A cage is worth **a tenth of the army you hold, whole, never less than 2**
(1.0, the author's call on 2026-09-20). It was +5 flat until 100 power and
5% after: DPS is linear in power below the ring cap, so a first-wave cage
on an army of 1 was a ×6 - five gates' worth in one pickup, standing 2 to 3
against par - and the author's read was that "getting one early on really
explodes your DPS versus par". The army is also the player's health, and it
is chipped continuously by enemy fire at 1% a hit, so the reward is priced
in that unit: a cage refunds about ten hits, early and late alike. It is
about one small ARMY gate at every size (×2.7 in DPS at power 1, ×1.1 from
19 on; `npm run rescue` prints the table off the built game). It is no
longer a catch-up - a 10% bite is under the smallest gate root - and this
section's old title said it was; the author chose the refund over raising
the share, because a larger share reopens the standing jump. **Par does not
collect it**, still: crediting the shadow player would move the curve by
exactly what the cage gave back.

It rolls once per wave duration at a **40% chance** (was 75%): the author
found it appearing too often, and early on it made keeping up with par
trivial. **For two versions the 40% was a figure on paper** (found 0.8,
2026-09-20, from the author's "rescues still feel way too common; I think
there's some glitch"): the roll's clock restarted only on a success, so a
failed roll was rolled again on the next step - sixty times a second -
until one passed, and a cage arrived within ~40ms of every deadline. The
baseline build, watched: cages at 17.0 / 32.2 / 47.5 / 61.7s on every seed,
one per wave. The clock now restarts on every roll; `npm run balance`
prints cages per minute from a counter in the stats registry, so the
frequency is a measured number rather than a constant. Frequency is the lever rather than size because the size is already
a share of the run. Par is unaffected by rescue in every way that matters to
the grade: a pick is graded against the army the player actually holds when
the offer arrives, never against par's, so extra army from a rescue simply
makes "best pick" mean best for that army. The one leak is that a `+N ARMY`
card is sized to the player's pool and par applies the same N to its
smaller one, which nudges par UP when the player is ahead - it closes the
gap slightly rather than widening it, and it is small.

### Pierce carries past a cage

**Decided, 2026-09-21 (1.2), the author's ask** ("RESCUE boxes seem not to
be affected by PIERCE but should be"). Until then the bars spent every shot
that hit them, whatever its pierce - a code comment's rule that these notes
never carried. A cage is now a body to the stream like any other: the shots
that open it spend one pierce and fly on to whatever is behind it, so a
pierce build shooting out a cage keeps the column it paid for, and the
cage's price stays what it was (its HP, a fraction of a Titan's).

## The field starts where the HUD ends

**Decided, 2026-09-20 (1.0).** Enemies and cages spawn at the bottom edge of
the three HUD rows (rail 72, strip 94, Titan row 18: y 184), not 40px above
the screen. The author: "the stacked status bars at the top now conceal too
much of the playfield, and it takes forever for, for example, a Titan to
finally be visible after spawning". Under the old line the top 224px of
every descent happened behind the panels - 6.6s of a Grunt's walk, and the
Titan's first 17.6s, on a body the column could hit and the eye could not
see. Every vertical speed is scaled by the ratio the descent shrank
(`ARENA.descentScale`, 766/990) so a body takes exactly the seconds to the
line it took before: the game is not faster, it is visible. The Titan
spawns 40px above the line so it emerges rather than pops, and its HP is
priced on its travel seconds as before, which move by 1%; it is on screen
for all but 3.4s of its descent instead of missing the first quarter. Gates
are untouched: their descent is the judgment clock and the hidden 94px was
already the author's accepted cost of moving the strip up.

## A multiplier on the army adds at least one soldier

**Decided, 2026-09-20 (1.0).** `×1.1 ARMY` on an army of 1 rounded to 1 and
did nothing; the author: "if I start at 1 and pick army × 1.1 it does
nothing for me". A multiplier now adds `max(1, round(army × (root − 1)))`,
the rule raw `+N ARMY` already used, so the open's first army gate is a real
gate whichever form it comes in. Par takes its gates through the same
function and is priced on the same floor; `npm run model` asserts both.

## No automatic army

**Decided, 2026-09-20.** There is no army for surviving a wave (`+4` was
awarded at every wave clear) and none for kill streaks (`+2` every 25 kills),
on either side - par was credited with both. The author's reasons: neither
is intuitive, both throw off the sum at the next offer (a `+N ARMY` card
against a `×ARMY` card is only decidable if you know what you hold, and a
gift arriving mid-decision changes the answer), and the streak in particular
removed agency - power that arrives for standing in the stream is not
power that was chosen. Every unit the player holds now came through a gate
or out of a cage. The army started at **5** for a session on the argument
that a start of 1 made the first leaked Grunt at ~30s the end of the run
for the bot on three seeds in five; the author took the harder open anyway
(2026-09-20, 0.9): **it starts at 1**. Measured, seeds 1-5 at skill 0.7:
median survival 50.0s at 5, 34.9s at 1; standing 1.00 either way. The one
body you start with is the run until the first gate.

Its HP is **a fifth of the Titan that would spawn now** (the boss's own
budget, so it scales with par the way the boss does): about 2.65 seconds of
par's single-target fire, at every stage of a run. That is the cost — a cage
stops every shot that hits it, so opening one is fire the wave is not taking.
Measured on the probe bot, which never aims at a cage and so pays the block
without collecting: median survival at skill 0.7 fell from 78s to 44s, and
recovered to 83s on the same seeds with cages at a fiftieth of a Titan. Read
that as the bot's floor, not the design's verdict — a human who targets the
cage is buying +2 army for three seconds early, and +10% for three seconds
late — but it is the number to watch if real play says cages feel like walls.
`CAGE.hpTitanFraction` is the lever.

## Enemy fire scales with the army

A landing bullet costs **1% of the army you hold, rounded down, never less
than one power** (times the gun's damage). A flat half-power tax went dead
once armies reached the hundreds, so enemy fire stopped being a reason to move
exactly when there was the most of it. It is still well under a contact, which
is 2% to 6% by body size (below): a body reaching you is a failure to kill,
fire is a tax on standing still.

The floor doubles the early tax (a bullet was 0.5), and the share quadruples
it at 270 power. On a bot that never dodges this is now the late game's main
killer: from injected 1e5 and 1e8 builds the runs end by attrition with
standing near zero, where before they ended at a Titan near par. That is the
designed consequence for a player who does not move; whether it is right for
one who does is a question for the author under fire.

### Shooters spawn at half weight, one new type per five waves

**Decided, 2026-09-21 (1.3), the author's call.** The fire felt too heavy
("between the Mortars and the other shooters, the difficulty curve seems
too hard in terms of enemy projectiles"). Nothing decided the shooter count
before: one weighted draw per spawn with no memory, so shooters were 21%
of every spawn from wave 7, waves shortened as spawn rates rose, and an
unkilled Spitter (33s), Mortar (41s) or Lancer (65s of harassing descent)
outlived two or three 9-14s waves, so late waves inherited the shooters of
the waves before them. A cap on LIVE shooters was proposed and declined:
it would answer every cleared ranged body with another one, where the game
is that clearing them makes the field quieter. Instead every gun type
carries **half the weight** its body would (Spitter 15, Mortar 11, Lancer
12) and they arrive one at a time - **Spitter at wave 5, Mortar at 10,
Lancer at 15** - so the pool gaining a shooter every five waves is what
steps the fire up. Shooter share of spawns: 6% at wave 5, 9% from 10, 12%
from 15, against 12 / 21 / 21% before.

The guns slowed with it, the author's numbers: the Spitter fires every
**3s** (was 2.1), the Lancer's trident every **4.5s** (2.6), the Mortar's
shell every **6s** (3.2). The Titan's fan stays at 3.4s.

### The Mortar fires a shell: one big slow bullet

**Added 2026-09-21 (1.1), the author's ask** ("one of the enemies to have a
'Big bullet' type; a slower red bullet rather than just the many small
bullets ... twice as much relative damage"). The **Mortar** is a new
medium-tier type from wave 10 (wave 6 until 1.3): a squat stone-grey pot that drifts a little
and lobs one aimed **shell** every 6s (3.2s until 1.3) - scarlet, nearly twice a dart's
radius, half a dart's speed, and `damage: 2`, so it costs twice the 1% share
a dart does (2 power at the floor, 2% of the army past 200). The point is
legibility of threat: the darts are weather, the shell is a thing you see
coming for four seconds and step out of. It is drawn as a round, never a
dart, so nothing about it says fast, and it wears a hue no body wears (the
Brute's brick red is the nearest; the shell is brighter and rounder).

Its counterweight is SHIELD, which blocks it as one bullet.

## Enemies have a hurt box

An enemy touching the army damages it and is destroyed doing so. The army
cannot hide inside the mob any more: reaching you IS the failure, not walking
a further sixty pixels to a line. Contact and breach cost the same, because
they are the same failure - a body you did not kill. The cost is a share of
the army by body size - 2% for a Grunt or Runner, 4% for the middle weights,
6% for a Brute or Bomber, floored at 1 / 2 / 3 so the first minutes play as
they did - so a leak never goes dead late the way a flat charge did at a
thousand power; the Titan is 100%, and reaching you ends the run whichever
line it crossed. The Healer is gone: a body that undid your work in the mob
made the Titan feel unfair rather than hard, and the boss check is the thing
the damage economy is for.

Two things the floors do not hide, both measured in `CLAUDE.md` under
"Contact damage": contact lands two to five seconds of descent before a
breach did, so bodies the column used to finish in those seconds are charges
now; and the Bomber's early price fell from 5 to 3 at the floor, which the
author accepted. A contact is not a kill - no streak, no kill count, no split
- because standing in the stream must never be a way to farm.

## What one session of real play found

The author played the game. That produced seven findings, several of which no
instrument here had caught in weeks of work, and it is worth saying plainly why:
every automated check in this project watches a bot that dies around wave 3 to
6, so **the entire late game has never been observed by anything but a human.**
Two of the findings are recorded here because they changed the design rather
than only the code.

### The bullet stream has to be collapsed, not merely drawn faster

At high GUNS and RATE the stream becomes a solid mass and it is visually
impossible to follow what is going on - which column is being hit, how hard, or
whether anything is getting through. That is not a performance problem. It is
the same failure the ring cap exists to prevent, arriving by a different route:
**a quantity grew past the point where more of it carries any information.**

The ring cap's answer is the model. Army beyond nineteen bodies is not drawn as
more bodies; it is spent promoting the bodies you can already see, and the shirt
colour is how you read what a unit now stands for. Bullets get the same
treatment: past a bounded visible rate, a drawn bullet stands for several real
ones and its colour says how many, on the **same ladder** the shirts use. The
player learns the idea once - *colour means this stands for more than it looks
like* - and it pays off in two places.

**The constraint that makes or breaks it: the simulation must keep firing and
colliding at the true rate.** This is a rendering change and nothing else. If
the number of bullets actually spawned moves with the number drawn, a legibility
fix has silently become a balance change, and no existing instrument would say
so - a differently-balanced game is still a deterministic one, so `npm run
repeat` passes, and `npm run sweep` can only ever report "within noise" against
spreads larger than most effects worth catching. `npm run neutral` exists for
exactly this: it plays the same seeds against the pre-change build and the
current one and asserts every sampled field is identical.

### Ordinary enemies stopped scaling, and it was a guard rail doing it

The finding was that non-boss enemies should scale at least somewhat more with
the player's damage output. The closed-loop budget already does scale them -
incoming enemy HP per second is `squadDps(par) x targetFraction x pressure`,
linear in par - so the useful question turned out to be where that linearity
**stops**.

It stopped twice, in opposite directions, and **each ceiling was concealing the
other** - which is why the knobs could not fix it and why removing either alone
would have broken the game.

The first is `DIFFICULTY.maxHpMult`, a number introduced as a guard rail against
pathological runs. Par compounds by roughly a quarter per offer, so at 400 the
budget pinned after about thirty offers - **under four minutes of play**. Past
that the wave was the same wave forever while the player kept growing. Every
later wave was free.

The second is that **`squadDps` is a claim, not a measurement.** The bullet pool
refuses to spawn past a live cap, so real throughput is the pool's recycle rate
- about a thousand shots a second. At the late upgrade state the build wants
sixteen thousand, fires eleven hundred, and delivers **7% of the damage the HUD
was showing**. Budgeting against the analytic figure means budgeting against
damage nobody can do; the only reason the game was playable is that the first
ceiling pinned the budget before that mattered.

The repair is to make the model tell the truth - `deliverableDps` - and to let
the budget, `standing`, the HUD and **the scoring** all read it. The scoring is
the part that was not obvious and is the most interesting consequence. Priced
analytically, a `x1.4 RATE` at half a million intended shots a second scores a
clean +40% and changes nothing at all: par takes it, the halo flashes green, and
the death screen tells the player their best available pick was a no-op. That is
precisely the failure recorded above for the rank ladder saturating at 608
power - "par starts picking at random, including traps" - reached by a different
road, and it announced itself the same way, as par's budgeted damage FALLING
while its analytic damage climbed.

**The open design question, and it is a real one.** Past the delivery ceiling,
RATE and GUNS genuinely do nothing, so pricing them honestly means two of six
axes go dead late. That is exactly the failure the prestige ranks exist to
prevent on the army axis, and this document is explicit that a bonus which does
not change damage output is noise. The alternative is to remove the ceiling
rather than model it: let one spawned bullet carry the damage of the several it
stands for - **the same collapse the renderer now does, applied to the
simulation** - so the axis stays live at any rate and `squadDps` becomes true
again. It costs some fidelity in overkill and pierce, and it lives in a regime
no instrument here can reach, so it is the author's call rather than a fix to be
made quietly.

Three things generalise from all of that, and the third is the one worth
keeping:

- **A guard rail on a derived quantity is a balance value in disguise** unless
  you have checked where it binds. Nothing here was wrong at the moment it was
  written; the ceiling simply sat below the reach of a system designed to grow.
- **It was invisible for the usual reason.** The probe dies far short of it, so
  no measurement this project ever took crossed it - and the absence of a
  reading looked exactly like the absence of a problem.
- **Measure a ceiling in the units the player feels.** "400" says nothing;
  "offer 30, about four minutes in" is a claim anyone can argue with.
  `npm run model` now reports the crossover that way and fails if it lands
  inside a run somebody would play.
- **Two ceilings that cancel look like no ceiling.** Neither was visible in
  play, and the game was survivable only because they happened to point in
  opposite directions. Any single-knob fix would have exposed the other.

### The Titan was three times too tough, and the constants had nothing to do with it

Real play, on the wave-5 boss: a player at roughly 1.1 of par, playing the rest
of the game as well - dodging, taking gates, missing a little - got the first
Titan down to about 75% of its HP before it landed. The budget said 0.9 of par
kills it over 75% of its descent. Three things were wrong, and only one of them
is a tuning value:

- **The firing column was ~170px wide against a 72px boss.** Each unit fired
  from its own slot, three hex rings are 96px across, and extra guns spread a
  further 72px around each unit. A perfectly placed squad landed about half its
  shots, and the budget assumed all of them. **Design: the player's damage is
  focused in a column the Titan's own width.** `WEAPON.columnWidth` is that
  number, the ring is scaled into it, and `npm run model` fails if the column
  ever grows wider than the boss's hit radius. It is 83px now — 72 read as too
  narrow in play, and the Titan grew two pixels in radius to keep the
  invariant — and it is centred on the *drawn* leader rather than the squad's
  logical centre, because under a moving finger the ring trails that centre by
  ~18px and the beam visibly left the air beside the character. It is a real
  change to how the game feels
  against ordinary enemies too - the stream is a beam now, not a curtain - and
  that is accepted: the boss check is the thing the damage economy is FOR.
- **Two multipliers were hiding inside the HP.** The boss took the wave's
  `hpMult` on top of its deadline budget, and its 35% armor was budgeted as if
  it were zero. The first made every late Titan unkillable whatever the
  constants said (the runs recorded as "survived the first Titan, died to the
  second" had in fact died to the first, at exactly the second it landed); the
  second made every Titan 1.5x its budget. Both are accounted for now, so
  `bossKillPar` and `bossKillDistance` mean what they say.
- **75% of the descent at full single-target DPS is too much to ask** of a
  player who also has to dodge, grab bonuses and miss a little. Difficulty is
  the point, but the slack has to be real. It was 30% to feel out; after
  playing it the author asked for 20% more HP, so it is **36%** now (HP is
  linear in the distance). The rest of the descent is what real play spends.

The instrument built to check those three found a fourth on its first run: a
piercing bullet was charged against the boss on every step it spent inside it,
so pierce 1 hit the Titan twice where the budget priced it at 1.5. Bullets now
meet a body once. That is a rule about what pierce IS - the shot goes through
to the NEXT body - and it holds against ordinary enemies too.

The instrument for the boss is `npm run titan`: a squad parked under the
Titan, taking no gates, and the fraction of the descent at which the boss died
next to the fraction the budget predicts. Their ratio is how much of the assumed
damage actually arrives - escorts eat some shots, the boss drifts, breaches
cost power while parked - and it is a ceiling on the player, not a verdict on
the feel. `npm run from` at a wave just below a multiple of five is the nearer
thing to a played run.

## Open questions


- **Do RATE and GUNS stay dead late, or does the simulation collapse its stream
  too?** The full argument is under "What one session of real play found". This
  is the one open question that changes what the game IS rather than how it
  reads.
- How is pierce shown to the player? The strip shows the priced multiplier
  (`×2.50` at pierce 3). Its real value swings with the board — `hitsPerLanding`
  in the stats is the measurement — and a live readout might be better, or
  might give away too much of the judgment.
- **Settled: the root table's range does not widen with difficulty.** It stays
  fixed at `[1.05, 1.50]` at every legibility tier; only granularity and
  significant-figure rounding escalate. Widening it would make picks swingier,
  and the game is about precision rather than luck.
