# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo,
on branch `claude/laughing-feynman-ghh9r3` (no PR open; the branch is ahead
of `main` by five sessions' work; the last commits are this session's, 1.2
through 1.5, on top of `0de77ae`, the Mortar / SHIELD commit). The version
tag is **1.5**; a seed only compares with another 1.5 run. Nothing is
blocked. §4 is what the author still has to do or decide, §5 what nobody
has verified.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, the shared-tree rules for
   subagents, the measuring-before-tuning rules.
2. `shooter_ad/ASKS.md` — **the author's asks, verbatim, with a status per
   ask**, six sessions of them. The last section (2026-09-21, fifth session:
   pierce past cages and the shooter count, then §3 to §5 of it) is the
   checklist this session is judged against. Read it first.
3. `shooter_ad/PRODUCT.md` — product truth and the decisions on record.
4. `shooter_ad/notes.md` — design intent; wins over `CLAUDE.md`. From this
   session: "Pierce carries past a cage", "Shooters spawn at half weight,
   one new type per five waves", "SHIELD blocks a body too, never a
   breach", "+ECHO: a ghost army beside yours", "Numbers read at three
   figures whatever their size", "The end screen plots you against par;
   RISK reads INVEST", and the `q` 0.7 paragraph under "Pierce: what is it
   actually worth?".
5. `shooter_ad/CLAUDE.md` — mechanics. From this session: the cage bullet
   under "Contact damage", the shooter curve under "Extending content",
   the body block under "`+SHIELD` is a charge pool", the `+ECHO` bullet,
   "The end screen's plot, and the word INVEST", "Numbers on screen".
6. `shooter_ad/DESIGN.md` — the design system as shipped. NOT re-derived
   this session; it predates the 4x3 pause grid, the end-screen plot and
   the INVEST word.
7. `git log --oneline -12` — the commit messages carry the reasoning and the
   measurements.

Then:

```bash
cd shooter_ad && npm ci && npm run build && npm run verify && npm run model
npm run hud        # hud-echo.png: a full ghost ring left, a half ring right, three columns
npm run endscreen  # end-poor.png / end-good.png: the standing plot beside PEAK DAMAGE / SEC
npm run moments    # moment-block-body.png: a body into a shielded ring
npm run rescue     # the pierce-past-a-cage check at 0 / 1 / 2
npm run rail       # the rail at 88 / 100 / 96 / 100 / 76
npm run from -- --dps=1e5   # the only instrument that meets a shooter
```

Do not start until you have looked at `.verify/screenshot.png`,
`.verify/hud-echo.png`, `.verify/end-poor.png`, `.verify/pause-mid.png`
and `.verify/moment-block-body.png`.

## 2. What the game is

**DPS golf.** Every 7.5 seconds three bonuses descend and you must judge, before
they arrive, which most increases your damage output. A stat is
`base × (1 + pool) × mult`; raw draws scale to the pool so neither form is
ever dominant. Difficulty is closed-loop against a shadow "par" player who
takes the best DPS option every time and collects nothing else. Four
judgment levers rise with the wave: descent speed, root granularity, raw
rounding, and dead space between the gates. MOVE, TIME, SENSE and SHIELD
are INVEST axes (RISK until 1.5): worth zero to the scoring, never taken
by par, the player's gamble. ECHO is the tenth axis and a damage one.

## 3. What changed this session, in the order it landed

Every item is the author's ask, recorded verbatim in `ASKS.md`. Four
versions, each a balance change:

1. **1.2 — pierce carries past a cage.** A cage spent every shot that hit
   it; now the shots that open it spend one pierce and fly on, with the
   same one-encounter `struck` guard a body has. `npm run rescue` asserts
   it at pierce 0 / 1 / 2.
2. **1.3 — the shooter curve.** Nothing decided the shooter count before
   (one weighted draw per spawn, 21% shooters from wave 7, shooters
   outliving two or three waves). The author declined a live cap ("punishes
   the player for clearing ranged mobs") for rates: every gun type at half
   weight (Spitter 15, Mortar 11, Lancer 12), one new shooter per five
   waves (5 / 10 / 15), guns at 3 / 6 / 4.5s. Shooter share of spawns 6 /
   9 / 12% against 12 / 21 / 21%.
3. **1.4 — SHIELD blocks a body, +ECHO, pierce q 0.7.** A body touching
   the ring spends a charge and is consumed for nothing (never a breach,
   never the Titan - my call). +ECHO: ghost armies that fire what you
   fire, priced for par, out of the Titan's sizing, no body in `systems/`.
   `WEAPON.pierceQ` 0.5 to 0.7 ("it's definitely pulling higher weight
   than a 1.5x damage bonus").
4. **1.5 — ECHO retuned, three-figure numbers, the plot, INVEST.** ECHO is
   four levels at 150px: half left, half right, full left, full right; a
   half echo does half damage and is drawn half size; priced 1.35 / 1.7 /
   2.05 / 2.4. `src/format.ts` reads every number at three figures on the
   K / M / B / T / Q / Qi / Sx / Sp / Oc / No / Dc ladder (`1.02K% PAR`,
   `+1.84K% DMG`). The end screen's "% of the growth on offer" is replaced
   by a plot of `dps / parDps` per wave against a dashed PAR line, with
   peak DPS beside it. Every RISK on screen reads INVEST (the code keeps
   the `risk` key).

**Measured.** `npm run balance` seeds 1-3 read identical to 1.1 through
every version (33.9 / 34.3 / 43.9s): the bot dies at wave 3, before any
change here can reach it. That is the instrument's reach, not a null
result. `npm run from -- --dps=1e5` is the one instrument that meets a
shooter, an echo or a pierce-5 build:

| build | survival | fire/min | pierce held | claim / measured hits per landing |
| --- | --- | --- | --- | --- |
| 1.1 | 34.8 / 29.3 / 25.1s | 82.8 / 65.5 / 69.3 | 2 | 2.00 / 2.2-2.5 |
| 1.3 | 52.8 / 50.6 / 64.1s | 47.7 / 29.6 / 27.1 | 2 | 2.00 / 2.2-2.5 |
| 1.4 | 89.3 / 52.7 / 41.4s | 45.0 / 25.0 / 37.7 | 5 | 4.50 / 3.5-4.2 |
| 1.5 | 61.7 / 73.7 / 64.1s | 53.5 / 41.5 / 36.5 | 5 | 4.50 / 3.9-4.2 |

Fire loss per minute roughly halved from 1.1 to 1.3 for a bot that never
steps aside. At q 0.7 the fast-forwarded build stacks pierce to 5 and the
price OVERSHOOTS the board there (claim 4.5, measured 3.5 to 4.2): 0.7
fixes the undershoot the author felt at pierce 2 and opens an overshoot
past 4. A linear q cannot be right at both ends.

`verify`, `model`, `repeat` (0.00%), `moments`, `endscreen`, `rescue`,
`rail`, `behaviour` and `hud` pass on 1.5.

## 4. What the author still has to do or decide

- **Play everything in §3.** Nothing since 0.5 has been played by a human:
  the shooter curve, the body block, the ghosts (their size, their 150px,
  their bullets off the edge), the plot, the INVEST word, `1.02K%` on the
  rail.
- **Pierce past 4 held.** If the overshoot is real in play, the fix is a
  `q` that eases past three held, not a different constant.
- **Is the Titan blockable?** SHIELD never blocks it (my call). Say so if
  it should.
- **ECHO's weight (24) and wave (4)** are mine; so is slate `0x9fb4c8`.
- **The plot's y axis** tops at the larger of 150% and the run's peak;
  a run that spends its life at 40% is a line in the bottom third. A log
  axis is the alternative if that reads flat.
- **`hud-echo.png` and the pause grid** are the only stills of the ghosts
  and the ten tiles; the impeccable reviewer has not seen either.
- Everything from §4 of the previous handoff still stands: the late
  dead-space slope, the guide's hand-typed numbers, deploying and
  watching GoatCounter, the spawn line's feel, the cage's HP against a +2.

## 5. Known gaps — name these as unverified if you report on them

- **No instrument plays with ECHO on purpose.** The bot takes it when the
  scoring says so; `from` does not print whether it did. The ghosts'
  bullets off the edge (the wastage the price assumes) are unmeasured.
- **The probe cannot see 1.2 to 1.5 at all** below wave 5; `from` sees
  them at wave 16-17 with a bot that never dodges.
- **The DETAILS page's working lines** were not re-read after the
  formatter change; `num` there still shows two decimals under 10.
- **`DESIGN.md` is stale** by the 4x3 grid, the plot and INVEST. The
  documenter and the finish reviewer were not run this session.
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
- `Progression.ts` defines squad strength (ECHO's ladder is `echoColumns`
  there); `Scoring.ts` prices every offer once; `Contact.ts` prices every
  arrival once; `Mode.ts` holds difficulty; `Shield.ts` is the one charge
  pool; `format.ts` is the one number formatter.
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
INVEST.

## 8. How to report

What landed, what the instruments say (with seeds), what you could not verify,
and what you would do next. **Name unverified claims as unverified**, and keep
`ASKS.md` current: every ask the author makes goes in verbatim with a status.
