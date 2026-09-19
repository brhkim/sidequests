# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo.
The redesign roadmap is complete, both playtest findings have landed, the
looping-palette plan has been **built and measured**, and the Titan has been
re-sized against the four multipliers that were hiding in it (Part D, the
newest work), all pushed to `claude/laughing-feynman-ghh9r3`. `main` is
untouched and no PR is open. Nothing here is blocked; section 4 is what to do
next and it is a set of questions for the author, not a build.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, plus a section on subagents
   sharing one working tree.
2. `shooter_ad/CLAUDE.md` — how the code works. Read **"Measurement is the hard
   part here"** twice, and then **"Ordinary enemies stopped scaling, and three
   ceilings were hiding each other"**, which is the newest entry in the same
   genre: an instrument built to prove one ceiling was gone found a third one
   nobody knew about.
3. `shooter_ad/notes.md` — **the design intent**, and the most important document
   here. If it and `CLAUDE.md` disagree, `notes.md` wins and `CLAUDE.md` is stale
   — say so rather than quietly following the code.
4. `git log --oneline -25` — commit messages carry the reasoning, including two
   explicit retractions and one withdrawal.

Then:

```bash
cd shooter_ad && npm ci && npm run build && npm run verify && npm run model
npm run hud     # look at hud-late.png (gold bullets), hud-cap.png and hud-loop.png (the palette wraps)
```

Do not start until you have seen `.verify/screenshot.png` render.

## 2. What the game is

**DPS golf.** Every few seconds you are shown three bonuses and must judge,
before they arrive, which most increases your damage output.

A stat is `base × (1 + pool) × mult`. `+10% DMG` adds to the pool; `×1.1 DMG`
multiplies the base, which the pool then amplifies. A raw draw is **scaled to
your current pool** — `a = (root − 1) × (1 + pool)` — so at a +210% pool a root
of 1.1 presents as `+31% DMG` and is worth exactly ×1.10. Neither form is ever
dominant; the player's skill is doing the conversion.

## 3. What landed this session, and what it measured

All three parts of the previous plan are in. Each is a deliberate balance
change in a regime the probe bot never enters, so `npm run neutral` against a
pre-change snapshot was run as a RECORD rather than an assertion, and it came
back **identical terminal state on all five seeds (93.8s / 57.9s / 103.2s / 124s / 54.8s)** — the probe's whole run sits under every ceiling that was
removed.

### Part A — the ladder has no last row

`data/tiers.ts` now generates rows: `threshold(n) = 2^n` forever, damage and
fire rate continuing at the per-doubling ratio extracted from the twelve
authored rows (×1.80 and ×1.08), and the authored rows are one CYCLE of the
palette — row 12 wears Grey again, row 20 Gold again. **The cycle is unmarked
on purpose**; the author's call is that adjacent-rung contrast is what has to
read, not cycle identity. `tierRow(n)` is the only way to get a row.

`SQUAD.maxPower` is an overflow guard at 1e15 (2^53 is the real line for
`unitShares`), documented as numeric. `npm run model` asserts the army bonus is
worth the same ~19% at 1e12 power as at 19, that every row up to the guard is
strictly stronger than the last, and that `squadDps` is finite there.

### Part B — unbounded delivery, as (b), bundle with spill

It stayed simple, so the fallback to (a) was not needed. Per bullet the state
is a histogram of shots by remaining pierce — a `(pierce + 1)`-entry array —
and `Bullets.strike` resolves a body meeting it as the thin-shot model at one
instant: the body consumes `ceil(hp / perShot)` shots from the lowest pierce
level up (the leading edge of the stream meets the next body first), each
spends one pierce, the rest fly on untouched. A one-shot bullet reduces to the
old rule exactly. `npm run model` asserts the rule case by case, including the
one this session got wrong twice by hand (seven shots with one pierce are
charged fourteen times across EIGHT two-hp bodies, not seven).

- `WEAPON.maxSimShotsPerSecond` is **300**, the author's first value, and
  `maxBullets` is derived from it (342). `deliverableDps` and
  `MAX_SHOTS_PER_SECOND` are gone; there is one `squadDps` and the budget, the
  HUD, `standing` and `Scoring` all read it. No overkill factor in the budget:
  the bundle wastes at most one shot per body, which is what a thin stream
  wastes.
- The tint encodes **K × M** (sim bundle × render stride). `hud-late` is gold
  bullets at density ×282; `hud-loop-gold` is density ×2071.
- `npm run hud`: delivery 100% at every forced state up to 124,000 shots/s,
  spawns flat at ~300/s, drawn flat at ~55, refused 0 (the script now fails on
  a refusal).

**A third ceiling was found by that measurement.** With the pool no longer
refusing, the late state still fired 81 bullets/s. `fire` advanced each unit's
cooldown once per step, capping a unit at 60 shots/s — 4,560 shot events for a
full ring with four guns, whatever the build wanted. A unit now fires every
shot it is owed in a step. It had been invisible behind the pool ceiling, which
sat lower.

### Part C — `npm run from`

Plays real seeded runs from an injected `Progress` at a chosen wave, with par
set EQUAL to it (`Difficulty.seedPar`) so the question is "can a player at
standing 1.0 survive here?". `--dps=1e6` fast-forwards a par-shaped build
through the shipped roller and scoring; the `Upgrades` fields set one by hand;
`--wave=N` matches the enemy pool, spawn curve and gate speed. The seam is
`window.__startOverride`, never a URL parameter. `PROBE_DIST` now points every
probe at another build, and the sweep reports **peak power**.

What it measured, three seeds each, skill 0.7, 150s budget (`+` = hit the
budget, survival is a floor):

```
--dps=1e5   par-shaped: power 58 (Green), dmg +111% x2.56, rate +270% x7.14, guns 4, pierce 1 - 5,897 shots/s, bundle x19.7, start wave 17
  seed   survived   waves     standing at end   optimal   breach/min   peak power   end DPS    par DPS    died
     1      91.4s   17 -> 26         0.51          67%         32.2          383   5.0e+6     1.0e+7    TITAN
     2      91.4s   17 -> 26         0.55          64%         16.4          322   3.5e+6     6.7e+6    TITAN
     3      91.4s   17 -> 26         0.45          71%         40.0          309   2.0e+6     4.7e+6    TITAN

--dps=1e7   power 239 (Purple), guns 4, pierce 1 - 35,621 shots/s, bundle x118.7, start wave 25
     1     107.8s   25 -> 36         0.38          44%         82.9         1017   2.2e+8     6.0e+8    yes*
     2     107.8s   25 -> 36         0.60          69%         20.6          571   4.1e+8     7.0e+8    yes*
     3     107.8s   25 -> 36         0.38          60%         29.5         1230   4.9e+8     1.3e+9    yes*

--dps=1e9   power 888 (Red), guns 5, pierce 1 - 214,401 shots/s, bundle x714.7, start wave 33
     1      80.8s   33 -> 41         0.91          95%         19.3         1541   2.4e+10    2.7e+10   yes*
     2      80.8s   33 -> 41         0.65          72%         38.6         2690   1.2e+10    1.9e+10   yes*
     3      80.8s   33 -> 41         0.64          70%         52.7         2541   2.0e+10    3.1e+10   yes*

--power=100000 --guns=3 --damageMult=6 --rateMult=3 --pierce=2 --damageBonus=8 --rateBonus=3 --wave=15
            power 100,000 (Grey, row 12 - the second cycle), 4,712 shots/s, bundle x15.7
     1       112s   15 -> 26         0.63          73%         15.0       294028   1.6e+10    2.5e+10   yes*
     2       112s   15 -> 26         0.77          73%         10.7       285940   3.0e+10    3.9e+10   yes*
     3       112s   15 -> 26         0.68          82%         10.7       507496   4.3e+10    6.3e+10   yes*
```

`*` these three batches were played before the `cause` column existed; their
deaths are inferred from the clock, and the inference is the same one the 1e5
batch then confirmed directly. Wave durations do not depend on the seed, so a
Titan spawned at a multiple-of-five wave lands at the same simulated second on
every seed: 107.8s is the wave-35 Titan from a wave-25 start, 80.8s the wave-40
Titan from wave 33, 112s the wave-25 Titan from wave 15. Rerun any batch on the
current build and the column will say so.

Four things those rows establish, and one they do not:

- **Every ceiling is gone in a played run.** DPS, par DPS and enemy HP keep
  moving through 1e10; peak power reaches 300,000 to 500,000 from the hand
  state, an order of magnitude past the old cap, with the ring in its second
  palette cycle; the bundle runs at x15 to x715 with nothing refused.
- **The Titan is the thing that ends a late run, every time.** Twelve runs,
  twelve Titan landings, zero deaths by attrition. The bot survives the FIRST
  Titan it meets in three of four batches (its standing is still near 1.0)
  and dies to the second, by which point it has slipped to 0.4 to 0.7 of par.
  This is the first time the Titan-as-loss path has been observed at all, and
  it is doing exactly what `notes.md` asked of it: a damage check sized
  against par, fatal when missed.
- **Seed 1 at 1e9 died to a Titan at standing 0.91.** The Titan is sized so
  0.9 of par kills it over 75% of its descent; a bot at 0.91 that is chasing
  gates rather than standing under the boss does not. Read that as the bot's
  positioning, not as the budget being wrong - but it is the number to watch
  if a human reports the same.
- **Standing decays from 1.0 at the same rate as it does from wave 1.** The
  bot at skill 0.7 sits at 0.69 to 0.98 median over these runs, which is the
  same band the sweep reports from a cold start. The late game is not
  measurably harder or easier for the bot than the early game, per unit of
  decision.
- **What it does not say:** whether any of this is fun, whether the lumping
  of fat bullets reads badly against small bodies, or what a human's standing
  does past wave 30. Three seeds of a bot that cannot dodge is a floor.

### Part D — the Titan sized honestly (commit `4175017`)

**The finding, from real play:** a player at ~1.1 of par, dodging and taking
gates, got the first Titan to 75% of its HP before it landed. The budget said
0.9 of par kills it over 75% of its descent. Four things sat between the
constants and the game, and `shooter_ad/CLAUDE.md` ("The Titan budget, and
the two multipliers hiding in it") carries the reasoning for each: the wave's
`hpMult` was applied to the boss; armor was not in the budget; the firing
column was ~170px against a 72px boss; and a piercing bullet had no re-hit
guard, so one pierce-1 shot struck the boss twice. `bossKillDistance` came
down from 0.75 to **0.3** as the author's next value to feel out.

`npm run titan` is the instrument built for this: a squad parked UNDER the
boss, taking no gates, and where on its descent the boss died next to where
the budget says it should. Their ratio is the **delivery**. Before the re-hit
guard it read 1.3 at pierce 1 on every seed. After, on the committed build:

```
dps 3e+1   power 8,   guns 1, pierce 0   delivery 0.94 / 1.09 / 1.23   killed 3/3
dps 1e+5   power 58,  guns 4, pierce 1   delivery 0.98 / 0.90 / 1.01   killed 3/3
dps 1e+8   power 386, guns 4, pierce 1   delivery 1.01 / 0.80 / 0.94   killed 3/3
median delivery 0.98 over 9 kills; errors 0
```

1.0 is the budget's assumption exactly; the spread either side is escorts,
drift and breaches on a bot that does not move. **The sentence in the config
is now true of the shipped game**, which it was not by a factor of 1.3 x 1.54
x ~2 x `hpMult` before this commit.

**This is the first change on the branch the probe bot CAN see**, because the
re-hit guard and the narrower column both touch ordinary bodies. The
before/after `npm run balance` pair, seeds 1–5, skill 0.7, before on a
snapshot of the parent commit `5cf040a` and after on `4175017`:

```
                survival (s)                       optimal                 standing   breach/min   travel/min
before   54.8, 57.9, 93.8, 103.2, 124   med 93.8   34/33/57/64/67% med 57%   0.70        26.1         3445
after    54.4, 59.4, 78.1,  93.0, 101.5 med 78.1   63/33/49/73/67% med 63%   0.55        25.2         3261
```

Read it as a direction, not a size: three seeds moved under two seconds,
seeds 1 and 4 shortened by 16s and 31s. The direction is the expected one -
a two-hit shot was landing twice on every body wider than a step of travel
and the analytic budget never credited it, so the player was quietly
outperforming the curve before. Standing's median fell 0.70 to 0.55, still
well above the 0.28 clamp threshold, so every run stays par-driven. **The
pair cannot separate the guard from the column** - both are in the one commit
- and a third build with only one of them is what would.

`npm run from -- --dps=1e5` on the committed build, three seeds, skill 0.7:

```
  seed   survived   waves       standing at end   optimal   breach/min   peak power   died
     1      136.4s   17 -> 31         0.22          54%         64.7          416     TITAN
     2      136.4s   17 -> 31         0.33          76%         73.9          687     TITAN
     3         56s   17 -> 23         0.07          81%         77.1           72     attrition
```

Against the same batch in Part C, where all three died to the wave-25 Titan at
91.4s with standing 0.45 to 0.55: the bot now survives the wave-20 and wave-25
Titans and dies to the wave-30 one, at standing 0.22 to 0.33. That is what a
damage check pinned to 0.9 of par should do to a bot chasing gates - pass it
while its standing is anywhere near par, fail it once it has fallen to a
third. Seed 3 is the first late run to end by attrition rather than a Titan:
its army collapsed to 72 at standing 0.07 before the wave-25 boss arrived.

`npm run repeat` on the committed build: **PASS, 0.00% simulated spread**
(78.1s, wave 6, 9 decisions, 63%, 31 kills on all three). `npm run hud`:
delivery 100% at every forced state, refused 0, drawn bullets flat, and the
three images were looked at - `hud-late` is a diamond ring under gold bullets,
`hud-cap` a prismatic ring, `hud-loop` a grey ring at 78k power, the palette's
second cycle, exactly as unmarked as the author asked.

### The before/after the probe can see

`npm run balance`, seeds 1–5, skill 0.7, on the snapshot and on the final build:

```
                 survival (s)                     optimal              standing   breach/min
snapshot   54.8, 57.9, 93.8, 103.2, 124  med 93.8   34/33/57/64/67% med 57%   0.69         26.1
final      54.8, 57.9, 93.8, 103.2, 124  med 93.8   34/33/57/64/67% med 57%   0.70         26.1
```

Identical to the run, as `neutral` had already proved; the standing median
moving 0.01 is the wall-clock sampler picking a different row, the standing
warning in `CLAUDE.md`. **The probe cannot see any of this work**, which is
why `from` had to exist.

`npm run repeat` on the final build: **PASS, 0.00% simulated spread (93.8s, wave 7, 11 decisions, 34%, 63 kills on all three)**.

## 4. What to do next — questions for the author, then tuning

None of this is blocked, but the next moves are the author's to choose:

- **Feel out `bossKillDistance` at 0.3.** With the four multipliers gone the
  Titan is the budget and nothing else, and the bot now passes it near par
  and fails it at a third of par (Part D). Whether 0.3 of the descent is the
  right deadline is a question for a human under the boss; the levers are
  `DIFFICULTY.bossKillPar` and `bossKillDistance`, `npm run titan` is the
  instrument for the arithmetic and `npm run from` at a wave just below a
  multiple of five for the feel of it.
- **Decide whether the balance pair in Part D is a regression to tune out.**
  Median survival at skill 0.7 fell 93.8s to 78.1s and standing 0.70 to 0.55
  when bullets stopped landing twice. The curve did not change; the player's
  real output fell to what the curve always assumed. If the early game now
  feels too hard, `DIFFICULTY.targetFraction` is the honest lever, not the
  guard.
- **Read the `from` table above and decide whether 300 is right.** It was
  named as a first value. `npm run from -- --dps=1e7` and `npm run hud` are the
  two instruments; `WEAPON.maxSimShotsPerSecond` is the knob and `maxBullets`
  follows it.
- **Bullets do not get visibly fatter, only differently coloured.** The plan's
  phrase was "above 300, bullets get fatter"; what shipped is the tint ladder,
  which already encodes the bundle. If the author wanted size as well as
  colour, it is a rendering-only change (`renderBullets` has `b.density`) and
  `npm run neutral` is the check.
- **`from` at standing 1.0 is one question; the others are cheap.** The runner
  sets par equal to the player. A `--standing=0.7` option (par ahead by that
  ratio) would measure the curve's expectation directly. Not built, because
  the author chose the 1.0 question first.
- **Lumping.** A fat bullet is one column where its thin shots were spread
  across units and a fraction of a second. Against the Titan it changes
  nothing; against a spread of small bodies it concentrates damage. Nothing
  measures this yet. If the late game reads as lumpy in real play, the two
  levers are the cap and spawning honoured bullets round-robin across units
  rather than at the unit whose shot happened to be honoured.

## 5. Ground rules

- **A typecheck is not verification, and neither is a green exit code.** Six
  bugs on this branch were found by looking at an image or a number that every
  automated signal called a pass; the third ceiling is the newest.
- **The simulation runs on a fixed 1/60s step** (`SIM`). Nothing gameplay-
  affecting may read a real frame delta. `npm run repeat` keeps this honest; a
  nonzero spread is a regression. The sim stride (`simCredit`) is gameplay
  state and is deterministic by construction — no RNG.
- **Measure in simulated seconds, never wall-clock** (`stats.elapsed`).
- **`Progression.ts` is the single definition of squad strength; `Scoring.ts`
  prices every offer exactly once; `Mode.ts` holds the run's difficulty.**
  `Progression` now has TWO DPS functions: `squadDps` and `singleTargetDps`
  (no pierce, for the Titan). `deliverableDps` is gone and must not come back
  unless a delivery gap does.
- **Two collapses, kept distinguishable.** The renderer's stride
  (`drawCredit`) changes what is drawn and must never consume the RNG or feed
  a spawn. The simulation's stride (`simCredit`) changes what is spawned and
  is deliberate balance. Both live in `GameScene.fire` with separate state.
- Commit subjects prefixed `shooter_ad:`. Stage **explicit paths**, never
  `git add -A` — subagents share this working tree unless given
  `isolation: "worktree"`.
- **No CI on pull requests**, by the user's choice. Pages deploys only after
  merge to `main`. Your local `verify` is the real gate.

## 6. Known gaps — name these as unverified if you report on them

- **`npm run from` is the only played evidence about the late game, and it is
  three seeds of a bot that cannot dodge.** It proves the ceilings are gone
  (DPS, standing and enemy HP all keep moving past them) and says nothing
  about whether the game past them is any good. Say so in those words.
- **Nothing is verified at true phone scale.** Every screen judged on 540×960
  PNGs, not a real panel under `Scale.FIT`. The bundle's tint ladder has been
  seen only in stills.
- **The halo flash has never been observed in motion.** Stills only.
- **The Titan-as-loss path has still not been photographed.** `npm run
  endscreen` has never shown `THE TITAN LANDED`; `npm run from -- --dps=1e5`
  reaches it at 136 simulated seconds on seeds 1 and 2, so wiring a screenshot
  on `cause === 'titan'` into `endscreen` is cheap and overdue.
- **The Part D balance pair cannot say whether the re-hit guard or the 72px
  column moved the probe.** Both are in one commit. A build with only one of
  them, measured with `PROBE_DIST`, would separate them.
- **`DIFFICULTY.pressure` was not changed**, and should not be on the strength
  of what is recorded. Two seeds is not a reading.
- **`SQUAD.moveSpeed` 620 → 260 was never A/B'd** against the new gate speeds.
- **The probe bot cannot dodge.** No threat avoidance, no positioning.

## 7. Settled — do not relitigate

- Raw draws scale to the pool; `npm run model` guards this on both the
  arithmetic and geometric means.
- Scoring prices access; `Difficulty` budgets DPS without it. `×MOVE` and `+TIME`
  must never contribute to par's enemy budget, and do not.
- The **render** collapse is rendering only. The **simulation** collapse is
  deliberate balance. The two must stay distinguishable in the code.
- The palette cycles and the cycle is unmarked. Adjacent-rung contrast is the
  requirement; cycle identity is not.
- Delivery is unbounded by construction: a bullet carries the shots it stands
  for. Do not reintroduce a ceiling by modelling one.
- Match codes, not raw seed URLs. A shared link lands on a start screen and waits.
- Pierce uses a fixed `q`, not live density.
- **The Titan is pinned to par SINGLE-TARGET DPS** — `titanHp` reads
  `singleTargetDps(par)`. A fat bullet on one large body loses nothing, so the
  bundle leaves the Titan's arithmetic alone.
- Hard mode is a wave offset on the judgment axes only — never enemy pressure.
- Par starts equal to the injected player in `npm run from`. A different
  standing is a new option, not a change to this one.

## 8. How to report

What landed, what the instruments say (with seeds), what you could not verify,
and what you would do next. **Name unverified claims as unverified.** This
project has now been fooled by its own instruments six times, found a
ceiling it did not know existed on the seventh, and found a fourth Titan
multiplier with the instrument built to check the other three.
