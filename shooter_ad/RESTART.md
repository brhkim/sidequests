# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo,
on branch `claude/laughing-feynman-ghh9r3` (no PR open; the branch is ahead
of `main` by three sessions' work; the last commit is this session's, the
rescue / spawn-line / army-floor commit, on top of `6efb319`). The
version tag is **1.0**; a seed only compares with another 1.0 run. Nothing is blocked. §4 is what the author
still has to do or decide, §5 what nobody has verified.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, the shared-tree rules for
   subagents, the measuring-before-tuning rules.
2. `shooter_ad/ASKS.md` — **the author's asks, verbatim, with a status per
   ask**, four sessions of them. The last section (2026-09-20, third
   session: rescues and the spawn line) is the checklist this session is
   judged against. Read it first.
3. `shooter_ad/PRODUCT.md` — product truth and the decisions on record.
4. `shooter_ad/notes.md` — design intent; wins over `CLAUDE.md`. From this
   session: "Rescue cages are a refund, and they cost something" (retitled;
   the reward rule), "The field starts where the HUD ends", and "A
   multiplier on the army adds at least one soldier".
5. `shooter_ad/CLAUDE.md` — mechanics. From this session: "The spawn line
   is the HUD's bottom edge, and the descent is scaled to it", "An army
   multiplier adds at least one body", and the `cageReward` paragraph under
   "Rescue cages roll once per wave".
6. `shooter_ad/DESIGN.md` — the design system as shipped, re-derived from
   the build by the impeccable documenter at the end of this session (the
   three button weights, the segmented rows, the BASICS grid, every screen's
   coordinates); the direction contract for the screens is
   `.impeccable/surfaces/src-scenes-hud-startscreen-ts.md`.
7. `git log --oneline -10` — the commit messages carry the reasoning and the
   measurements.

Then:

```bash
cd shooter_ad && npm ci && npm run build && npm run verify && npm run model
npm run endscreen  # start / guide / pause / end screens; presses every button
npm run moments    # every feedback moment; the Titan bar in its row
npm run hud        # the rail (YOUR DPS / PAR DPS) and the strip at three states
npm run balance    # prints cages/min and opened (cages the bot happened to shoot)
npm run rescue     # forces a cage open at seven army sizes; the reward table
```

Do not start until you have looked at `.verify/screenshot.png`,
`.verify/start-hard.png`, `.verify/start-guide.png`, `.verify/pause-mid.png`,
`.verify/moment-titan-bar.png` and `.verify/end-poor.png`.

## 2. What the game is

**DPS golf.** Every 7.5 seconds three bonuses descend and you must judge, before
they arrive, which most increases your damage output. A stat is
`base × (1 + pool) × mult`; raw draws scale to the pool so neither form is
ever dominant. Difficulty is closed-loop against a shadow "par" player who
takes the best DPS option every time and collects nothing else. Four
judgment levers rise with the wave: descent speed, root granularity, raw
rounding, and dead space between the gates. MOVE, TIME and SENSE are RISK
axes: worth zero to the scoring, never taken by par, the player's gamble.

## 3. What changed this session, in the order it landed

Every item is the author's ask, recorded verbatim in `ASKS.md`. Version
**1.0**; all three are balance changes.

1. **The rescue reward is a tenth of the army, whole, floor 2**
   (`cageReward` in `Progression`, one function for the open and the
   cage's label). It was +5 flat under 100 power: DPS is linear in power
   under the ring cap, so a first-wave cage was a ×6 and read as standing
   2-3. Now ×2.67 at power 1, ×1.10 from 19 on; 40% per wave unchanged.
   `npm run rescue` is the instrument; `balance` prints `opened`.
2. **Enemies and cages spawn at the HUD's bottom edge** (y 184,
   `HUD_ROWS.bottom`; was -40). `ARENA.descentScale` (766/990) scales every
   vertical speed once so the seconds to the line are unchanged per body
   (asserted per type in `model`). The Titan spawns 40px above the line;
   its travel seconds, and so its HP, moved 68.7s → 69.4s (+1%); it is on
   screen for all but 3.4s of its descent instead of missing its first
   17.6s. Retreat ceiling is the spawn line. Gates are untouched.
3. **A `×ARMY` gate adds at least one body**: `max(1, round(power × (root
   − 1)))`, the raw rule; ×1.1 on 1 gives 2. Par goes through the same
   `applyGate`, so it is priced and graded on the same floor.

### 3a. The previous session (0.8 / 0.9), kept for the record

1. **(0.8) The rescue glitch.** `Enemies.updateCages` reset its clock only
   on a successful roll, so a failed 40% roll was re-rolled every step until
   one passed: one cage per wave, always. Watched on the 0.7 build: cages at
   17.0 / 32.2 / 47.5 / 61.7s on every seed. The clock now restarts on every
   roll; `stats.cages` and `cages/min` in `npm run balance` are the new
   instrument.
2. **(0.8) Two more stages on the judgment curve.** Gate speed rises at the
   same 0.075/wave to ×3.25 at wave 31 (was ×2.5 at 21). Dead space keeps
   its 6px/wave to 72px at wave 16, then 2.5px/wave to 97px at wave 26 (an
   83px gate, `minWidth` 100 → 80). The late width slope is my call: 6px/wave
   for ten more waves leaves a 48px card. `npm run model` asserts both caps.
3. **The Titan bar is a third row** under both panels: an 18px panel
   backing directly under the strip's hairline, the 10px bar and TITAN tag
   on it, the warning band beneath.
4. **The UX round** (impeccable context loaded; rendering only): every
   control is a `cardButton` (primary / secondary / danger, hover and
   pressed fills); difficulty and pause tabs are `segmented`; the pause
   screen is BASICS / BONUSES / DETAILS, with `hud/PauseGuide` (twelve
   tappable topics in plain words; HOW TO PLAY is the button that opens it); the start screen's HOW TO PLAY opens
   that screen before a run (GameScene publishes a start-state HUD frame in
   `announceMatch`); the demo offer deals six offers in rotation; every
   explanation, caption and rail label is written for a first-time player;
   the end screen says YOUR SQUAD WAS OVERRUN / OF THE GROWTH ON OFFER /
   PEAK DAMAGE / SEC; the rank word under the strip's ARMY cell is gone.
   The pitch is untouched. The finish review's eight fixes are in
   `ASKS.md` §4 and all taken. `npm run endscreen` presses every
   new control, opens the guide, and asserts the demo swap.

5. **The finish review and the documenter ran** (the two impeccable
   agents). The review's verdict was fix then ship; its eight fixes are all
   in (`ASKS.md` §4): 12px between START MATCH and HOW TO PLAY, the NORMAL
   segment in code cyan so START MATCH is the one green card, the guide's
   tab named BASICS under the HOW TO PLAY heading, a hairline under the tab
   row, explanation text at 17px working white, OF THE GROWTH ON OFFER, a
   PAR gloss on DETAILS, the BONUSES header stating the conversion twice.
   The documenter's one drift finding - tabs and topics at 40px, under the
   44px tap floor - was fixed in code. The author's last ask, the rank word
   under the strip's ARMY cell, is gone.

**Measured**, `npm run balance` seeds 1-5, skill 0.7, before on a snapshot
of the 0.7 build (`dc4c59a`) and after:

| | survival | median | optimal | standing | cages |
| --- | --- | --- | --- | --- | --- |
| 0.7 | 37.3 / 43.7 / 50.2 / 52.9 / 58.3s | 50.2s | 90% | 1.00 | one per wave, every seed |
| 0.8 | 34.6 / 39.5 / 50.0 / 50.2 / 53.4s | 50.0s | 93% | 1.00 | 1 / 1 / 1 / 1 / 2 per run (1.52/min) |
| 0.9 (startPower 1) | 34.3 / 34.3 / 34.9 / 39.8 / 57.5s | 34.9s | 73% | 1.00 | 1 / 1 / 2 / 1 / 0 per run (1.72/min) |
| 1.0 | 33.9 / 34.3 / 34.3 / 43.9 / 44.7s | 34.3s | 73% | 1.00 | 0 / 1 / 1 / 1 / 0 per run (1.34/min) |

The 1.0 row is measured on this session's build, seeds 1-5, skill 0.7, the
same instrument. The bot never aims at a cage; `opened` on 1.0 reads
1 (+2) on seed 3, 0 elsewhere (a cage the bot's column happened to be under). The army
floor changes which gate par and the bot take on the opening army of 1, so
1.0 seeds diverge from 0.9 seeds at the first offer - read the medians.
`npm run repeat` reads 0.00% on 1.0. `npm run titan`: median delivery **0.90** over six kills (1.00 / 0.81 / 0.80 at 1e5 DPS, 1.00 / 0.90 / 0.74 at 1e8), against 1.00 over six on the contact-damage build and 0.98 over nine before it; every seed inside the earlier per-seed spread (0.64 to 1.08), so read it as a possible drop, not a measured one - see §5.

The 0.7 cage column is from a scratch page script that watched
`enemies.cages` (the 0.7 build has no `cages` stat, so `PROBE_DIST` against
it reads zero by construction); the 0.8 column is `stats.cages`. Survival
did not move; the bot never aims at a cage, so it never collected the
extra ones. `npm run repeat` reads 0.00%. `npm run neutral` against the
0.7 snapshot FAILS on 4/5 seeds, as a balance change must. `verify`,
`model`, `moments`, `hud` and `endscreen` all pass on `99368ee`.

## 4. What the author still has to do or decide

- **The late dead-space slope.** 2.5px/wave from wave 16 is my reading of
  "similar curve" against a card that has to hold its label. If the full
  6px/wave is wanted, the label has to shrink or go one-line.
- **Play it on a phone.** The buttons' pressed states, the guide (twelve
  topics of copy nobody but me has read), the Titan row, the rail's new
  words, the demo rotation, the second-stage curves (past wave 16 - the
  bot never gets there) are all unplayed.
- **Whether the guide's numbers should be generated.** `×1.35 against
  +47%` and `25 / 50 / 75%` in the topic copy are today's config, typed by
  hand; a config change will silently date them.
- **Deploy and look at the GoatCounter dashboard** (still unobserved).
- **`startPower` is 1** (your ask, 0.9). The bot's median survival
  went 50.0s to 34.9s with it; the open is a lone unit until the first
  gate. `npm run verify` now stands under the lowest enemy instead of
  sweeping, because a sweep killed nothing at power 1.
- **Play the spawn line.** Bodies now appear at the Titan row's edge,
  half under it for a frame; the Titan emerges over 3.4s. Whether that
  reads as "arriving" or as "popping in" is a phone question. If it pops,
  the lever is the Titan's 40px lead (`TITAN_SPAWN_Y`) and a fade on the
  first few px in `SpriteRender`, not the speeds.
- **The cage's HP against a +2.** A cage still costs a fifth of a Titan
  (~2.65s of par's single-target fire) to open. At power 1 a +2 is a
  doubling and worth it; at power 15 it is +2 for two seconds of diverted
  fire. If mid-run cages read as walls, `CAGE.hpTitanFraction` is the
  lever, not the reward.

## 5. Known gaps — name these as unverified if you report on them

- **Nothing here has been played by a human since 0.5**, on any device.
- **The second-stage curves are unreached by every instrument** except
  `npm run model`'s table and `moment-deadspace` (wave 16, the first cap).
  No run has been played past wave 16 on this build.
- **Cage frequency is measured only over the bot's ~35-60s runs**: two to
  four rolls a seed. The 40% is asserted by the code's shape and the watch
  script, not by a long run. The reward is measured by `npm run rescue`
  (forced cages, standing squad) and nowhere in play.
- **The spawn line is verified by the stills and `model`'s arithmetic**,
  not by feel: `.verify/screenshot.png` shows bodies just under the strip,
  `moment-titan-bar.png` the Titan emerging under its bar. Nobody has
  watched a body cross the line in motion.
- **Titan delivery read 0.90 this session against 1.00 before**, six kills
  each, every seed inside the earlier spread. If it is real, the candidate
  is the Titan's volleys: it now fires from y 144 instead of -80, so its
  darts reach a parked squad sooner and cost more (lost to fire 230 / 153 /
  237 at 1e8, unrecorded before). Re-run `npm run titan` on a snapshot of
  `6efb319` beside this build before believing either number.
- **The army floor is asserted in `model` and unplayed.** Its effect on
  par's early picks is real (par now takes ×1.1 ARMY on 1) and shows up as
  seeds diverging from 0.9 at the first offer.
- **The demo swap is asserted in a still at 3.2s**; the motion between is
  unseen. Pressed states are unseen (a tap hides the screen).
- **The guide's copy is unread by anyone but me.** Twelve topics; the
  numbers in them (×1.35 against +47%, 25 / 50 / 75%) are the config's
  today and are not generated from it.
- **The RISK wash, `pickRisk` and analytics** remain as last session left
  them: unforced, unheard, unobserved end to end.
- **DESIGN.md is the documenter's reading of the build**, not a plan; read
  it against the stills. One thing it left as unverified: the field-feedback
  bullet still mentions a `+N ARMY` float "for streaks", and streaks were
  removed on 2026-09-20 - check `scenes/fx/FieldFx` before repeating it.
- **Hover and pressed states exist only in code**; no still shows one.
- **The cage watch script was not kept** (`scripts/_cages.mjs`, deleted);
  `stats.cages` and `cages/min` in `npm run balance` are the instrument
  now. If the frequency is questioned again, watch a long run, not a
  40-70s one.

## 6. Ground rules

- **A typecheck is not verification.** Look at the images; listen to the WAVs.
- The simulation runs on a fixed 1/60s step (`SIM`); rendering and audio read
  `elapsed` for phase and never the RNG. `npm run repeat` must read 0.00%.
- A rendering-only change is proven with `npm run neutral` against a `dist/`
  snapshot taken BEFORE the change. A balance change bumps the version.
- `Progression.ts` defines squad strength; `Scoring.ts` prices every offer
  once; `Contact.ts` prices every arrival once; `Mode.ts` holds difficulty.
- Nothing in `systems/` reads the event stream, audio or analytics.
- Commit subjects `shooter_ad:`; stage explicit paths, never `git add -A`.
- `pkill -f` on a script name matches your own shell; kill by PID.
- The impeccable skill lives at `.claude/skills/impeccable/`; run its
  `context` once per session (`sh .../scripts/impeccable context`, the file
  is not executable) before any UI work, and its reviewer and documenter
  agents at the end. `.impeccable/review/` is ignored;
  `.impeccable/surfaces/` and `design.json` are tracked.
- No CI on pull requests; local `verify` is the gate.

## 7. Settled — do not relitigate

Everything in the previous list, plus: MOVE / TIME / SENSE are worth zero
to the scoring and par never takes them; a RISK pick counts as no growth;
there is no automatic army; the rescue is a tenth of the army, floor 2, at
40% a wave, and par never collects it; enemies spawn at the HUD's bottom
edge with the descent time unchanged; a `×ARMY` gate adds at least one
body; the strip lives under the rail and the field
moved down with it; the Titan bar is a row under both; RISK is a fifth
word beside PERFECT / GOOD / BAD / MISS; the root tables drift and the
drift is accepted; SENSE is 25 / 50 / 75; peak DPS is a score on the end
screen; waves survived stays the headline; the screens are built from the
gate card and every control is a card button; the pause screen has a HOW
TO PLAY page that the start screen also opens; the judgment curve has two
more stages; the cage roll's clock restarts on every roll; analytics is
GoatCounter at `brhkim`.

## 8. How to report

What landed, what the instruments say (with seeds), what you could not verify,
and what you would do next. **Name unverified claims as unverified**, and keep
`ASKS.md` current: every ask the author makes goes in verbatim with a status.
