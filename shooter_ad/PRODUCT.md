# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One author-player, and the friends they hand a match code to. Played in a
browser, portrait, most often on a phone held in one hand with a thumb on the
lane; also at a desk with a mouse. The player is mid-run, under time
pressure, and is doing mental arithmetic while dodging: every second of
attention the interface takes is a second stolen from the decision the game
exists to ask.

## Product Purpose

`shooter_ad` is **DPS golf**: a squad shooter in the mobile-ad style whose
whole content is judgment under time pressure. Every few seconds three
bonuses descend and the player must decide, before they arrive, which most
increases damage output. Success is a player who is right about 70% of the
time and *knows* when they guessed, who can read the board mid-wave, and who
wants to replay the same match code to beat their own decision score.

## Positioning

The offers are priced by one shared scoring function, so the game can tell a
player exactly which pick was best and grade the run against a shadow "par"
player, in real time and on the death screen. Difficulty is closed-loop
against par rather than the wave number. A match code reproduces a run
exactly, so two people can compare decisions on one match. No neighbouring
squad-shooter can truthfully claim any of the three.

## Operating Context

- Vite + TypeScript + **Phaser 4** (`phaser@^4.2.1`). See
  `.claude/skills/phaser4/` and `.claude/skills/phaser4-migration/` at the
  repo root; model priors skew to Phaser 3 and are wrong here.
- 540×960 logical canvas under `Scale.FIT`. Nothing is verified at true phone
  DPI; stills are 540×960 PNGs.
- Everything ships as a static folder deployed to GitHub Pages. **No asset
  files**: every texture is generated procedurally in `BootScene`, drawn
  white and tinted at runtime. Audio must follow the same rule.
- The simulation runs on a fixed 1/60s step and every consumer of randomness
  goes through the seeded generator. Rendering and audio may read the
  simulated clock; they may never read the RNG or feed the simulation.
- Verification is headless (`npm run verify`, `hud`, `endscreen`, `model`,
  `balance`, `repeat`, `neutral`, `behaviour`, `titan`, `from`). A typecheck
  is not verification; the screenshot is looked at.
- `notes.md` is design intent; `CLAUDE.md` is mechanics. `notes.md` wins.

## Capabilities and Constraints

Confirmed for the current round of work (author's answers, 2026-09-19):

- **Art world: creatures vs soldiers.** The squad stays human (skin-tone
  head, rank-coloured shirt). Enemies become organic creatures, each type a
  distinct silhouette so the type reads before the colour does.
- **Enemies are destroyed on contact with the army** and charge the army
  once; Titan contact ends the run exactly as a Titan breach does. A breach
  charges the same amount as contact.
- **Contact/breach damage scales with army size by tier**, floored in raw
  power: Basic 2% (floor 1), Medium 4% (floor 2), Large 6% (floor 3),
  Titan 100%. Tiers by body size: Basic = Grunt, Runner; Medium = Shielder,
  Spitter, Splitter, Lancer; Large = Brute, Bomber.
- **The Healer (Medic) is removed** from the roster.
- **Enemy bullets must read as bullets**, never as small enemies.
- **Audio is minimal and procedural**: quiet stacking enemy-death sounds,
  distinct sounds for gate pickup, rescue, wave clear, damage taken, Titan
  events. No music for now.
- **MOVE, TIME and SENSE are RISK axes** (2026-09-20): worth zero to the
  scoring, never taken by par, told RISK rather than graded when the player
  takes one. The shadow player only ever needs DPS.
- **No automatic army** (2026-09-20): no wave-clear or streak army, on either
  side. Every unit held was chosen at a gate or shot out of a cage. Cages roll
  at 40% per wave duration.
- **The bonus strip sits under the rail, not under the line** (2026-09-20):
  on a phone the thumb covered it. Peak DPS is on the end screen. Text sizes
  under 18px went up for the phone.
- **The root schedule is the author's round one and drifts up to ~2% per
  draw** in the tenths tier; accepted, measured, capped in `npm run model`.
- **Visual clarity is non-negotiable.** Any aesthetic change that makes an
  enemy, bullet, cage or gate harder to tell apart at a glance is a
  regression, whatever it looks like in a still.
- Settled and not to be relitigated: the ring cap of three hex rings, the
  bullet-density tint ladder shared with the shirt ladder, colour naming the
  bonus axis and never the form, the 83px firing column, par not collecting
  cages, match codes over raw seeds.

## Brand Commitments

- Working title on the start screen: **DPS GOLF**. The pitch copy on that
  screen is the author's, near verbatim, and is not to be rewritten without
  asking.
- Vocabulary: ARMY, DMG, RATE, GUNS, PIERCE, MOVE, TIME, SENSE, PAR, WAVE,
  Titan, rescue cage, match code, standing.
- Dark playfield. The rank palette in `src/data/tiers.ts` and the axis
  colours in `src/data/gates.ts` are load-bearing game vocabulary, not
  decoration, and must survive any restyle.
- The end screen's headline number is waves survived, with the decision
  score beneath it (notes.md).

## Evidence on Hand

- `shooter_ad/notes.md` (design intent), `shooter_ad/CLAUDE.md` (mechanics),
  `shooter_ad/RESTART.md` (last session's handoff and measurements).
- Stills from the instruments in `shooter_ad/.verify/` (gitignored):
  `screenshot.png`, `hud-*.png`, `start-*.png`, `pause-*.png`, `end-*.png`,
  `sense-mark.png`.
- No human has played the build since the last eleven changes; every balance
  figure is from a bot that does not dodge and does not aim at cages.

## Product Principles

- **The decision is the game.** Anything on screen that is not the offer, the
  threat, or the number needed to convert the offer is competing with the
  game for attention.
- **Legibility over spectacle.** More of a thing past the point it carries
  information is collapsed, not drawn: rings, bullets, and now sound.
- **One truth, many readers.** Scoring, par, the halo, the death screen and
  the SENSE mark read one function. Visual and audio feedback must say what
  the simulation did, never what it might have done.
- **Instrument before tuning.** A number-justified change needs a script that
  reproduces the number, and a rendering-only change is proven neutral with
  `npm run neutral`.
- **Report unverified as unverified.** Stills are not motion; a bot is not a
  player.
