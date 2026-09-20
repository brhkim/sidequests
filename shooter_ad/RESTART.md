# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo,
on branch `claude/laughing-feynman-ghh9r3` (no PR open; the branch is ahead
of `main` by two sessions' work). The version tag is **0.8**; a seed only
compares with another 0.8 run. Nothing is blocked. §4 is what the author
still has to do or decide, §5 what nobody has verified.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, the shared-tree rules for
   subagents, the measuring-before-tuning rules.
2. `shooter_ad/ASKS.md` — **the author's asks, verbatim, with a status per
   ask**, three sessions of them. The last section (2026-09-20, the UX
   round) is the checklist this session is judged against. Read it first.
3. `shooter_ad/PRODUCT.md` — product truth and the decisions on record.
4. `shooter_ad/notes.md` — design intent; wins over `CLAUDE.md`. From this
   session: the rescue paragraph under "Rescue cages are the catch-up" (the
   glitch), the second stage under "Dead space between gates", "The Titan's
   bar is a third row" under "HUD and layout", and "Buttons look like
   buttons, and the game explains itself to a stranger" under "The start
   screen says what the game is".
5. `shooter_ad/CLAUDE.md` — mechanics. From this session: "Rescue cages
   roll once per wave, and for two versions they did not", the second-stage
   paragraphs under "Dead space is the fourth judgment lever" and "Gate
   approach speed", and "Every control is a card button, and the pause
   screen has a HOW TO PLAY page" under HUD-as-built.
6. `shooter_ad/DESIGN.md` — the design system as shipped; the direction
   contract for the screens is `.impeccable/surfaces/src-scenes-hud-startscreen-ts.md`.
7. `git log --oneline -10` — the commit messages carry the reasoning and the
   measurements.

Then:

```bash
cd shooter_ad && npm ci && npm run build && npm run verify && npm run model
npm run endscreen  # start / guide / pause / end screens; presses every button
npm run moments    # every feedback moment; the Titan bar in its row
npm run hud        # the rail (YOUR DPS / PAR DPS) and the strip at three states
npm run balance    # now prints cages/min
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

Every item is the author's ask, recorded verbatim in `ASKS.md`.

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

**Measured**, `npm run balance`, skill 0.7 (see §3 of the session report in
the final commit message for the five-seed table; the cage rate is the
number to read - the 0.7 build was one cage per wave on every seed).
`npm run repeat` reads 0.00%. `npm run neutral` against a 0.7 snapshot
FAILS on 4/5 seeds, as a balance change must.

## 4. What the author still has to do or decide

- **The late dead-space slope.** 2.5px/wave from wave 16 is my reading of
  "similar curve" against a card that has to hold its label. If the full
  6px/wave is wanted, the label has to shrink or go one-line.
- **Play it on a phone.** The buttons' pressed states, the guide, the Titan
  row, the rail's new words, the second-stage curves (past wave 16 - the
  bot never gets there) are all unplayed.
- **Deploy and look at the GoatCounter dashboard** (still unobserved).
- **`startPower` 5.** Still my number from last session.

## 5. Known gaps — name these as unverified if you report on them

- **Nothing here has been played by a human since 0.5**, on any device.
- **The second-stage curves are unreached by every instrument** except
  `npm run model`'s table and `moment-deadspace` (wave 16, the first cap).
  No run has been played past wave 16 on this build.
- **Cage frequency is measured only over the bot's ~40-70s runs**: two to
  four rolls a seed. The 40% is asserted by the code's shape and the watch
  script, not by a long run.
- **The demo swap is asserted in a still at 3.2s**; the motion between is
  unseen. Pressed states are unseen (a tap hides the screen).
- **The guide's copy is unread by anyone but me.** Twelve topics; the
  numbers in them (×1.35 against +47%, 25 / 50 / 75%) are the config's
  today and are not generated from it.
- **The RISK wash, `pickRisk` and analytics** remain as last session left
  them: unforced, unheard, unobserved end to end.
- DESIGN.md is re-derived by the documenter at the end of the session;
  read it against the stills rather than trusting it.

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
there is no automatic army; the strip lives under the rail and the field
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
