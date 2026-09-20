# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo,
on branch `claude/laughing-feynman-ghh9r3` (no PR open; the branch is ahead
of `main` by the whole 2026-09-20 session). The version tag is **0.7**; a seed
only compares with another 0.7 run. Nothing is blocked. §4 is what the author
still has to do or decide, §5 what nobody has verified.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, the shared-tree rules for
   subagents, the measuring-before-tuning rules.
2. `shooter_ad/ASKS.md` — **the author's asks, verbatim, with a status per
   ask**, two sessions of them. The 2026-09-20 sections (§1-§4) are the
   checklist this session is judged against. Read it first.
3. `shooter_ad/PRODUCT.md` — product truth and the decisions on record.
4. `shooter_ad/notes.md` — design intent; wins over `CLAUDE.md`. From this
   session: "RISK: the three axes par never takes", "No automatic army", the
   rewritten "Numeric legibility", the rescue-frequency paragraph, and under
   "HUD and layout" the strip move, the field move and the card-built screens.
5. `shooter_ad/CLAUDE.md` — mechanics. From this session: "Scoring prices DPS
   and nothing else; MOVE, TIME and SENSE are RISK", "Legibility drifts in
   strength, by a measured and accepted amount", "Analytics", the
   HUD-as-built and "The three screens are built from the gate card"
   paragraphs, the Army-growth bullet.
6. `shooter_ad/DESIGN.md` — the design system as shipped, re-derived from the
   build by the impeccable documenter at the end of the session; the direction
   contract for the screens is `.impeccable/surfaces/src-scenes-hud-startscreen-ts.md`.
7. `git log --oneline -8` — the commit messages carry the reasoning and the
   measurements.

Then:

```bash
cd shooter_ad && npm ci && npm run build && npm run verify && npm run model
npm run endscreen  # start / pause / end screens: the card-built screens
npm run moments    # every feedback moment; the RISK wash is not forced (see §5)
npm run hud        # the strip under the rail at three states
```

Do not start until you have looked at `.verify/screenshot.png`,
`.verify/start-hard.png`, `.verify/pause-mid.png` and `.verify/end-poor.png`.

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

Every item is the author's decision, recorded verbatim in `ASKS.md`.

1. **(0.6) MOVE, TIME and SENSE are RISK axes.** `progressValue` is
   `squadDps`; the access and sense factors are deleted; `RISK_AXES` names
   the three. Par never takes one beside a damage option (asserted over 200
   modelled runs). A player who takes one sees a lavender RISK wash, hears
   `pickRisk`, and it counts as no growth in the optimal percentage (the
   author confirmed: "it's an investment by the player"). `tally` is five
   buckets `top / mid / low / risk / miss`.
2. **(0.6) No automatic army.** Wave-clear and streak army are gone on both
   sides. **`SQUAD.startPower` 1 → 5**, my call: with the wave-1 `+4` gone a
   start of 1 made the first leaked Grunt at ~30s the end of the run on three
   seeds in five.
3. **(0.6) Rescue cages roll at 40%** per wave duration.
4. **(0.6) The author's root schedule**: waves 1-5 `[1.1, 1.25, 1.5]`, 6-10
   tenths, 11-15 every `.05`, 16+ every `.01`; drift +0.38 / +1.91 / -0.09%
   per draw against the finest tier, accepted, capped at 2.5% in `npm run
   model`.
5. **(0.6) Peak DPS on the end screen**; the strip under the rail; the pause
   button in the rail's right-hand 80px; every text size under 18px raised
   for the phone.
6. **(0.7) The lane and the breach line moved down 88px** to 888 / 950, so
   the field is as tall as it was; every descent is 88px longer.
7. **(0.7) SENSE marks 25 / 50 / 75%** of offers at one, two, three held.
8. **(0.7) Anonymous analytics, ON.** `src/analytics/Analytics.ts` is
   GoatCounter; `ANALYTICS.site` is `brhkim` (the author's site). It loads
   only on the deployed page: never on `?seed=` pages, never on `localhost`
   / `127.0.0.1` (the dev server and `npm run verify`, whose bare player
   URL would otherwise log a failed script load as a console error in a
   sandbox that cannot reach the counter). Counts: pageviews, `run/start`,
   `run/end/<mode>/wave-NN`, `run/time/<bucket>`.
9. **The UI pass** (impeccable, code-led, rendering only). The screens are
   built from the gate card: `hud/CardTile.ts` is the tile and the button
   shape; the start screen is a first wave (a demo offer descending on a
   2.6s loop, the squad on the field's own ground, START MATCH as a card);
   the pause BONUSES page is eight tiles plus one tap-to-read line under the
   ruler; the end screen's tally is five card footprints and the waves
   number counts up. Finish review: fix, eight items, all scored resolved,
   ship. Three authored motions now exist (pick wash, demo descent,
   count-up); DESIGN.md says "don't add a fourth".

**Measured**, `npm run balance` seeds 1-5, skill 0.7, before on a snapshot of
`36c65ca` and after each balance step:

| | survival | median | optimal | standing | contact/min | breach/min |
| --- | --- | --- | --- | --- | --- | --- |
| 0.5 | 41.6 / 42.1 / 42.9 / 44.2 / 81s | 42.9s | 78% | 0.87 | 1.4 | 15.4 |
| 0.6 | 36.5 / 38.4 / 41.3 / 66.8 / 71.6s | 41.3s | 100% | 1.00 | 4.4 | 9.0 |
| 0.7 | 37.3 / 43.7 / 50.2 / 52.9 / 58.3s | 50.2s | 90% | 1.00 | 2.1 | 13.4 |

Standing sits exactly on par now because par collects nothing the bot does
not and spends no picks on access. The 0.7 row is the longer descent. `npm
run repeat` reads 0.00% on every build. `npm run moments` failed once on its
death-beat timing under headless load and passed on rerun: flaky check, not
the beat. Before the start went to 5 the 0.6 median was 31.7s.

## 4. What the author still has to do or decide

- **Deploy and look at the GoatCounter dashboard.** The first real count is
  theirs to see; nothing from this session reached the counter (the sandbox
  cannot).
- **Play it on a phone.** The strip position, the type sizes, the longer
  descent, the RISK wash, the two new screen motions and the card-built
  screens are all unplayed.
- **`startPower` 5.** My number; revert to 1 for the harder open.

## 5. Known gaps — name these as unverified if you report on them

- **Nothing here has been played by a human since 0.5**, on any device.
- **The demo descent and the count-up are unseen in motion**; judged from
  code and one still each.
- **The RISK wash is not forced by `npm run moments`**; seen only on the
  end screen (`end-poor.png`). Same `GRADE_COLOR` / `GRADE_WORD` path as
  the three grades.
- **`pickRisk` is unheard**; `npm run audio` renders it.
- **Gate cards emerge from beneath the strip**, so the first ~90px of an
  offer's descent is hidden. Unplayed.
- **Analytics is unobserved end to end**: the script tag and endpoint are in
  the bundle (`grep goatcounter dist/game.js`), the event paths are
  exercised by nothing.
- The contact share regime above 75 power is unmeasured by every
  instrument, as before; the probe bot never takes a risk axis and never
  stands in dead space.
- DESIGN.md drift the documenter saw and left: the field SENSE tag is 16px
  where the record says 14; the end screen's two 13px captions and 12px
  version line sit under the stated 13px floor; the sidecar's rail and strip
  CSS carry pre-phone-floor sizes.

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
  `context` once per session before any UI work, and its reviewer and
  documenter agents at the end. `.impeccable/review/` is ignored;
  `.impeccable/surfaces/` and `design.json` are tracked.
- No CI on pull requests; local `verify` is the gate.

## 7. Settled — do not relitigate

Everything in the previous list, plus: MOVE / TIME / SENSE are worth zero
to the scoring and par never takes them; a RISK pick counts as no growth;
there is no automatic army; the strip lives under the rail and the field
moved down with it; RISK is a fifth word beside PERFECT / GOOD / BAD / MISS;
the root tables drift and the drift is accepted; SENSE is 25 / 50 / 75; peak
DPS is a score on the end screen; waves survived stays the headline; the
screens are built from the gate card; analytics is GoatCounter at `brhkim`.

## 8. How to report

What landed, what the instruments say (with seeds), what you could not verify,
and what you would do next. **Name unverified claims as unverified**, and keep
`ASKS.md` current: every ask the author makes goes in verbatim with a status.
