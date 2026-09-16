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
| Guns | `+1 GUN` | — |
| Pierce | `+1 PIERCE` | — |

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
| Guns | `+1 GUN` | Large, discrete, obvious — include sparingly as a baseline to judge others against. |
| Pierce | `+1 PIERCE` | Value depends on enemy density. See below. |
| Move speed | `×1.2 MOVE` | **No direct DPS.** Buys access to future bonuses. |

### Move speed is the deliberate oddity

`×1.2 MOVE` has no damage value at all. It makes it easier to reach the gate you
want for the rest of the run — an investment whose return depends on how long
you survive and how spread out future gates are. Offering it against a flat
`+15% DMG` is exactly the kind of call this game should be asking.

The squad should therefore start **slow enough that movement is a real
constraint**, or the bonus is worthless.

### Gate approach speed

Gates spawn at a fixed rate but *travel* at a speed that rises with wave number,
so later waves give you less time to judge. This is the primary difficulty lever
on the judgment axis, separate from enemy pressure.

A `−10% GATE SPEED` bonus buys thinking time for the rest of the run. Same
family as move speed: no DPS, real value. Wording needs care — "slower gates"
sounds like a downside and is not. Candidate label: **`+TIME`**.

---

## Pierce: what is it actually worth?

Not 2×, and the reason matters.

A piercing bullet only hits a second enemy if one happens to be behind the
first, in the bullet's path, before it leaves the screen. So:

```
expected hits = 1 + q + q² + ... + q^P        (P = pierce level)
```

where `q` is the chance of encountering another enemy after a hit. Three things
push `q` below 1:

1. **Path occupancy** — the bullet must actually meet another body.
2. **Overkill** — damage past a kill is wasted, so a weak straggler behind a
   brute absorbs a hit worth far more.
3. **Screen exit** — bullets die at the top.

This gives natural diminishing returns: at `q = 0.5`, pierce 1 → 1.5×, pierce 2
→ 1.75×, pierce 3 → 1.875×.

### Use a fixed `q`, not live density

An earlier draft derived `q` from on-screen enemy density. **Rejected**, and the
reason generalises: density swings wildly across a wave, so the value measured
at the instant of a decision is not representative of the run the bonus actually
lives through. Scoring a pick against a number that was true for one second is
worse than scoring it against a stable approximation.

So `q` is a tuned constant (start at **0.5**, giving 1.5× / 1.75× / 1.875× for
pierce 1/2/3). Pierce becomes a clean diminishing-returns axis: strong as a
first pick, weak as a fourth.

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

**"No mechanic changes" is a constraint on the tables' MEAN, not only on their
range, and the first draft broke it.** The original coarse table bunched low -
1.32% less per draw than the ladders, about 48% less power over thirty offers -
so moving up a tier was a power increase wearing a legibility costume. Every
tier's table must now be symmetric about the middle of the range; `npm run
model` fails otherwise.

## Instant feedback on every pick

A halo flash on the gate the moment you take it:

- **green** — optimal
- **yellow** — middle
- **red** — worst of the three

The death screen teaches after the fact; this teaches *during*, which is what
actually makes players improve. Both read the same `DecisionLog` scoring, so they
can never disagree.

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

`DIFFICULTY.maxOverPlayer` currently caps enemy pressure at 1.35× what the
player can actually kill, so a bad run stays recoverable. That fought the death
spiral, but it also blunts the point: **losing control should be legible and
fast.** You made bad calls, your DPS fell behind the curve, and now you are
watching the consequence.

Soften it substantially. Keep only enough to prevent a literally unwinnable
state (enemies that cannot be killed at all), not enough to rescue a bad run.
Re-measure with the probe after changing it — this is the constant most likely
to make the game miserable if overcorrected.

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

**Top rail** carries the numbers, par always visible:

- **soldiers** — visible count, capped at the ring
- **your DPS**
- **par DPS**

Par is permanently on screen, not saved for the death readout. Seeing yourself
fall behind in real time is the feedback that makes the next decision mean
something.

**Directly beneath the red line** sits the active-bonus readout. The player's
eye is already there — it is where the threat resolves — so it costs no extra
attention. Chosen over a right rail because the game is 540×960 portrait and
widening the canvas shrinks the playfield badly under `Scale.FIT` on a phone,
which is the device this genre is played on.

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
  Neither bonus carries damage, so scoring values a state as
  `squadDps × accessFactor(reach)` while difficulty keeps budgeting raw
  `squadDps` — see `CLAUDE.md`. **Still owed**: the active-bonus strip does not
  show MOVE or TIME, so a player cannot read the pool the conversion needs.
- **Active-bonus readout** beneath the red line — damage pool and mult, rate
  pool and mult, guns, and pierce priced by the shared valuation. The pool is
  the big number in each cell because it is what the raw-versus-multiplicative
  conversion actually needs; an axis at identity fades out. Full itemised
  detail still belongs on the pause screen, which does not exist yet.

### Now
5. **Three gates per offer**, and enlarge the leader unit so it is obvious the
   centre is what selects.
7. **DecisionLog + death screen readout.**
8. **Soften the mercy clamp**, re-probe.
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
15. **Help / pause screen** — resume, restart, options, and a full explanation of
   every bonus type. Must teach the additive-vs-multiplicative distinction, or
   the core mechanic is hidden.
16. **Prestige ranks past red** — metallic / prismatic / glowing, with texture
    and particle treatment, so long runs keep a visible chase.
17. **Enemy behaviour variety** — *done*, with one thing deliberately left
    open. Movement is a `motion` union in the roster with one case each in
    `EnemyMotion.ts`: zigzag, charger, waypoint, harass (bounded retreat), dash
    (diagonal), drift. Two new types shoot back — Spitter leads the squad,
    Lancer hangs back and shells the lane — and bullets cost power through
    `SQUAD.fireLoss`, which is the second damage source the design wanted.

    The Shielder was kept and made genuinely directional rather than renamed:
    its `frontArmor` only applies inside the cone it is walking into, so its
    fast lateral legs are the window where it is soft. That is a real positional
    ask, which a flat damage reduction never was. **Unmeasured, and the honest
    caveat**: the squad only ever fires straight up, so the player influences
    the angle solely by choosing *when* to shoot, not from where. Whether that
    reads as a skill or as random armour is a question for the author playing
    it; `npm run behaviour` can only confirm the taper exists.

---

## Open questions


- How is pierce shown to the player? Its value swings with the board, so a
  static label undersells it. A live "≈1.6×" readout might be better — or might
  give away too much of the judgment.
- Nothing currently blocked on a decision.
- **Settled: the root table's range does not widen with difficulty.** It stays
  fixed at `[1.05, 1.50]` at every legibility tier; only granularity and
  significant-figure rounding escalate. Widening it would make picks swingier,
  and the game is about precision rather than luck.
