# shooter_ad

A squad shooter in the mobile-ad style: you slide a formation left and right
along a lane at the bottom while a mob descends, your squad auto-fires upward,
and you drive through powerup gates to grow.

## Commands

```bash
npm ci          # first time in a fresh session
npm run dev     # vite dev server, hot reload
npm run build   # typecheck + production build to dist/
npm run verify  # REQUIRED before claiming a change works (see below)
```

`npm run balance` plays the built game for two minutes and prints a time series
of power, par, standing, DPS and the enemy HP multiplier. Use it before and
after any balance change - the death-spiral bug in the first difficulty model
was invisible in a screenshot and obvious in the series. `PROBE_SECONDS=240`
runs it longer.

`npm run verify` builds nothing - run `npm run build` first. It serves `dist/`,
plays the game headlessly for 24 seconds with simulated pointer input, and
fails on any console error, a blank frame, zero kills, a wave that never
advanced, or a ring that exceeded the cap. Override the duration with
`VERIFY_SECONDS=90 npm run verify` to reach boss waves. The screenshot lands in
`.verify/screenshot.png` - look at it, don't just trust the exit code.

**A passing typecheck is not verification.** This project exists partly to prove
that loop, so never report a gameplay change as working without `verify` output.

## Architecture

```
src/
  config.ts            every tunable number - balance lives here, not in logic
  data/                content tables: tiers, enemies, gates
  systems/             simulation, no Phaser rendering except SpritePool
  scenes/              Boot (textures), Game (sim + render), UI (HUD)
```

Simulation and rendering are deliberately separate: `systems/` holds plain
classes with no display objects, and `GameScene.render()` syncs pooled sprites
to that state once per frame. Gameplay is therefore testable and readable
without touching Phaser.

**Collision is bespoke, not Arcade or Matter.** Every interaction here is
circle-vs-circle with no gravity, stacking, or resting contact, which is the
case where a physics library costs more than it gives. Two guards matter and
are already in place: `delta` is clamped to 1/30s in `GameScene.update` so fast
bullets cannot tunnel through enemies on a slow frame, and bullet-vs-enemy goes
through the uniform `Grid` broad-phase rather than a nested loop.

## The ring cap - the central design decision

The genre's classic failure is that a large army becomes an unmanageable blob
and positioning stops working. This game never grows the formation past
**three hex rings (1 + 6 + 12 = 19 units)**, set by `SQUAD.ringCap`.

`Squad.power` is the single source of truth for both size and strength:

- visible units = `min(power, ringCap)`
- power beyond the cap is dealt out evenly across those units as power-per-unit
- power-per-unit maps to a **shirt colour** via `data/tiers.ts`:
  grey -> green -> blue -> purple -> orange -> red, borrowed from MMO item rarity
- the remainder goes to the innermost units first, so the leader visibly ranks
  up before the outer ring catches up - which is why a mid-run squad shows two
  shirt colours at once

Thresholds are power-per-unit, so with a 19-strong ring the army totals for each
colour are 19 / 38 / 76 / 152 / 304 / 608. Halving a threshold roughly halves
the time to that shirt.

## Difficulty is closed-loop

Enemy strength is NOT keyed to the wave number. `systems/Difficulty.ts` tracks a
shadow "par" player who takes the best gate offered every time - scored by
resulting DPS, not raw power, so a flat `+30` does not automatically beat
`DMG+` - and collects every wave, streak and cage bonus. Enemy HP is then
derived so that arriving hit points consume a set share of what a
target-strength player could destroy:

```
budget/sec = squadDps(par) * targetFraction * pressure
hpMult     = budget/sec / (spawnRate * avgPoolHp)
```

Spawn rate keeps its own hand-authored curve, so pacing stays authored while
difficulty stays automatic.

Two properties matter and are easy to break:

- **`Progression.ts` is the single definition of squad strength.** The squad
  fires from it and the difficulty model budgets against it. Two copies would
  drift and the curve would silently stop matching the game.
- **`DIFFICULTY.maxOverPlayer` is a mercy clamp, not a nicety.** Par grows on
  perfect play whether or not the player kept up, so without it one missed
  multiplier gate ratchets difficulty out of reach and the run spirals: fewer
  kills, more breaches, less power, harder enemies. Removing the clamp
  reproduces a reliable death spiral around wave 7.

To make the game harder, raise `targetFraction` toward 1. To make wins feel
bigger, lower it.

## Extending content

All three of these are data edits, by design - if you find yourself editing a
`switch`, the change is going in the wrong place.

- **Enemy**: append to `ENEMIES` in `data/enemies.ts`. Only a genuinely new
  movement pattern needs a case in `Enemies.applyBehaviour`. Existing
  behaviours: straight, zigzag, charger, splitter, bomber, shielder, healer,
  boss. `weight: 0` keeps a type out of the random roll (bosses use this).
- **Powerup**: append to `GATE_TYPES` in `data/gates.ts` plus one case in
  `Squad.applyGate`. `rollGatePair` guarantees a pair is never two traps, so
  there is always a worthwhile option.
- **Army growth**: five routes exist - add/multiply gates, rescue cages you
  shoot open, kill streaks (`STREAK`), wave-clear bonuses (`WAVE.clearBonus`),
  and surviving longer. Add a sixth by calling `squad.addPower()`.

## Art

Entirely procedural, generated in `BootScene` with `Graphics#generateTexture`.
Everything is drawn white and tinted at runtime, so one texture serves every
colour. There are no asset files and nothing to load at runtime, which is what
keeps the build a static folder.

Note `TextureManager.generate` and the Create palettes were **removed in Phaser
v4** - see `.claude/skills/phaser4-migration/`.
