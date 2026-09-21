# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo,
on branch `claude/laughing-feynman-ghh9r3` (no PR open; the branch is ahead
of `main` by six sessions' work; the last two commits are this session's,
1.6 and 1.7, on top of `422ad35`, the 1.5 commit). The version tag is
**1.7**; a seed only compares with another 1.7 run. Nothing is blocked. §4 is what the author
still has to do or decide, §5 what nobody has verified.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, the shared-tree rules for
   subagents, the measuring-before-tuning rules.
2. `shooter_ad/ASKS.md` — **the author's asks, verbatim, with a status per
   ask**, seven sessions of them. The last section (2026-09-21, sixth
   session: MOVE levels, gate sway, damage off the peak) is the checklist
   this session is judged against. Read it first.
3. `shooter_ad/PRODUCT.md` — product truth and the decisions on record.
4. `shooter_ad/notes.md` — design intent; wins over `CLAUDE.md`. From this
   session: the 1.6 paragraph under "Move speed is the deliberate oddity",
   "Gates sway inside their lane", "Every price on the army is a share of
   its peak".
5. `shooter_ad/CLAUDE.md` — mechanics. From this session: the MOVE paragraph
   under "Gate approach speed is the judgment-axis difficulty lever", "Gate
   sway is the fifth judgment lever", the 1.6 paragraph opening "Contact
   damage", `npm run sway` in the command list.
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
npm run endscreen  # pause-mid.png: the MOVE INVEST tile reads x1.00; start-invited.png v1.6
npm run moments    # moment-block-body.png: a body into a shielded ring
npm run rescue     # the pierce-past-a-cage check at 0 / 1 / 2
npm run rail       # the rail at 88 / 100 / 96 / 100 / 76
npm run from -- --dps=1e5            # the only instrument that meets a shooter
npm run from -- --dps=1e5 --wave=41  # the bot under full sway
```

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
sway inside their lanes. MOVE, TIME, SENSE and SHIELD
are INVEST axes (RISK until 1.5): worth zero to the scoring, never taken
by par, the player's gamble. ECHO is the tenth axis and a damage one.

## 3. What changed this session, in the order it landed

Every item is the author's ask, recorded verbatim in `ASKS.md`. Two
versions: 1.6 (three features) and 1.7 (the curve re-bracketed after the
author read 1.6's).

1. **MOVE is three levels on a slower base.** `SQUAD.moveSpeed` 260 to 195
   (a quarter off). `Upgrades.move` 0 to 3 replaces `moveMult`; the ladder
   `MOVE.mult` = x1 / x1.5 / x2 / x2.5 through `Progression.moveMultiplier`;
   the card is `+MOVE` (was a root draw `x1.05` to `x1.5`), filtered out at
   three held through `OfferContext.move`. HUD carries `move` and the
   derived `moveMult`; the pause tile and the guide say the ladder.
2. **Gate sway.** `GATES.sway` `{ fromWave: 30, tierWaves: 5, periods:
   [0.5, 1, 1.5] }` (26 in 1.6): none through the bracket in which dead
   space caps, then 0.5 / 1 / 1.5 periods per descent from waves 31 / 36 /
   41 (hard five earlier), held after. Amplitude is half the dead space (+-48.5px), so a
   card touches its lane edge and never crosses; `swayOffset` is a sine of
   the card's descent progress (centre at spawn and at the line), a
   function of y alone, so `repeat` is 0.00% and `+TIME` slows it with the
   fall. `Gate` gained `laneX`, `swayPeriods`, `swayAmplitude`; `g.x` is
   set from `g.y` each step. The track: `RENDER.gate.track` grey at 0.09
   fill, 0.28 hairline, lane-wide, depth 3, drawn only on a swaying card.
   The reading of "1.5x periods of movement across the whole length of the
   screen" as 1.5 cycles per descent is mine; the author said "great" to
   the walkthrough that stated it.
3. **Every price on the army is a share of its peak.**
   `Contact.damageBase(power, peak)` = `max(held, peak x 0.5)`
   (`ARMY_DAMAGE.mercy`); `contactCost` takes the peak, `bulletCost` is new
   and `applyIncomingFire` reads it; `Squad.peak` is the lazy high-water
   mark. Floors unchanged. Event `share` clamped to 1.

4. **1.7 - the curve in brackets** (the author, after a walkthrough of
   where each lever shifts): descent speed rolls continuously from wave 2
   to **x3.5 at wave 40** (`speedCapWave`; `speedPerWave` deleted, the
   slope derived); dead space **0 through wave 9, one slope to 97px at
   wave 30** (`{ fromWave: 9, capWave: 30, max: 97 }`, the two stages
   gone); legibility tiers at **1 / 5 / 15 / 25**; shooters at **5 / 15 /
   25** (Spitter / Mortar / Lancer); sway from 31 as above. Hard mode is
   every one of those five waves earlier.

Instruments: `npm run sway` (new; four pages at 30 / 31 / 36 / 41,
movement / lane bound / track count asserted, four stills); `npm run
model` prints sway columns on the judgment curve, the decline table from a
peak of 1,000 and the MOVE ladder, and asserts every 1.6 and 1.7 number
(the shooter waves, the legibility waves, the constant dead-space step,
both cap waves, the sway brackets); `npm run moments` holds 24 power
before the MISS wait (on 1.6 the seed's army of 3 died at 25% of par
before a fourth offer arrived - the seed, not a bug).

**Measured.** `npm run balance` seeds 1-3: 34.3 / 33.2 / 43.9s against 34.3
/ 33.9 / 43.9s on the 1.5 snapshot - seed 2 moved 0.7s; the bot dies at
wave 3, under every share's floor, before sway or a peak above the floors
can reach it. `npm run from -- --dps=1e5` (wave 16, seeds 1-3, the same
snapshot):

| build | survival | contact/min | breach/min | fire/min | standing at end |
| --- | --- | --- | --- | --- | --- |
| 1.5 | 61.7 / 73.7 / 64.1s | 19.4 / 7.3 / 45.9 | 14.6 / 26.1 / 50.5 | 53.5 / 41.5 / 36.5 | 0.04 / 0.27 / 0.09 |
| 1.6 | 52.9 / 78.7 / 47.7s | 12.5 / 32.0 / 47.8 | 18.1 / 28.2 / 64.2 | 59.0 / 51.1 / 37.7 | 0.08 / 0.09 / 0.05 |

Median survival 64.1s to 52.9s; fire loss per minute up on every seed,
which is the peak anchor doing what it was asked to. A bot that never
steps aside pays the highest rate a player would. `from --wave=37` (full
sway): 84.4 / 86.0 / 59.5s, 10 / 11 / 7 decisions, one death to a Titan -
swaying cards are still taken by a bot that steers to their live x.

**1.7, measured.** `npm run balance` seeds 1-3: 33.9 / 34.3 / 43.9s, the
1.5 numbers to the decimal (the bot dies at wave 3, where nothing in 1.7
has started). `npm run from -- --dps=1e5` (wave 16): seed 2 hit the 150s
budget at wave 32 (a floor), seed 3 83.5s; seed 1's row was cut from the
log and is unrecorded. Wave 16 is easier than it was - 32px of dead space
against 72, no Mortar until 15 and no Lancer until 25 - so a longer run
there is the curve moving, not a bug. `from --wave=41` (full sway, x3.5
descent): 79.8 / 69.4 / 79.3s, 10 / 8 / 10 decisions, no Titan landing.
`verify`, `model`, `repeat` (0.00%), `sway`, `moments` (wave-16 cards
147.7px), `endscreen`, `rescue` and `rail` pass on 1.7.

## 4. What the author still has to do or decide

- **Play 1.6.** Nothing since 0.5 has been played by a human: the slower
  squad with `+MOVE` at x1.5 first, the sway from wave 27 (does 0.5 a
  descent read as "very slow", does 1.5 read as "never outrageously
  fast"), the grey track's weight (0.09 fill; it reads as one band across
  the screen when all three cards sway), and the spiral off the peak.
- **"1.5x periods across the whole length of the screen"** is read as 1.5
  cycles per descent. If it meant something else (cycles per second, or
  the swing spanning the whole screen), `GATES.sway.periods` and the
  amplitude rule are the two knobs.
- **Sway starts the wave AFTER the last width change** (27, not 26). Say
  so if it should start on 26.
- **The mercy clamp on the base is a half of the PEAK**, and nothing
  lowers the peak inside a run. A run that spikes to 1,000 on a cage and
  falls pays 500's prices to the end. That is what was asked; say so if
  the peak should decay.
- Everything from §4 of the previous handoff still stands: pierce past 4
  held (the overshoot at q 0.7), whether the Titan is blockable, ECHO's
  weight and wave, the plot's y axis, the late dead-space slope, the
  guide's hand-typed numbers, deploying and watching GoatCounter.

## 5. Known gaps — name these as unverified if you report on them

- **No instrument measures how often a swaying card is MISSED.** The bot
  steers to `g.x` every step and takes gates from wave 37; a human's hand
  against a card at 164px/s is unmeasured, and so is the track's
  legibility under a full-ring stream.
- **The peak anchor is measured only on the bot at 1e5 DPS**, which never
  dodges; the balance probe dies under every floor and cannot see it.
- **`DESIGN.md` is stale** by the 4x3 grid, the plot, INVEST and the sway
  track. The documenter and the finish reviewer were not run this session
  either.
- **No instrument plays with ECHO on purpose.** The bot takes it when the
  scoring says so; `from` does not print whether it did. The ghosts'
  bullets off the edge (the wastage the price assumes) are unmeasured.
- **The probe cannot see 1.2 to 1.5 at all** below wave 5; `from` sees
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
  MOVE's is `moveMultiplier`, sway is `gateSway` / `swayOffset` there);
  `Scoring.ts` prices every offer once; `Contact.ts` prices every arrival
  and every bullet once, off `damageBase`; `Mode.ts` holds difficulty;
  `Shield.ts` is the one charge pool; `format.ts` is the one number
  formatter.
- Nothing in `systems/` reads the event stream, audio or analytics.
- Do not rebuild `dist/` while a probe is running against it: the probes
  serve `dist/` live, and a rebuild mid-run 404s the page. Snapshot first.
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
INVEST; MOVE is three levels at x1.5 / x2 / x2.5 on a base of 195; gates
sway inside their lane from wave 27 at 0.5 / 1 / 1.5 periods a descent;
every price on the army is a share of `max(held, peak / 2)`.

## 8. How to report

What landed, what the instruments say (with seeds), what you could not verify,
and what you would do next. **Name unverified claims as unverified**, and keep
`ASKS.md` current: every ask the author makes goes in verbatim with a status.
