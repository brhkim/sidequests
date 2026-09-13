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

Apply the same split to damage, and to army size (`+12` vs `×1.5`).

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

Implement as a **legibility tier** that escalates with wave: bonus magnitudes are
drawn from a pool whose values get less round, and whose additive and
multiplicative forms sit closer together in value. No mechanic changes — only how
hard the arithmetic is.

This is the axis that scales furthest, because it never stops being interesting.

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
  reproducibility. Simulation must advance on a clamped, deterministic step.
- **Balance changes change outcomes.** Seeds are only comparable within a
  version, so show a version tag beside the seed and treat that pair as the
  shareable unit.

## Hard mode

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

## HUD

Expose three numbers, not one:

- **soldiers** — the visible count, capped at the ring
- **your DPS**
- **par DPS**

The player should be able to see themselves falling behind the curve in real
time, because that is the feedback that makes the next decision meaningful.

---

## Roadmap

Carried over from the earlier backlog, reprioritised against the thesis.

### Now
1. **Rewrite the bonus table** to the taxonomy above; delete cut bonuses.
2. **Additive/multiplicative stat model** in `Progression.ts`.
3. **Fixed-`q` pierce valuation**, shared by squad and par.
4. **HUD**: soldiers, DPS, par DPS.
5. **Three gates per offer**, and enlarge the leader unit so it is obvious the
   centre is what selects.
6. **Gate approach speed scales with wave**; add `+TIME` and `×MOVE` bonuses.
7. **DecisionLog + death screen readout.**
8. **Soften the mercy clamp**, re-probe.
9. **Active-bonus readout** — the player cannot judge an offer without knowing
   what they already hold. Full detail on the pause screen, plus something
   always-visible. See open questions on where it goes.
10. **Escalating numeric legibility** by wave.
11. **Pick-quality halo flash** — green / yellow / red on selection.
12. **Seed display and seed entry**, with a version tag.
13. **Hard mode** — advanced starting gate speed and legibility tier.

### Next
14. **Help / pause screen** — resume, restart, options, and a full explanation of
   every bonus type. Must teach the additive-vs-multiplicative distinction, or
   the core mechanic is hidden.
15. **Prestige ranks past red** — metallic / prismatic / glowing, with texture
    and particle treatment, so long runs keep a visible chase.
16. **Enemy behaviour variety** — five of eight types currently move identically
    because their cases fall through to `default`, and `charger` is dead code.
    Add waypoint movement, limited retreat, diagonal dashes, and **enemies that
    shoot back** (needs an enemy projectile system and squad damage from fire,
    not only from breaches). Fix `shielder`, whose "frontal armour" is
    direction-independent.

---

## Open questions

- Does army size stay a bonus axis at all? It drives rank, which drives DPS, so
  it is on-thesis — but `×N` army is the *least* ambiguous bonus in the set and
  may be the next thing to cut.
- How is pierce shown to the player? Its value swings with the board, so a
  static label undersells it. A live "≈1.6×" readout might be better — or might
  give away too much of the judgment.
- Should par be visible *before* the choice, or only in the death readout?
  Visible is kinder and might remove the tension the game runs on.
- **Where does the always-visible bonus readout go?** A dedicated right rail
  outside the play area is the clearest, but the game is 540×960 portrait and
  widening the canvas to fit a rail makes the play area shrink badly under
  `Scale.FIT` on a phone. Candidates: a compact chip row under the HUD (works
  everywhere, less detail); a rail that only appears on wide screens and
  collapses to a toggle on narrow; or accepting a smaller playfield. Needs a
  decision before the readout is built.
