# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo,
on branch `claude/laughing-feynman-ghh9r3` (no PR open; the branch is ahead
of `main` by four sessions' work; the last commit is this session's, the
Mortar / shell / SHIELD commit, on top of `df18f94`). The version tag is
**1.1**; a seed only compares with another 1.1 run. Nothing is blocked. §4
is what the author still has to do or decide, §5 what nobody has verified.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, the shared-tree rules for
   subagents, the measuring-before-tuning rules.
2. `shooter_ad/ASKS.md` — **the author's asks, verbatim, with a status per
   ask**, five sessions of them. The last section (2026-09-21, fourth
   session: the shell and the shield) is the checklist this session is
   judged against. Read it first.
3. `shooter_ad/PRODUCT.md` — product truth and the decisions on record.
4. `shooter_ad/notes.md` — design intent; wins over `CLAUDE.md`. From this
   session: "`+SHIELD`: a bonus about surviving fire", "RISK: the four axes
   par never takes" (retitled), and "The Mortar fires a shell: one big slow
   bullet" under "Enemy fire scales with the army".
5. `shooter_ad/CLAUDE.md` — mechanics. From this session: "`+SHIELD` is a
   charge pool the squad owns", "A shell is a big slow round" under Art, the
   `npm run rail` line, and the ten-type roster in the contact table.
6. `shooter_ad/DESIGN.md` — the design system as shipped. This session
   changed two lines of its Layout section by hand (the five-lane rail and
   the 3x3 pause grid); the rest is the documenter's reading of the 1.0
   build and has NOT been re-derived.
7. `git log --oneline -10` — the commit messages carry the reasoning and the
   measurements.

Then:

```bash
cd shooter_ad && npm ci && npm run build && npm run verify && npm run model
npm run moments    # every feedback moment; moment-block.png is new
npm run rail       # the rail at its widest state; fails if two texts touch
npm run roster     # ROSTER_SCALE=3 for the zoom: the Mortar is last in the row, the shell bottom-left
npm run hud        # the rail's five columns at three states
npm run balance    # prints `shield: N held, M blocked` per seed
npm run from -- --dps=1e5   # the only instrument that meets a Mortar
```

Do not start until you have looked at `.verify/screenshot.png`,
`.verify/moment-block.png`, `.verify/roster-zoom.png`, `.verify/pause-mid.png`
and `.verify/hud-mid.png`.

## 2. What the game is

**DPS golf.** Every 7.5 seconds three bonuses descend and you must judge, before
they arrive, which most increases your damage output. A stat is
`base × (1 + pool) × mult`; raw draws scale to the pool so neither form is
ever dominant. Difficulty is closed-loop against a shadow "par" player who
takes the best DPS option every time and collects nothing else. Four
judgment levers rise with the wave: descent speed, root granularity, raw
rounding, and dead space between the gates. MOVE, TIME, SENSE and SHIELD
are RISK axes: worth zero to the scoring, never taken by par, the player's
gamble.

## 3. What changed this session, in the order it landed

Both items are the author's asks, recorded verbatim in `ASKS.md`. Version
**1.1**; both are balance changes (a new type in the wave-6 pool and a new
card in the wave-3 pool both move the seeded stream).

1. **The Mortar and its shell.** A tenth enemy type (`data/enemies.ts`):
   medium tier, wave 6, weight 22, waypoint motion, a squat grey pot that
   lobs one aimed shell every 3.2s. `GunSpec.shell` marks the gun;
   `EnemyBullet.shell` carries it; the shell has a 9px hit circle
   (`ENEMY_FIRE.shellRadius`, a dart is 5), flies at 105 px/s (darts
   165-210) and has `damage: 2`, so it costs twice a dart through the same
   1%-floor-1 arithmetic. Drawn as `eshell`, a scarlet outlined round
   (`COLORS.enemyShell`), never a dart. The Mortar's accent is the loaded
   shell glowing in its muzzle, pulsing like the Bomber's ember.
2. **SHIELD.** A fourth RISK axis. `systems/Shield.ts` is a charge pool the
   squad owns: `2 × level` charges, refilling at that many per 5s, one
   spent per landing bullet whatever it cost (a shell is one block), filled
   to capacity the moment a level is taken; three levels, out of the offer
   pool at the cap, offered from wave 3 at weight 30. `GameScene.applyIncomingFire`
   hands `EnemyBullets.collide` an `absorb` callback; an absorbed bullet
   costs nothing and pushes a `block` event (BLOCK word, ring flash, shard
   puff, `block` cue). Shown as a bronze arc ring around the leader (one
   segment per charge), the rail's fifth column `ready/capacity` over READY,
   a ninth pause tile, two guide topics and a start-screen demo card.
3. **Forced by 2, not asked:** the rail is five unequal lanes (82 / 100 /
   96 / 100 / 82) with 13px labels and untracked 13px sub-lines, and
   `npm run rail` (new) asserts 8px between neighbours at the widest state -
   its first run caught six pips at 123px in an 88px lane, which is why the
   SHIELD value is `4/6` and not pips. The pause BONUSES grid is 3x3 of
   160x64 tiles instead of 4x2 of 120x88.

**Measured**, `npm run balance` seeds 1-5, skill 0.7, before on a snapshot
of the 1.0 build (`df18f94`) and after:

| | survival | median | optimal | standing | shield |
| --- | --- | --- | --- | --- | --- |
| 1.0 | 33.9 / 34.3 / 34.3 / 43.9 / 44.7s | 34.3s | 73% | 1.00 | - |
| 1.1 | 33.9 / 34.3 / 34.3 / 43.9 / 44.7s | 34.3s | 73% | 1.00 | 0 held, 0 blocked on every seed |

**Identical to the decimal, and `npm run neutral` against the 1.0 snapshot
reads identical on 5/5 seeds.** That is NOT a null result; it is the
instrument's reach. The bot dies at wave 3 on every seed, three or four
decisions in; the Mortar enters the pool at wave 6, and no offer the bot
resolved was changed by the SHIELD candidate's weight. The probe regime
does not contain this change. `npm run repeat` reads 0.00%.

`npm run from -- --dps=1e5` (wave 17 injected, seeds 1-3, the bot parked
under its own stream) is the one instrument that meets a Mortar:

| | survival | fire/min | contact/min | breach/min | died |
| --- | --- | --- | --- | --- | --- |
| 1.0 | 40.7 / 47.3 / 33.4s | 66.3 / 40.6 / 50.3 | 0 / 0 / 1.8 | 5.9 / 3.8 / 10.8 | attrition x3 |
| 1.1 | 34.8 / 29.3 / 25.1s | 82.8 / 65.5 / 69.3 | 5.2 / 0 / 0 | 0 / 0 / 2.4 | attrition x3 |

Fire loss per minute rose by a quarter to a half and median survival fell
40.7s to 29.3s: a bot that never steps aside pays the shell at the highest
rate any player would. Whether a player who does step aside pays it at all
is unmeasured (§5). `from` does not print whether the bot held SHIELD; at
skill 0.7 it takes a random card 30% of the time and could have.

`verify`, `model`, `moments`, `rail`, `hud`, `endscreen`, `roster`,
`behaviour` (the Mortar is a shooter; 6 damage landed over the window) and
`audio` (the `block` cue peaks at -22.7 dBFS) all pass on this build.

## 4. What the author still has to do or decide

- **Play the shell.** 105 px/s over ~700px of visible descent is about
  seven seconds on screen from a Mortar at the top of the field, less from
  one that has walked down; whether that reads as "step out of it" or as
  "another dart" is a phone question. The levers are `speed` and
  `shellRadius`; `damage: 2` is your rule.
- **Play SHIELD.** The pool fills on the pick (my call; §ASKS). Two blocks
  per 5s per level against a Spitter's one dart per 2.1s means one level
  roughly neutralises one Spitter; against a Lancer's three-dart trident
  every 2.6s it blocks two of three. Whether that is worth a damage card
  is the gamble the axis is for, and nothing here has measured it: the bot
  never chooses it on purpose.
- **SHIELD's colour is bronze** (`0xd9a066`) between RATE's yellow and
  DMG's red-orange. It reads on the stills; nine axes on one wheel is
  crowded and this is the first place I'd expect a phone to disagree.
- **The Mortar's silhouette** (a pot on stub feet, a black muzzle) reads
  from the others at 3x in `roster-zoom.png`; at 1x it is the grey one.
  The glow in the muzzle pulses to zero and can be missing from a still.
- **Two BLOCK words on one step overlap** ("BLOCKK" in `moment-block.png`
  when two bullets land together). A count (`2 BLOCKED`) instead of a
  word per bullet is the obvious fix; I left it because the still is a
  forced worst case and the shard puffs already say two.
- Everything from §4 of the previous handoff still stands: the late
  dead-space slope, the guide's hand-typed numbers, deploying and
  watching GoatCounter, `startPower` 1, the spawn line's feel, the cage's
  HP against a +2.

## 5. Known gaps — name these as unverified if you report on them

- **Nothing here has been played by a human since 0.5**, on any device.
  The shell, the shield ring, the rail's fifth column, the 3x3 pause grid,
  the two new guide sentences and the demo's SHIELD card are all unplayed.
- **The probe cannot see either change** (§3): `balance` and `neutral`
  are identical before and after because the bot dies at wave 3. `from` at
  wave 17 sees the Mortar and not, deliberately, the player's answer to it.
- **SHIELD has never been taken on purpose by any instrument.** `model`
  proves the pool's arithmetic and `moments` proves two of three bullets
  are absorbed with one level held; no run has been played with it.
- **The Titan is unmeasured on this build.** `npm run titan` was not run;
  the Titan's budget is untouched, but the Mortar is in the wave-20 pool,
  so `poolAverageHp` and the wave's `hpMult` moved by a hair and the
  escorts a parked squad meets are unchanged.
- **`DESIGN.md` is the 1.0 documenter's reading plus two hand edits.** The
  documenter and the finish reviewer were not run this session.
- **The audio `block` cue has been rendered and measured, not heard.**
- **The RISK wash, `pickRisk` and analytics** remain unforced, unheard and
  unobserved end to end, as every handoff has said.

## 6. Ground rules

- **A typecheck is not verification.** Look at the images; listen to the WAVs.
- The simulation runs on a fixed 1/60s step (`SIM`); rendering and audio read
  `elapsed` for phase and never the RNG. `npm run repeat` must read 0.00%.
- A rendering-only change is proven with `npm run neutral` against a `dist/`
  snapshot taken BEFORE the change. A balance change bumps the version.
- `Progression.ts` defines squad strength; `Scoring.ts` prices every offer
  once; `Contact.ts` prices every arrival once; `Mode.ts` holds difficulty;
  `Shield.ts` is the one charge pool.
- Nothing in `systems/` reads the event stream, audio or analytics.
- Do not rebuild `dist/` while a probe is running against it: the probes
  serve `dist/` live, and a rebuild mid-run 404s the page. Snapshot first.
- Commit subjects `shooter_ad:`; stage explicit paths, never `git add -A`.
- `pkill -f` on a script name matches your own shell; kill by PID.
- The impeccable skill lives at `.claude/skills/impeccable/`; run its
  `context` once per session (`sh .../scripts/impeccable context`, the file
  is not executable) before any UI work, and its reviewer and documenter
  agents at the end. `.impeccable/review/` is ignored;
  `.impeccable/surfaces/` and `design.json` are tracked.
- No CI on pull requests; local `verify` is the gate.

## 7. Settled — do not relitigate

Everything in the previous handoff's list, plus: MOVE / TIME / SENSE /
SHIELD are worth zero to the scoring and par never takes them; SHIELD
blocks up to 2 bullets per 5s per level to three levels, one charge per
bullet whatever it cost; the Mortar's shell costs twice a dart and is one
bullet to a shield; the rail has five columns; the pause BONUSES grid is
3x3; the roster is ten types with no Healer.

## 8. How to report

What landed, what the instruments say (with seeds), what you could not verify,
and what you would do next. **Name unverified claims as unverified**, and keep
`ASKS.md` current: every ask the author makes goes in verbatim with a status.
