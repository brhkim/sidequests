# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo,
on branch `claude/laughing-feynman-ghh9r3` (no PR open; the branch is ahead
of `main` by six sessions' work; the last two commits are `8a5e41a` (1.6)
and `3a38b8a` (1.7), on top of `422ad35`, the 1.5 commit). The version tag
is **1.7**; a seed only compares with another 1.7 run. Nothing is blocked.
§4 is what the author still has to do or decide, §5 what nobody has
verified.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, the shared-tree rules for
   subagents, the measuring-before-tuning rules.
2. `shooter_ad/ASKS.md` — **the author's asks, verbatim, with a status per
   ask**, seven sessions of them. The last section (2026-09-21, sixth
   session: MOVE levels, gate sway, damage off the peak, then the curve in
   brackets) is the checklist this session is judged against. Read it
   first.
3. `shooter_ad/PRODUCT.md` — product truth and the decisions on record.
4. `shooter_ad/notes.md` — design intent; wins over `CLAUDE.md`. From the
   last session: the 1.6 paragraph under "Move speed is the deliberate
   oddity", "Dead space between gates" (the 1.7 curve), "Gates sway inside
   their lane", "Every price on the army is a share of its peak", the
   legibility schedule under "Numeric legibility as a difficulty axis".
5. `shooter_ad/CLAUDE.md` — mechanics. From the last session: the MOVE
   paragraph under "Gate approach speed is the judgment-axis difficulty
   lever", "Gate sway is the fifth judgment lever", "Dead space is the
   fourth judgment lever" (rewritten for 1.7), the 1.6 paragraph opening
   "Contact damage", `npm run sway` in the command list.
6. `shooter_ad/DESIGN.md` — the design system as shipped. NOT re-derived
   for two sessions; it predates the 4x3 pause grid, the end-screen plot,
   the INVEST word and the sway track.
7. `git log --oneline -12` — the commit messages carry the reasoning and the
   measurements.

Then:

```bash
cd shooter_ad && npm ci && npm run build && npm run verify && npm run model
npm run sway       # sway-30/31/36/41.png: still, then the three tiers on their grey tracks
npm run hud        # hud-echo.png: a full ghost ring left, a half ring right, three columns
npm run endscreen  # pause-mid.png: the MOVE INVEST tile reads x1.00; start-invited.png v1.7
npm run moments    # moment-block-body.png: a body into a shielded ring; moment-deadspace.png at 147.7px
npm run rescue     # the pierce-past-a-cage check at 0 / 1 / 2
npm run rail       # the rail at 88 / 100 / 96 / 100 / 76
npm run from -- --dps=1e5            # the only instrument that meets a shooter
npm run from -- --dps=1e5 --wave=41  # the bot under full sway
```

Run the headless probes ONE AT A TIME. Two Chromium probes side by side
skewed `moments`' wall-clock waits into sixteen false failures last
session.

Do not start until you have looked at `.verify/screenshot.png`,
`.verify/sway-41.png`, `.verify/sway-31.png`, `.verify/pause-mid.png` and
`.verify/moment-block-body.png`.

## 2. What the game is

**DPS golf.** Every 7.5 seconds three bonuses descend and you must judge, before
they arrive, which most increases your damage output. A stat is
`base × (1 + pool) × mult`; raw draws scale to the pool so neither form is
ever dominant. Difficulty is closed-loop against a shadow "par" player who
takes the best DPS option every time and collects nothing else. Five
judgment levers rise with the wave: descent speed, root granularity, raw
rounding, dead space between the gates, and (from wave 31) the gates'
sway inside their lanes. MOVE, TIME, SENSE and SHIELD are INVEST axes
(RISK until 1.5): worth zero to the scoring, never taken by par, the
player's gamble. ECHO is the tenth axis and a damage one.

**The judgment curve, as of 1.7** (judgment waves; hard mode is five
earlier on every line; `npm run model` prints it per wave):

| waves | descent speed | dead space | legibility | shooters | sway |
| --- | --- | --- | --- | --- | --- |
| 1-4 | ×1.00, +~0.064 a wave | 0 | three round values | walkers | none |
| 5-9 | ×1.26 to ×1.51 | 0 | the tenths | Spitter from 5 | none |
| 10-14 | ×1.58 to ×1.83 | 4.6 to 23px | the tenths | same | none |
| 15-24 | ×1.90 to ×2.47 | 28 to 69px | every .05 | Mortar from 15 | none |
| 25-30 | ×2.54 to ×2.86 | 74 to 97px, cap at 30 | every .01 | Lancer from 25 | none |
| 31-35 | ×2.92 to ×3.18 | 97px, holds | every .01 | same | 0.5 periods a descent |
| 36-40 | ×3.24 to ×3.50, cap at 40 | holds | same | same | 1.0 |
| 41+ | ×3.50 | holds | same | same | 1.5 |

Titans at every fifth wave. Speed and dead space move every wave;
legibility, shooters and sway step on the fives.

## 3. What changed last session, in the order it landed

Every item is the author's ask, recorded verbatim in `ASKS.md`. Two
versions.

**1.6 — three features.**

1. **MOVE is three levels on a slower base.** `SQUAD.moveSpeed` 260 to 195
   (a quarter off). `Upgrades.move` 0 to 3 replaces `moveMult`; the ladder
   `MOVE.mult` = x1 / x1.5 / x2 / x2.5 through `Progression.moveMultiplier`;
   the card is `+MOVE` (was a root draw `x1.05` to `x1.5`), filtered out at
   three held through `OfferContext.move`. HUD carries `move` and the
   derived `moveMult`; the pause tile and the guide say the ladder.
2. **Gate sway.** `GATES.sway` `{ fromWave: 30, tierWaves: 5, periods:
   [0.5, 1, 1.5] }`: none through the bracket in which dead space caps,
   then 0.5 / 1 / 1.5 periods per descent from waves 31 / 36 / 41, held
   after. Amplitude is half the dead space (+-48.5px), so a card touches
   its lane edge and never crosses; `swayOffset` is a sine of the card's
   descent progress (centre at spawn and at the line), a function of y
   alone, so `repeat` is 0.00% and `+TIME` slows it with the fall. `Gate`
   gained `laneX`, `swayPeriods`, `swayAmplitude`; `g.x` is set from `g.y`
   each step. The track: `RENDER.gate.track` grey at 0.09 fill, 0.28
   hairline, lane-wide, depth 3, drawn only on a swaying card. "1.5x
   periods of movement across the whole length of the screen" is read as
   1.5 cycles per descent; the author said "great" to the walkthrough
   that stated it.
3. **Every price on the army is a share of its peak.**
   `Contact.damageBase(power, peak)` = `max(held, peak x 0.5)`
   (`ARMY_DAMAGE.mercy`); `contactCost` takes the peak, `bulletCost` is new
   and `applyIncomingFire` reads it; `Squad.peak` is the lazy high-water
   mark. Floors unchanged. Event `share` clamped to 1. From a peak of
   1,000 a Basic contact is 20 / 10 / 10 at 1,000 / 500 / 1 held (it was
   1 at 1); Basic contacts from 1,000 to zero: 225 on 1.5, 86 on 1.6.

**1.7 — the curve in brackets**, after the author read where each lever
shifted and asked for five-wave increments: descent speed rolls
continuously from wave 2 to x3.5 at wave 40 (`GATES.speedCapWave`;
`speedPerWave` is deleted, the slope derived); dead space 0 through wave
9, one linear slope to 97px at wave 30 (`{ fromWave: 9, capWave: 30, max:
97 }`, the two stages of 0.5 / 0.8 gone); legibility tiers at 1 / 5 / 15 /
25 (were 1 / 6 / 11 / 16); shooters at 5 / 15 / 25 (were 5 / 10 / 15);
sway from 31 (was 27). The table in §2 is the result.

**Instruments.** `npm run sway` is new: four pages at waves 30 / 31 / 36
/ 41 through `__startOverride`, movement (or none), the lane bound and
the track count asserted, four stills. `npm run model` prints sway
columns on the judgment curve, the decline table from a peak of 1,000 and
the MOVE ladder, and asserts every 1.6 and 1.7 number: the shooter waves,
the legibility waves, the constant dead-space step, both cap waves, the
sway brackets, the phase, and that the sway's peak lateral speed (177px/s
at the last tier) stays under the squad's 195. `npm run moments` holds 24
power before the MISS wait: on 1.6's seed the army of 3 died at 25% of
par before a fourth offer arrived (the seed, not a bug).

**Measured.** `npm run balance` seeds 1-3 on 1.7: 33.9 / 34.3 / 43.9s,
the 1.5 numbers to the decimal - the bot dies at wave 3, before any of
this can reach it. `npm run from -- --dps=1e5` (wave 16, seeds 1-3):

| build | survival | contact/min | breach/min | fire/min | standing at end |
| --- | --- | --- | --- | --- | --- |
| 1.5 | 61.7 / 73.7 / 64.1s | 19.4 / 7.3 / 45.9 | 14.6 / 26.1 / 50.5 | 53.5 / 41.5 / 36.5 | 0.04 / 0.27 / 0.09 |
| 1.6 | 52.9 / 78.7 / 47.7s | 12.5 / 32.0 / 47.8 | 18.1 / 28.2 / 64.2 | 59.0 / 51.1 / 37.7 | 0.08 / 0.09 / 0.05 |
| 1.7 | ? / 150.1s+ / 83.5s | ? / 28.0 / 32.3 | ? / 7.2 / 31.6 | ? / 56.8 / 33.1 | ? / 0.39 / 0.08 |

1.5 to 1.6 is the peak anchor: median 64.1s to 52.9s, fire loss per
minute up on every seed. 1.7's wave 16 is a different place - 32px of
dead space against 72, no Mortar until 15, no Lancer until 25 - so seed 2
reaching the 150s budget at wave 32 is the curve moving, not a bug. Seed
1's 1.7 row was cut from the log and is unrecorded; re-run it before
quoting a 1.7 median. `from --wave=41` (full sway on the x3.5 descent):
79.8 / 69.4 / 79.3s, 10 / 8 / 10 decisions, no Titan landing - a bot that
steers to a card's live x still takes swaying cards.

`verify`, `model`, `repeat` (0.00%), `sway`, `moments`, `hud`,
`endscreen`, `rescue` and `rail` pass on 1.7.

## 4. What the author still has to do or decide

- **Play 1.7.** Nothing since 0.5 has been played by a human: the slower
  squad with `+MOVE` at x1.5 first; the long flat open (no dead space
  until wave 10, no sway until 31); the sway itself (does 0.5 a descent
  read as "very slow", does 1.5 on a 2.6s descent read as "never
  outrageously fast"); the grey track's weight (0.09 fill; it reads as one
  band across the screen when all three cards sway); the spiral off the
  peak.
- **The mercy clamp on the base is a half of the PEAK**, and nothing
  lowers the peak inside a run. A run that spikes to 1,000 on a cage and
  falls pays 500's prices to the end. That is what was asked; say so if
  the peak should decay.
- **Legibility has no fifth table.** "25-34" and 35+ read the same
  hundredths ladder; if 35+ was meant to be finer still, `data/roots.ts`
  takes a fifth row and `npm run model`'s four-tier assertion moves.
- **The shooter share of spawns was measured on the 1.3 waves** (6 / 9 /
  12%); at 5 / 15 / 25 the middle figure now describes waves 15-24, and
  nobody has re-read it.
- Everything from earlier handoffs still stands: pierce past 4 held (the
  overshoot at q 0.7), whether the Titan is blockable, ECHO's weight and
  wave, the plot's y axis, the guide's hand-typed numbers, deploying and
  watching GoatCounter.

## 5. Known gaps — name these as unverified if you report on them

- **No instrument measures how often a swaying card is MISSED.** The bot
  steers to `g.x` every step and takes gates from wave 41; a human's hand
  against a card at 177px/s is unmeasured, and so is the track's
  legibility under a full-ring stream.
- **The peak anchor is measured only on the bot at 1e5 DPS**, which never
  dodges; the balance probe dies under every floor and cannot see it.
- **The 1.7 `from --dps=1e5` median is unrecorded** (seed 1's row lost).
- **`DESIGN.md` is stale** by the 4x3 grid, the plot, INVEST and the sway
  track. The documenter and the finish reviewer were not run last session.
- **No instrument plays with ECHO on purpose.** The bot takes it when the
  scoring says so; `from` does not print whether it did. The ghosts'
  bullets off the edge (the wastage the price assumes) are unmeasured.
- **The probe cannot see 1.2 to 1.7 at all** below wave 5; `from` sees
  them at wave 16-17 with a bot that never dodges.
- **The DETAILS page's working lines** were not re-read after the
  formatter change; `num` there still shows two decimals under 10.
- **`fractionOfOptimal` still exists** and `stats.optimal` prints it; the
  endscreen instrument's summary line still says "% of optimal". Nothing
  on screen shows it.
- **The RISK wash, `pickRisk` and analytics** remain unforced, unheard and
  unobserved end to end, as every handoff has said. The wash now reads
  INVEST.

## 6. Ground rules

- **A typecheck is not verification.** Look at the images; listen to the WAVs.
- The simulation runs on a fixed 1/60s step (`SIM`); rendering and audio read
  `elapsed` for phase and never the RNG. `npm run repeat` must read 0.00%.
- A rendering-only change is proven with `npm run neutral` against a `dist/`
  snapshot taken BEFORE the change. A balance change bumps the version.
- `Progression.ts` defines squad strength (ECHO's ladder is `echoColumns`,
  MOVE's is `moveMultiplier`, the curve is `waveGateSpeedMult` /
  `gateDeadSpace` / `gateSway` / `swayOffset` there); `Scoring.ts` prices
  every offer once; `Contact.ts` prices every arrival and every bullet
  once, off `damageBase`; `Mode.ts` holds difficulty; `Shield.ts` is the
  one charge pool; `format.ts` is the one number formatter.
- Every curve number lives in `GATES` (config), `LEGIBILITY`
  (`data/roots.ts`) and the roster's `minWave`; `npm run model` asserts
  the bracket boundaries, so a retune is a config edit plus its assertion.
- Nothing in `systems/` reads the event stream, audio or analytics.
- Do not rebuild `dist/` while a probe is running against it: the probes
  serve `dist/` live, and a rebuild mid-run 404s the page. Snapshot first.
- Run headless probes one at a time (see §1).
- Commit subjects `shooter_ad:`; stage explicit paths, never `git add -A`.
- `pkill -f` on a script name matches your own shell; kill by PID.
- The impeccable skill lives at `.claude/skills/impeccable/`; run its
  `context` once per session before any UI work, and its reviewer and
  documenter agents at the end.
- No CI on pull requests; local `verify` is the gate.

## 7. Settled — do not relitigate

Everything in the previous handoff's list, plus: pierce carries past a
cage; shooters are rates, never a live cap; SHIELD blocks bodies but never
a breach; ECHO is half-left / half-right / full-left / full-right at 0.35
a level; `q` is 0.7; numbers are three figures on the thousands ladder;
the end screen plots standing and shows no growth percentage; the word is
INVEST; MOVE is three levels at x1.5 / x2 / x2.5 on a base of 195; every
price on the army is a share of `max(held, peak / 2)`; the judgment curve
is the §2 table - speed to x3.5 at 40, dead space 0 through 9 to 97px at
30, legibility at 5 / 15 / 25, shooters at 5 / 15 / 25, sway in the
brackets 31 / 36 / 41 at 0.5 / 1 / 1.5 periods a descent.

## 8. How to report

What landed, what the instruments say (with seeds), what you could not verify,
and what you would do next. **Name unverified claims as unverified**, and keep
`ASKS.md` current: every ask the author makes goes in verbatim with a status.
