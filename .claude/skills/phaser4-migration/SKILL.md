---
name: phaser4-migration
description: "Phaser v3 to v4 breaking changes. Use when writing ANY Phaser code to check an API is not v3-only, when migrating a v3 project, or when a v4 build fails with a missing method. Covers pipelines to render nodes, FX/masks to filters, tint, camera matrices, Geom.Point removal, Math.TAU value change, Struct.Set/Map removal, removed game objects and utilities. Triggers on: phaser, migrate, v3 to v4, breaking change, setTintFill, Geom.Point, Struct.Set, Mesh, Plane, generateTexture."
---

# Phaser v3 to v4 migration

Adapted from `phaserjs/phaser` `skills/v3-to-v4-migration/` (MIT). Upstream is
authoritative: https://github.com/phaserjs/phaser/tree/master/skills

> **Read this before writing Phaser code, not only when migrating.** Model
> priors skew toward Phaser 3, so v3-only APIs get emitted confidently in
> brand-new v4 code. Everything in "Removed" below will look correct and fail.

## Unchanged from v3 (safe to write from memory)

Sprites, Images, Text, Groups, Containers, Scenes and scene management, Arcade
and Matter physics, input (keyboard/mouse/touch/gamepad), Tweens, Tilemaps
(unless using the new GPU layer), audio, and standard camera properties
(`scrollX`, `scrollY`, `zoom`, `rotation`).

## Removed - these are the traps

| v3 | v4 replacement |
| --- | --- |
| `setTintFill(c)` | `setTint(c).setTintMode(Phaser.TintModes.FILL)` |
| `tintFill` property | `tintMode` property |
| `Geom.Point` (and all `Point.*` helpers) | `Phaser.Math.Vector2` |
| `Math.PI2` | `Math.TAU` |
| `Math.TAU` **= PI/2** | `Math.PI_OVER_2` (v4 `Math.TAU` is now PI*2) |
| `Phaser.Struct.Set` | native `Set` |
| `Phaser.Struct.Map` | native `Map` |
| `BitmapMask` | `sprite.filters.internal.addMask(obj)` |
| `sprite.setPipeline('Light2D')` | `sprite.setLighting(true)` |
| FX `Bloom` / `Shine` / `Circle` | `Phaser.Actions.AddEffectBloom()` / `AddEffectShine()` / `AddMaskShape()` |
| FX `Gradient` | `Gradient` game object |
| `colorMatrix.sepia()` | `colorMatrix.colorMatrix.sepia()` |
| `Mesh`, `Plane` game objects | removed, no replacement (3D planned later) |
| `Create.GenerateTexture`, Create palettes | removed |
| **`TextureManager.generate`** | **removed** - use `Graphics#generateTexture(key, w, h)` |
| `Math.SinCosTableGenerator` | removed |
| Camera3D / Layer3D plugins, `phaser-ie9.js` | removed |
| Bundled Spine 3/4 plugins | official Esoteric Software Phaser Spine plugin |
| All legacy polyfills (`Array.forEach`, `Math.trunc`, `requestAnimationFrame`, ...) | native |

`Math.TAU` is the nastiest of these: it silently changed value rather than
disappearing, so v3 code using it still runs and is wrong by a factor of four.
Prefer writing `Math.PI * 2` explicitly.

## Renderer: pipelines became render nodes

The entire v3 WebGL pipeline system is gone, replaced by a `RenderNode`
architecture where each node handles one task. Standard API usage is
transparent. Custom pipelines must be rewritten as render nodes and registered
via `RenderConfig#renderNodes`. Do not make raw `gl` calls - they desync the
internal `WebGLGlobalWrapper`; use an `Extern` game object if you must.

Internals that moved: `WebGLRenderer.textureIndexes` -> `glTextureUnits.unitIndices`;
`genericVertexBuffer` / `genericVertexData` removed; `WebGLAttribLocationWrapper` removed.

Canvas renderer is deprecated. Almost every v4 feature (filters, real-time
lighting, `SpriteGPULayer`, `TilemapGPULayer`) is WebGL-only.

## FX and Masks unified into Filters

No more preFX/postFX split and no object restrictions - filters apply to any
game object or scene camera. Filters are **internal** (the object alone) or
**external** (the object in its rendering context).

## Camera matrices

Only matters if you touch matrices directly. `Camera#matrix` is now rotation +
zoom + scroll (no position); `Camera#matrixExternal` is position only;
`Camera#matrixCombined` is the product. Manual scroll-factor math becomes
`TransformMatrix.copyWithScrollFactorFrom(...)`.

## Texture orientation

v4 uses GL orientation throughout (Y=0 at bottom). PNG/JPG handled
automatically. **Compressed textures must be re-compressed flipped.** Custom
shaders must assume Y=0 at bottom.

## DynamicTexture / RenderTexture

Draw commands are now buffered - you **must call `render()`** to execute them.
New: `preserve()`, `callback()`, `capture`, and `RenderTexture.renderMode`
(`"render"` | `"redraw"` | `"all"`).

## Shader and GLSL

`Shader` takes a `ShaderQuadConfig` object, not positional args. Shadertoy-style
uniforms are no longer automatic. New `setUniform(name, value)` and
`renderImmediate()`. GLSL is no longer classified fragment/vertex at load;
custom templates became `#pragma` directives.

## Smaller changes

- `roundPixels` now defaults to `false`; per-object `vertexRoundMode`
  (`off` | `safe` | `safeAuto` | `full` | `fullAuto`) replaces the old blanket behavior.
- `TileSprite` lost texture cropping, gained atlas frames and `tileRotation`.
- `Grid` renamed `outline` properties to `stroke`. `Rectangle` supports rounded corners.
- `Graphics` gained `pathDetailThreshold`.
- `Shader#setTextures()` replaces rather than appends.
- `DOMElement` throws without a container.
- All `Geom.*` helpers (`getPoint`, `getPoints`, `getRandomPoint`, `Random`,
  `CircumferencePoint`) return `Vector2`, not `Point`.

## Checklist

- [ ] `npm install phaser@4`
- [ ] Custom WebGL pipelines -> render nodes
- [ ] `BitmapMask` -> `Mask` filter; removed FX -> Actions/GameObjects
- [ ] `ColorMatrix` methods moved to `.colorMatrix`
- [ ] `setTintFill()` -> `setTint().setTintMode(FILL)`
- [ ] `Geom.Point` -> `Vector2`
- [ ] `Math.TAU` re-checked; `Math.PI2` -> `Math.TAU`
- [ ] `Struct.Set` / `Struct.Map` -> native
- [ ] `render()` added to DynamicTexture/RenderTexture use
- [ ] Compressed textures re-flipped
- [ ] `Shader` -> `ShaderQuadConfig`; GLSL `#pragma`
- [ ] `setPipeline('Light2D')` -> `setLighting(true)`
- [ ] `Mesh` / `Plane` usage removed
- [ ] `TextureManager.generate` / `Create.GenerateTexture` usage removed
- [ ] `roundPixels` behavior re-tested
