# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo.
The author played the game and asked for eleven changes; all eleven are built,
measured and pushed to `claude/laughing-feynman-ghh9r3` as one commit on top of
`fae7aba`. `main` is untouched and no PR is open. The version tag went 0.3 to
0.4: every seed is a different match now. Nothing here is blocked; section 4
is what to do next, and most of it is questions for the author about how the
new numbers FEEL, which no instrument here can answer.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, plus a section on subagents
   sharing one working tree.
2. `shooter_ad/CLAUDE.md` — how the code works. Read **"Measurement is the hard
   part here"** twice, then the four newest sections: "Pierce is linear, and the
   price is measured against the board", "`+SENSE` is a roll at spawn and a
   mark computed live", "A match is re-seedable, and a restart replays it", and
   the Titan section's note on the 83px column.
3. `shooter_ad/notes.md` — **the design intent**, and the most important document
   here. If it and `CLAUDE.md` disagree, `notes.md` wins and `CLAUDE.md` is stale
   — say so rather than quietly following the code. New this session: "The
   discrete axes scale", "`+SENSE`", the rewritten "Pierce: what is it actually
   worth?", "The start screen says what the game is", "Rescue cages are the
   catch-up", "Enemy fire scales with the army", and the HUD layout decision.
4. `git log --oneline -25` — commit messages carry the reasoning.

Then:

```bash
cd shooter_ad && npm ci && npm run build && npm run verify && npm run model
npm run hud        # the strip: ARMY | DMG | RATE | GUNS | PIERCE; the rail: WAVE | DPS | PAR | SENSE
npm run endscreen  # start-entered, pause-mid, pause-details, sense-mark, end-good
```

Do not start until you have seen `.verify/screenshot.png` render, and look at
`.verify/sense-mark.png` and `.verify/pause-details.png` - those are the two
new screens.

## 2. What the game is

**DPS golf.** Every few seconds you are shown three bonuses and must judge,
before they arrive, which most increases your damage output.

A stat is `base × (1 + pool) × mult`. `+10% DMG` adds to the pool; `×1.1 DMG`
multiplies the base, which the pool then amplifies. A raw draw is **scaled to
your current pool** — `a = (root − 1) × (1 + pool)` — so at a +210% pool a root
of 1.1 presents as `+31% DMG` and is worth exactly ×1.10. Neither form is ever
dominant; the player's skill is doing the conversion. The discrete axes now
follow the same rule: past three held, `+N GUNS` and `+N PIERCE` are the whole
number whose effect matches a draw.

## 3. What landed this session, item by item

The author's list, in their numbering, with what shipped and what it measured.

1. **Firing column 15% wider, centred on the character.** `WEAPON.columnWidth`
   72 → 83; the Titan's radius 36 → 38 so `npm run model`'s invariant (half the
   column inside the boss's hit radius) still holds. The column is now centred
   on the DRAWN leader, not `squad.x`: units ease toward slots, so under a
   moving finger the ring trailed the centre by ~18px and the beam left the
   air beside the character - that was the "off-centre". `npm run titan`
   median delivery 1.00 over six kills at 1e5 and 1e8 (it was 0.98).
2. **Rescue cages.** +5 army until 100 held, then +5%, whole; **par no longer
   collects cages**; HP is a fifth of the Titan that would spawn now
   (`CAGE.hpTitanFraction`), which `npm run model` shows is 2.65s of par
   single-target fire at every par. **Measured cost on the probe bot**, which
   never aims at a cage and so pays the block without collecting: see §4.
3. **GUNS scale past 3.** `Progression.discreteAmount`: from
   `GATES.scaleDiscreteFrom` held, the offer draws a root and presents
   `round((root − 1) × guns)` guns, floor 1. `+2 GUNS` at three for a 1.5 draw,
   `+5` at ten, `+13` at fifty. Labels carry the applied number;
   `npm run model` asserts it.
4. **PIERCE scales past 3, and the valuation is linear.** `pierceMultiplier`
   is `1 + 0.5 × P` (was the geometric series saturating at 2×). The offer
   rule is the same as guns. The instrument built before shipping it:
   `hitsPerLanding` in the stats, printed by `balance` and `from`. Early
   pierce-1 bots measure 1.03 to 1.27 against a 1.5 claim; from wave 18 on,
   2.3 to 2.75 against 2.0 to 2.5. **The price under-claims late**, which is
   the safe side.
5. **Match code entry on the start screen.** "enter a code" (a native prompt;
   the decoder already forgives case, dashes and O-for-0) and "new match".
   Re-seeding is real: `GameScene.rng` is an indirection over `rngImpl`, and
   `restart()` re-seeds too, so **tap-to-replay replays the same match** - it
   used to continue the stream under the old code. The end screen offers
   "replay this match" and "start a new match". `npm run endscreen` presses
   every one of these.
6. **Start screen pitch**, the author's copy near verbatim, above the code.
7. **Pause screen**: two tabs. BONUSES keeps the ruler and lists all ten held
   things with one-line notes (MOVE, TIME, SENSE included, SENSE with its
   25/40/50%). DETAILS derives the rail's DPS in six steps from the shared
   functions; `npm run endscreen` asserts its total equals the rail's.
8. **ARMY moved to the bottom strip**, SENSE took its rail slot. Strip is
   ARMY 100 | DMG 128 | RATE 128 | GUNS 92 | PIERCE 92; play space unchanged.
9. **Titan +20% HP**: `bossKillDistance` 0.3 → 0.36 (HP is linear in it; the
   author's "30% of the distance" reading was right).
10. **Enemy bullets cost `max(1, floor(0.01 × power))`** (`ENEMY_FIRE.powerShare`,
    `minCost`); `SQUAD.fireLoss` is gone. Early tax doubles (0.5 → 1), late
    tax is 1% instead of a vanishing flat 0.5.
11. **`+SENSE`.** Axis, candidate (weight 30, wave 2+), `Upgrades.sense` capped
    at 3, chance 25/40/50% (`SENSE.chance`), rolled once per offer at spawn
    from the seeded stream (always drawn, so the stream is sense-independent),
    the mark computed live on the currently-best option, priced as
    `1 + 0.4 × chance` in `progressValue` beside access, filtered out of the
    pool at the cap, three pips in the rail, full explanation on the pause
    screen. `npm run model` asserts the first beats `×1.05 DMG` and loses to
    `×1.25 DMG`.

### What the instruments say

All on the committed build, seeds as stated, skill 0.7, simulated seconds.

- `npm run verify` PASS; `npm run model` PASS with the new sections;
  `npm run hud` delivery 100% at every forced state, refused 0;
  `npm run repeat` **PASS, 0.00% spread** (44.1s, wave 3, 4 decisions, 86%,
  15 kills on all three); `npm run endscreen` errors 0.
- `npm run balance`, seeds 1–5, against the numbers recorded for `4175017`:

  ```
                  survival (s)                         median   optimal   standing   breach/min   fire/min
  before (4175017) 54.4, 59.4, 78.1, 93.0, 101.5       78.1     63%       0.55       25.2         -
  after            41.6, 42.9, 44.1, 46.6, 87.2        44.1     78%       0.86       15.4         0.0
  cages at 1/50    42.9, 46.6, 82.9, 88.0, 124.0       82.9     71%       0.87       18.9         9.5
  ```

  The third row is an A/B built with only `CAGE.hpTitanFraction` changed
  (0.2 → 0.02), everything else identical, measured with `PROBE_DIST`. **The
  early-game drop is the cage HP**: a fifth of a Titan is ~3s of the whole
  early stream, a cage in the column blocks every shot for that long, and the
  bot never aims at one so it pays the block and never collects. Seeds 1 and
  2 are short in every row and were 54/59 before; the stream changed (a sense
  roll per offer, a new candidate), so those two are different matches, not a
  measured effect. Standing rose because par no longer collects cages and
  sometimes spends a pick on SENSE.
- `npm run titan`: median delivery 1.00 over six kills (1e5: 1.00 / 1.07 /
  0.69; 1e8: 0.95 / 1.04 / 0.69). At the dps-30 state the parked 8-power
  squad **dies before the boss lands on all three seeds** (it killed it 3/3
  before): a Titan volley is five bullets and now costs 5 power instead of
  2.5, and a parked squad eats every one.
- `npm run from -- --dps=1e5` (start wave 18) and `--dps=1e8` (start wave 29):

  ```
  1e5  seed  survived  waves     standing at end  breach/min  fire/min  died       pierce claim/measured
         1    100.7s   18 -> 29      0.04            37.5       98.3    attrition  p2 2.00 / 2.42
         2     36.7s   18 -> 21      0.09            34.3       75.2    attrition  p2 2.00 / 2.33
         3     52.9s   18 -> 23      0.12            22.7       82.8    attrition  p2 2.00 / 2.31
  1e8    1     71.8s   29 -> 36      0.26            74.4        -      TITAN      p3 2.50 / 2.75
         2     86.0s   29 -> 38      0.02            82.3        -      attrition  p2 2.00 / 2.67
         3     69.5s   29 -> 36      0.09            98.4        -      attrition  p2 2.00 / 2.60
  ```

  Before this session the same 1e5 batch survived 136 / 136 / 56s and died to
  the wave-30 Titan at standing 0.22 to 0.33. **Fire loss is now three times
  breach loss** for a bot that never dodges, and its power collapses long
  before a Titan can matter. That is item 10 doing exactly what it says for a
  player who does not move. The pierce columns are the good news: measured
  hits exceed the claim at every late state.

## 4. What to do next — questions for the author, then tuning

- **Do cages feel like walls or like targets?** The bot says walls (median
  survival halved); a human who aims at one is buying +60% army early and +5%
  late for ~3s of fire. If they feel like walls, `CAGE.hpTitanFraction` is the
  lever (0.1 is ~1.3s) and the A/B above is the method. Do not touch the
  reward or par's exemption - those are the catch-up mechanic the author asked
  for.
- **Is 1% per bullet right for a player who dodges?** The bot cannot, and it
  now bleeds out late rather than meeting the Titan. `ENEMY_FIRE.powerShare`
  and `minCost` are the levers; `npm run from -- --dps=1e5` prints fire/min
  next to breach/min. A bot that sidesteps volleys would be the honest
  instrument and does not exist.
- **Is the first SENSE worth 10%?** `SCORING.senseWeight` sets it. `npm run
  model` prints what par spends on it; if real play says players never take
  it, raise the weight; if they always do, lower it. Whether the mark READS
  in motion is unverified - stills only.
- **The early Titan.** A parked 8-power squad now dies under the wave-5 boss
  to its volleys. Real early play moves, but the volley is a quarter of an
  early army; watch for it.
- **Bullets still do not get fatter.** Unchanged from last session; the tint
  ladder is what shipped.

## 5. Ground rules

- **A typecheck is not verification, and neither is a green exit code.** Look
  at the images. Seven bugs on this branch were found that way; this session's
  were a start-screen line wrapping into the next, a tappable Text in a
  Container that was never hit, and match controls that were never wired on
  instrument pages.
- **The simulation runs on a fixed 1/60s step** (`SIM`). Nothing gameplay-
  affecting may read a real frame delta. `npm run repeat` keeps this honest.
- **Measure in simulated seconds, never wall-clock** (`stats.elapsed`).
- **`Progression.ts` is the single definition of squad strength; `Scoring.ts`
  prices every offer exactly once; `Mode.ts` holds the run's difficulty.**
  `progressValue` is `squadDps × accessFactor × senseFactor`; difficulty reads
  raw `squadDps` and must never see the other two.
- **The sense roll is always drawn.** Gate it on the player's sense and every
  seed becomes a different match depending on what the player picked.
- Commit subjects prefixed `shooter_ad:`. Stage **explicit paths**, never
  `git add -A`.
- **No CI on pull requests**, by the user's choice. Your local `verify` is the
  real gate.

## 6. Known gaps — name these as unverified if you report on them

- **Nothing here has been played by a human since the eleven changes.** Every
  balance figure above is the probe bot, which does not dodge and does not aim
  at cages - the two things this session made expensive.
- **The SENSE mark has been seen in one still.** Not in motion, not on a phone.
- **`hitsPerLanding` is cumulative over a run**, so it lags a pierce pick;
  the late-game figures come from builds that held their pierce from the
  start and are clean. A mid-run pick would blur it.
- **The cage A/B isolates HP only.** Par's exemption and the reward change
  ride in both arms; their effect on the bot is unmeasured and expected small.
- **The 1e8 fire/min column is blank** - that batch ran before the column
  existed. The 1e5 batch was rerun for it; rerun 1e8 if the number matters.
- **Nothing is verified at true phone scale.** 540×960 PNGs only.

## 7. Settled — do not relitigate

- Raw draws scale to the pool; `npm run model` guards this on both means.
- Scoring prices access AND judgment; `Difficulty` budgets DPS without either.
  `×MOVE`, `+TIME` and `+SENSE` never contribute to par's enemy budget.
- Pierce is linear in `q`, and `q` is a fixed constant, not live density. The
  instrument to argue with is `hitsPerLanding`, not intuition.
- The discrete axes scale from three held, by the same rule as raw ARMY.
- Par does not collect cages. That IS the catch-up mechanic.
- Match codes, not raw seed URLs. A restart replays the match the code names.
- The render collapse is rendering only; the simulation collapse is balance.
- The palette cycles and the cycle is unmarked.
- The Titan is pinned to par SINGLE-TARGET DPS; the cage is a fixed fraction
  of the Titan.
- Hard mode is a wave offset on the judgment axes only.

## 8. How to report

What landed, what the instruments say (with seeds), what you could not verify,
and what you would do next. **Name unverified claims as unverified.** This
project has been fooled by its own instruments six times and found two ceilings
and a fourth Titan multiplier with instruments built to check something else;
this session it built the pierce instrument BEFORE changing the pierce price,
and the price turned out conservative rather than generous - which is the
order to do things in.
