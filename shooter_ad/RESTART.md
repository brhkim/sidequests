# Restart prompt — shooter_ad

Paste everything below the line into a fresh session.

---

You are picking up `shooter_ad`, a browser game in the `brhkim/sidequests` repo,
on branch `claude/laughing-feynman-ghh9r3` (no PR open; `main` is at the
previous session's merge). The version tag went 0.4 to 0.5: every seed is a
different match now. The last session landed nine commits on top of the
author's eleven; §3 lists them. Nothing is blocked. §4 is what the author still
has to decide, §5 what nobody has verified.

## 1. Orient before touching anything

Read in this order:

1. `CLAUDE.md` at the repo root — repo conventions, the shared-tree rules for
   subagents, and the measuring-before-tuning rules.
2. `shooter_ad/ASKS.md` — **the author's asks, verbatim, with a status per
   ask.** This is the checklist the session is judged against. Read it first.
3. `shooter_ad/PRODUCT.md` — product truth and the decisions the author made
   this round (art world, contact rule, tiers, headline number).
4. `shooter_ad/notes.md` — design intent; wins over `CLAUDE.md`. New this
   session: "Enemies have a hurt box", "Dead space between gates", "When the
   decimals appear today", "Sound", the rewritten "Instant feedback".
5. `shooter_ad/CLAUDE.md` — mechanics. New: "Simulation events", "Contact
   damage", "Dead space is the fourth judgment lever", the Art section (the
   creatures, the depth table, `npm run roster`), "Audio", "HUD and feedback,
   as built", "Finish review".
6. `shooter_ad/DESIGN.md` — the design system as shipped (written by the
   impeccable documenter from the build). Read before any UI edit, with
   `.claude/skills/impeccable/reference/craft-floor.md`.
7. `git log --oneline -12` — the commit messages carry the reasoning and the
   measurements.

Then:

```bash
cd shooter_ad && npm ci && npm run build && npm run verify && npm run model
npm run roster     # the whole enemy roster, a hit frame, a late stream: LOOK at these
npm run moments    # every feedback moment mid-animation, plus a wave-16 offer with dead space
npm run endscreen  # start / pause / end screens
npm run audio      # writes .verify/audio/*.wav - LISTEN to palette.wav
```

Do not start until you have looked at `.verify/roster.png`,
`.verify/moment-deadspace.png` and `.verify/sense-mark.png`.

## 2. What the game is

**DPS golf.** Every 7.5 seconds three bonuses descend and you must judge, before
they arrive, which most increases your damage output. A stat is
`base × (1 + pool) × mult`; raw draws scale to the pool so neither form is
ever dominant. Difficulty is closed-loop against a shadow "par" player. Four
judgment levers rise with the wave: descent speed, root granularity, raw
rounding, and now dead space between the gates.

## 3. What landed this session, commit by commit

1. **Contact damage, tiered cost, Healer removed** (`4f0cd4b`). An enemy
   touching the army is consumed and charges it; a breach beside the army
   charges the same, through one function (`Contact.contactCost`): Basic 2%
   floor 1, Medium 4% floor 2, Large 6% floor 3, Titan 100%. `damage` on the
   roster became `tier`; `SQUAD.breachLoss` is gone. The simulation publishes
   a typed event stream (`SimEvents`) that the scene drains once per render
   and re-emits as `moment`; sprites, HUD feedback and audio all read it.
   Measured: balance seeds 1-5 unchanged in survival (the bot never leaves
   the floor regime), repeat 0.00%, titan delivery 1.00 before and after,
   `from --dps=1e5` survival 100.7/36.7/52.9 → 62.4/55.9/52.0s with
   contact/min 14/5/22.
2. **GameScene split into render layers** (`e582bdd`): `SpriteRender` and
   `FieldRender`; neutral identical 5/5.
3. **Creatures** (`9c28371`): a silhouette per type, white-with-black-detail
   at 2x, walkers rotate to travel, magenta outlined darts for enemy fire,
   outlined squad, hit flash and bleach, shards. `npm run roster`. Neutral
   identical 5/5.
4. **Field and feedback** (`572e2a1`): ground band, breach horizon and ticks,
   gate roofs and labels above the stream, brackets on the targeted card,
   PERFECT / GOOD / BAD washes and MISS, edge flashes sized by share of army
   lost, boss bar, wave banner, death beat, the three screens re-laid, a
   REPLAY button, the SOUND line. `npm run moments`. Neutral identical 5/5.
5. **Audio** (`5af92d7`, `d513c39`): procedural WebAudio, 21 cues, kills
   bundled at most ten voices a second and pitched down a semitone per
   doubling, mute on the pause screen and the M key, `npm run audio` writes
   WAVs. Neutral identical 5/5.
6. **Dead space and taller cards, v0.5** (`f1619c2`): from wave 5 gates
   narrow 6px a wave to 108px in a 180px lane by wave 16, on the judgment
   wave; cards 88px with a two-line label; `npm run model` prints the whole
   curve per wave. Balance moved through the taller card (median 44.1 →
   42.9s); dead space itself is unexercised by the bot.
7. **Finish review fixes** (`0d7b2c3`): opaque rail, OVERRUN as a heading,
   bolder SENSE mark, longer appendages on the roundest creatures, Lancer to
   indigo, readable pause notes, dividers instead of stripes, boss bar under
   the standing bar, one type scale. Neutral identical 5/5.

## 4. What the author still has to decide

- **The root-table schedule.** The author proposed: waves 1-5 `1.1, 1.25,
  1.5`; 6-10 `1.1, 1.2, 1.3, 1.4, 1.5`; 11-15 every .05; 16-20 every .01.
  Tenths cannot be mean-neutral inside the fixed [1.05, 1.5] range (+2% per
  draw in waves 6-10, +0.65% in 1-5). Options laid out in ASKS.md §5a.
  `npm run model` fails if the means drift past 0.5%; widening that check per
  tier is the code change if the author accepts the drift.
- **Analytics.** Options and costs in ASKS.md §6. Nothing built.
- **Play it.** Every strand was verified by instruments and stills. Nobody has
  played it, watched the motion, or listened to the sounds. The questions
  only play can answer: does contact damage feel fair at 2-6%; does ±54px at
  wave 16 feel like precision or a geometry accident; do cages feel like
  walls (`CAGE.hpTitanFraction`); is 1% per bullet right for a player who
  dodges; is the Bomber at floor 3 still the Bomber.

## 5. Known gaps — name these as unverified if you report on them

- **Nothing here has been played by a human.** All balance is the probe bot,
  which does not dodge, does not aim at cages, steers to a card's exact x
  (so never stands in dead space), and dies by wave 6.
- **The contact share regime (above 75 power) is unmeasured** by every
  instrument.
- **Motion is unverified**: Splitter swell, Bomber ember, Spitter gun
  tracking, bullet trail, shard arcs, the tweened feedback, the boss warning
  pulse. Stills only.
- **Audio is unheard.** The palette is judged by peak/RMS/dominant-Hz tables.
  The Titan heartbeat ramps on time since arrival, not real descent.
- **`landedAt`** (where a Titan landed on the squad) is wired and never
  observed; no instrumented run produced a landing.
- **Breach ticks** on the horizon appear in no still.
- **A MISS count** is not on the end screen (`DecisionLog.tally` has no miss
  field; misses sit in BAD and the decisions count).
- **Nothing is verified at phone DPI**; 540×960 stills only.
- The worktree harness cut agent worktrees from `main`, not the branch; each
  agent copied the base tree in by hand. If you use `isolation: "worktree"`
  again, check the base commit first.

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
- No CI on pull requests; local `verify` is the gate.

## 7. Settled — do not relitigate

Everything in the previous list, plus: enemies are consumed on contact, no
kill credit; breach and contact are one price; tiers are by body size with
Large floor 3; the Healer is gone; waves survived is the end screen's
headline; the pick words are PERFECT / GOOD / BAD / MISS; the event stream is
the only channel from simulation to feedback; the rank palette and axis
colours are vocabulary.

## 8. How to report

What landed, what the instruments say (with seeds), what you could not verify,
and what you would do next. **Name unverified claims as unverified**, and keep
`ASKS.md` current: every ask the author makes goes in verbatim with a status.
