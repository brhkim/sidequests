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

**`q` should be derived from live enemy density, not hardcoded.** Something like
`q = clamp(activeEnemies × enemyWidth / laneWidth, 0, 0.85)`. That makes pierce
genuinely situational — strong in a dense wave, near-worthless in a thin one —
which is the most interesting property any bonus in the game can have.

The important constraint: **par and the player must value pierce with the same
function**, or the end-screen scoring lies. It goes in `Progression.ts` with
everything else.

---

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
3. **Density-aware pierce valuation**, shared by squad and par.
4. **HUD**: soldiers, DPS, par DPS.
5. **Three gates per offer**, and enlarge the leader unit so it is obvious the
   centre is what selects.
6. **Gate approach speed scales with wave**; add `+TIME` and `×MOVE` bonuses.
7. **DecisionLog + death screen readout.**
8. **Soften the mercy clamp**, re-probe.

### Next
9. **Help / pause screen** — resume, restart, options, and a full explanation of
   every bonus type. Must teach the additive-vs-multiplicative distinction, or
   the core mechanic is hidden.
10. **Prestige ranks past red** — metallic / prismatic / glowing, with texture
    and particle treatment, so long runs keep a visible chase.
11. **Enemy behaviour variety** — five of eight types currently move identically
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
