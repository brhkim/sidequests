# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo,
on branch `claude/laughing-feynman-ghh9r3` (no PR open). The version tag went
0.5 to 0.6 this session: every seed is a different match again. The session
of 2026-09-20 landed the author's balance and scoring decisions and moved the
HUD for the phone; §3 lists what changed. Nothing is blocked. §4 is what the
author still has to decide, §5 what nobody has verified.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, the shared-tree rules for
   subagents, and the measuring-before-tuning rules.
2. `shooter_ad/ASKS.md` — **the author's asks, verbatim, with a status per
   ask**, two sessions of them. The 2026-09-20 section is the checklist this
   session is judged against. Read it first.
3. `shooter_ad/PRODUCT.md` — product truth and the decisions on record. New:
   RISK axes, no automatic army, the strip under the rail, the root schedule.
4. `shooter_ad/notes.md` — design intent; wins over `CLAUDE.md`. New this
   session: "RISK: the three axes par never takes", "No automatic army", the
   rewritten "Numeric legibility" (the drift the author accepted), the
   rescue-frequency paragraph, the strip-moved paragraph under "HUD and
   layout".
5. `shooter_ad/CLAUDE.md` — mechanics. Rewritten: "Scoring prices DPS and
   nothing else; MOVE, TIME and SENSE are RISK", "Legibility drifts in
   strength, by a measured and accepted amount", the Army-growth bullet, the
   HUD-as-built paragraph.
6. `shooter_ad/DESIGN.md` — the design system as shipped; updated for the
   strip position, the phone type floor and the RISK colour.
7. `git log --oneline -6` — the commit messages carry the reasoning and the
   measurements.

Then:

```bash
cd shooter_ad && npm ci && npm run build && npm run verify && npm run model
npm run endscreen  # end screen with PEAK DPS and the five-column tally; pause pages
npm run moments    # every feedback moment; the RISK wash is not forced (see §5)
npm run hud        # the strip under the rail at three states
```

Do not start until you have looked at `.verify/screenshot.png`,
`.verify/end-poor.png` (RISK and MISS columns) and `.verify/pause-early.png`.

## 2. What the game is

**DPS golf.** Every 7.5 seconds three bonuses descend and you must judge, before
they arrive, which most increases your damage output. A stat is
`base × (1 + pool) × mult`; raw draws scale to the pool so neither form is
ever dominant. Difficulty is closed-loop against a shadow "par" player who
takes the best DPS option every time and collects nothing else. Four
judgment levers rise with the wave: descent speed, root granularity, raw
rounding, and dead space between the gates.

## 3. What changed this session (version 0.6)

All of it is the author's decision, recorded verbatim in `ASKS.md`.

1. **MOVE, TIME and SENSE are RISK axes.** `progressValue` is `squadDps`;
   the access and sense factors, `SCORING`, `reach`, `accessFactor` and
   `senseFactor` are deleted. `RISK_AXES` in config names the three. Par
   never takes one beside a damage option (asserted over 200 modelled runs;
   the 0.17% of offers that are all-risk tie and cost par nothing). A player
   who takes one sees a lavender **RISK** wash instead of a grade, hears a
   rising tritone (`pickRisk`), and it counts as no growth in the optimal
   percentage. `DecisionLog.resolve` returns the `Decision` (with `risk`);
   `tally` is five buckets `top / mid / low / risk / miss`. The pause
   BONUSES rows for the three say `RISK: no DPS, par never takes it`.
2. **No automatic army.** `WAVE.clearBonus` and `STREAK` are gone on both
   sides; par is credited with the kill and nothing else. The streak track
   left the rail; the `streak` event and cue are gone; the wave banner no
   longer says `+4 ARMY`. **`SQUAD.startPower` 1 → 5** (my call, flagged in
   ASKS §1.4): with the wave-1 `+4` gone a start of 1 made the first leaked
   Grunt at ~30s the end of the run on three seeds in five.
3. **Rescue cages roll at 40%** per wave duration, from 75%.
4. **The root schedule is the author's**: waves 1-5 `[1.1, 1.25, 1.5]`,
   6-10 the tenths, 11-15 every `.05`, 16+ every `.01`. Drift against the
   finest tier +0.38% / +1.91% / -0.09% per draw; `npm run model` prints it
   and caps it at 2.5% (`MEAN_DRIFT`).
5. **Peak DPS on the end screen**, beside OF OPTIMAL PLAY; `peakDps` is in
   the `stats` registry.
6. **The bonus strip sits directly under the rail** (y 72-166); the pause
   button is in the rail's right-hand 80px (`RAIL_PAUSE_WIDTH`,
   `PAUSE_BUTTON` at 500,33); the ground continues in a darker step below
   the breach line. Every HUD and screen text size under 18px went up two
   to three points (`DESIGN.md`, "The Phone Floor").

**Measured**, `npm run balance` seeds 1-5, skill 0.7, before on a snapshot of
`36c65ca` and after with everything above:

| | survival | median | optimal | standing | contact/min | breach/min |
| --- | --- | --- | --- | --- | --- | --- |
| before (0.5) | 41.6 / 42.1 / 42.9 / 44.2 / 81s | 42.9s | 78% | 0.87 | 1.4 | 15.4 |
| after (0.6) | 36.5 / 38.4 / 41.3 / 66.8 / 71.6s | 41.3s | 100% | 1.00 | 4.4 | 9.0 |

Read the standing as the interesting number: with par no longer collecting
wave-clear and streak army, and no longer spending picks on access, the bot
that takes the best DPS option sits exactly ON par. Optimal reads 100% on
three seeds because a risk pick scores zero and the bot never reaches for
one. `npm run repeat` reads 0.00% spread. Before the start went to 5 the
after median was 31.7s with three seeds dying at the first leak.

## 4. What the author still has to decide

- **Anonymous analytics.** Options were raised in the session summary
  (a privacy-first counter with custom events; a tiny serverless endpoint for
  scores; a hosted database for a leaderboard). Nothing built.
- **The UI design pass.** The author's ask #2 (screens are barebones and
  text-heavy) is open by agreement. It needs a comp-first pass with the
  impeccable skill on the three screens, not more polish of the current
  layout.
- **Whether a RISK pick should count in the optimal percentage.** It does
  (zero growth). Excluding it is a two-line change in `fractionOfOptimal`.
- **`startPower` 5.** My number; revert to 1 for the harder open.

## 5. Known gaps — name these as unverified if you report on them

- **Nothing here has been played on a phone since the changes.** The strip
  move and the type sizes were made FOR the phone and verified only in
  540x960 stills.
- **The RISK wash is not forced by `npm run moments`**; it was seen only on
  the end screen (`end-poor.png`, 2 RISK picks). The wash uses the same
  `GRADE_COLOR` / `GRADE_WORD` path as the three grades.
- **`pickRisk` is unheard**; `npm run audio` renders it to
  `.verify/audio/pickRisk.wav`.
- **Gate cards emerge from beneath the strip**, so the first ~90px of an
  offer's descent is hidden. Unplayed.
- **The contact share regime (above 75 power) is unmeasured** by every
  instrument, as before.
- The probe bot never takes a risk axis and never stands in dead space; its
  numbers are a floor.

## 6. Ground rules

- **A typecheck is not verification.** Look at the images; listen to the WAVs.
- The simulation runs on a fixed 1/60s step (`SIM`); rendering and audio read
  `elapsed` for phase and never the RNG. `npm run repeat` must read 0.00%.
- A rendering-only change is proven with `npm run neutral` against a `dist/`
  snapshot taken BEFORE the change. A balance change bumps the version.
- `Progression.ts` defines squad strength; `Scoring.ts` prices every offer
  once; `Contact.ts` prices every arrival once; `Mode.ts` holds difficulty.
- Nothing in `systems/` reads the event stream or knows about audio.
- Commit subjects `shooter_ad:`; stage explicit paths, never `git add -A`.
- `pkill -f` on a script name matches your own shell; kill by PID.
- No CI on pull requests; local `verify` is the gate.

## 7. Settled — do not relitigate

Everything in the previous list, plus: MOVE / TIME / SENSE are worth zero
to the scoring and par never takes them; there is no automatic army; the
strip lives under the rail; RISK is a fifth word beside PERFECT / GOOD /
BAD / MISS; the root tables drift and the drift is accepted; peak DPS is a
score on the end screen; waves survived stays the headline.

## 8. How to report

What landed, what the instruments say (with seeds), what you could not verify,
and what you would do next. **Name unverified claims as unverified**, and keep
`ASKS.md` current: every ask the author makes goes in verbatim with a status.
