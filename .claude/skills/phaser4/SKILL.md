---
name: phaser4
description: "Conventions for building 2D browser games with Phaser 4 in this repo - project layout, Vite setup, scene structure, procedural art without TextureManager.generate, bespoke-vs-library collision, and the verify-before-you-claim-it-works loop. Use when creating or editing any game under a sidequest folder."
---

# Phaser 4 conventions

Pin **`phaser@^4.2.1`** exactly. Check any unfamiliar API against
`.claude/skills/phaser4-migration/` before writing it - v3 answers look right
and fail at runtime.

## Project shape

Every game is a standalone Vite + TypeScript project:

```
<game>/
  index.html
  package.json         # phaser pinned; "description" feeds the session index
  tsconfig.json
  vite.config.ts       # base: './'  <- required for GitHub Pages subpaths
  CLAUDE.md            # commands + this game's design decisions
  src/
    main.ts            # Phaser.Game config only
    config.ts          # ALL tunable numbers, one place
    scenes/
    systems/
    data/              # content tables (enemies, powerups, tiers)
```

**Keep files small and split early.** Agents add features well and restructure
large files badly; a 1,500-line `GameScene.ts` is the failure mode. When a
system exceeds ~250 lines, split it before adding to it.

**Put every tunable number in `config.ts`.** Balance changes should never
require reading gameplay code, and it makes "make enemies tougher" a one-file
edit.

**Content lives in `data/` tables, not in `if` chains.** Adding an enemy type or
a powerup should mean appending one object to an array. If it means editing a
switch statement, the design is wrong.

## Art without an artist

`TextureManager.generate` and the Create palettes are **removed in v4**.
Generate procedural textures with a `Graphics` object instead:

```ts
const g = this.add.graphics();
g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
g.generateTexture('dot', 16, 16);
g.destroy();
```

Draw in white and tint at runtime - one texture serves every colour variant.
For shapes that never change, the `Arc` / `Rectangle` / `Triangle` shape game
objects are fine and need no texture at all.

## Physics: prefer bespoke for simple geometry

Do not reach for Arcade or Matter reflexively. For circle-vs-circle overlap with
no gravity, stacking, or resting contact, a hand-written check plus a uniform
spatial grid is simpler, faster, and has no version-drift risk.

Take Arcade when you need tilemap collision or platformer separation. Take
Matter when the physics *is* the game (stacking, joints, ragdolls). Both are
unchanged from v3, so model recall is reliable for them.

Bespoke collision has known failure modes - guard them explicitly:
- **Tunnelling**: clamp per-frame movement to less than the smaller radius, or sweep.
- **Frame spikes**: clamp `delta` before integrating.
- **O(n^2)**: bucket into a grid once per frame; never nest two entity loops.

## Scenes

`BootScene` builds textures and hands off. `GameScene` owns simulation.
`UIScene` runs in parallel (`scene.launch`) for HUD so the HUD never scrolls or
scales with the camera. Communicate between them through the scene events
emitter, not by reaching across scene instances.

## Verify before claiming it works

Code that type-checks perfectly still ships a black screen. A change is not done
until `npm run verify` passes - build plus a headless load that fails on any
console error or page error. The `playtester` agent runs the same loop and
captures a screenshot when you need to see the result.

Never report a game as working on the strength of `tsc` alone.
