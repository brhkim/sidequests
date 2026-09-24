import Phaser from 'phaser';
import { BLACK, BODY, PAD, WHITE, bake, eyes, seam, type Finish } from './draw';

/**
 * How one enemy type is drawn. Keyed by `EnemyType.id`, read by
 * `SpriteRender.renderEnemies`, which has no per-type branch of its own:
 * adding a creature is a texture here and a row in this table.
 *
 * The rule that keeps this rendering-only: **`radius` is simulation and the
 * sprite is fitted to it.** Every box is `2 * (2r + margin)` with the hit
 * circle (`R = 2r` texture px) centred; solid mass stays inside R and only
 * thin appendages cross it, by a quarter of r at most. Never grow a radius
 * to fit a drawing. The baked finish adds `PAD` on every side for the
 * outline, symmetrically, so the centre is still the circle's centre.
 */
export interface CreatureArt {
  readonly body: string;
  /** Second-hue overlay, tinted `EnemyType.accent`, one depth above. */
  readonly accent?: string;
  /** Walkers turn to face their travel; gun types stay upright. */
  readonly rotate: boolean;
  /** Drawn in the Titan pools (depth 8/9), under everything else alive. */
  readonly big?: boolean;
  /** The one authored motion, only where it encodes behaviour. */
  readonly pulse?: 'swell' | 'fuse';
  /** The accent is a gun tube that pivots at its top to track the squad. */
  readonly aims?: boolean;
}

/** The Spitter tube's pivot as a y origin: 3px into its 30px drawing, plus the pad. */
export const TUBE_PIVOT = (3 + PAD) / (30 + PAD * 2);

export const CREATURE_ART: Readonly<Record<string, CreatureArt>> = {
  grunt: { body: 'c-grunt', rotate: true },
  runner: { body: 'c-runner', rotate: true },
  brute: { body: 'c-brute', rotate: true },
  shielder: { body: 'c-shielder', accent: 'a-shielder', rotate: true },
  splitter: { body: 'c-splitter', rotate: true, pulse: 'swell' },
  bomber: { body: 'c-bomber', accent: 'a-bomber', rotate: true, pulse: 'fuse' },
  spitter: { body: 'c-spitter', accent: 'a-spitter', rotate: false, aims: true },
  lancer: { body: 'c-lancer', accent: 'a-lancer', rotate: false },
  mortar: { body: 'c-mortar', accent: 'a-mortar', rotate: false, pulse: 'fuse' },
  titan: { body: 'c-titan', accent: 'a-titan', rotate: false, big: true },
};

/** A type with no row above still draws: a plain disc, so nothing vanishes. */
export const FALLBACK_ART: CreatureArt = { body: 'c-fallback', rotate: false };

/** The creature finish at hit radius `r` (screen px): lit back, shaded belly, rim. */
function body(r: number): Finish {
  return { ...BODY, r: r * 2 };
}
/** The Shielder's plate: a pale, polished crescent with its own dark edge. */
const PLATE: Finish = { r: 28, outline: 2.5, lo: 0.72, hi: 1, rim: 0.15 };
/** Hot things - the Bomber's ember, the Mortar's loaded shell: a bright core in a halo. */
const EMBER: Finish = { flat: 1, glow: 5, glowAlpha: 0.75 };
/** The Spitter's tube: a small shaded cylinder with a dark edge. */
const TUBE: Finish = { r: 14, outline: 2, lo: 0.66, hi: 1, light: [-0.35, -0.2] };
/** The Lancer's trident: flat pale tines, outlined so they read over the body. */
const TRIDENT: Finish = { outline: 2, flat: 1 };
/** The Titan's eyes: pale, haloed in their own light - the boss looks at you. */
const EYES: Finish = { flat: 1, glow: 9, glowAlpha: 0.85 };

/**
 * Every texture faces DOWN (+y, toward the squad); rotation is applied live.
 * Each is drawn white-and-black exactly as before and then baked (`art/draw`
 * `bake`): the white body becomes a lit back (the colour exactly) falling to
 * a shaded belly, black detail stays black, a dark outline is dilated around
 * the silhouette so a body separates from the lane lines and from the body
 * behind it, and a `<key>-gloss` highlight is cut for the renderer to lay on
 * top untinted.
 */
export function makeCreatures(scene: Phaser.Scene): void {
  bake(scene, 'c-fallback', 64, 64, (g) => {
    g.fillStyle(WHITE, 1).fillCircle(32, 32, 30);
    eyes(g, 26, 38, 40, 3);
  }, body(16));

  // Grunt r=11: beetle. Oval, six legs, head lobe forward, seam. The legs
  // reach 16px (was 12) so the beetle is a beetle at 50% and not a disc; they
  // cross the hit circle by 5px of texture, under the quarter-of-r limit.
  bake(scene, 'c-grunt', 56, 56, (g) => {
    g.fillStyle(WHITE, 1);
    for (let i = 0; i < 3; i++) {
      g.fillRoundedRect(1, 11 + i * 10, 16, 6, 2);
      g.fillRoundedRect(39, 11 + i * 10, 16, 6, 2);
    }
    g.fillEllipse(28, 26, 40, 42);
    g.fillCircle(28, 44, 9);
    eyes(g, 24, 32, 46, 2.5);
    g.lineStyle(2, BLACK, 1).lineBetween(14, 26, 42, 26);
  }, body(11));

  // Runner r=9: dart. Narrow pointed body, thin legs swept back.
  bake(scene, 'c-runner', 52, 52, (g) => {
    g.lineStyle(3, WHITE, 1);
    g.lineBetween(18, 18, 6, 4); g.lineBetween(34, 18, 46, 4);
    g.lineBetween(16, 26, 8, 14); g.lineBetween(36, 26, 44, 14);
    g.fillStyle(WHITE, 1);
    g.fillEllipse(26, 20, 26, 22);
    g.fillTriangle(26, 48, 13, 18, 39, 18);
    eyes(g, 22, 30, 32, 2);
  }, { ...body(9), outline: 2.5 });

  // Brute r=19: crab. Wide flat oval, tusks forward, thick legs, plate seams.
  bake(scene, 'c-brute', 92, 92, (g) => {
    g.fillStyle(WHITE, 1);
    for (let i = 0; i < 3; i++) {
      g.fillRoundedRect(2, 26 + i * 14, 18, 8, 3);
      g.fillRoundedRect(72, 26 + i * 14, 18, 8, 3);
    }
    g.fillEllipse(46, 44, 74, 66);
    g.fillTriangle(30, 60, 22, 86, 40, 68);
    g.fillTriangle(62, 60, 70, 86, 52, 68);
    seam(g, 46, 30, 30, 0.2, 0.8, 3);
    seam(g, 46, 14, 34, 0.25, 0.75, 3);
    eyes(g, 38, 54, 62, 3.5);
  }, body(19));

  // Shielder r=14: round body; the PLATE is the accent, a crescent across the
  // front arc it armours (+-54 degrees). Both rotate with the facing.
  bake(scene, 'c-shielder', 72, 72, (g) => {
    g.fillStyle(WHITE, 1).fillEllipse(36, 34, 50, 54);
    for (let i = 0; i < 2; i++) {
      g.fillRoundedRect(6, 22 + i * 12, 10, 5, 2);
      g.fillRoundedRect(56, 22 + i * 12, 10, 5, 2);
    }
    eyes(g, 30, 42, 44, 2.5);
    seam(g, 36, 36, 24, 0.22, 0.78, 2);
  }, body(14));
  bake(scene, 'a-shielder', 72, 72, (g) => {
    g.lineStyle(8, WHITE, 1);
    g.beginPath(); g.arc(36, 36, 30, 0.2 * Math.PI, 0.8 * Math.PI); g.strokePath();
  }, PLATE);

  // Splitter r=15: three lobes with black seams. Swells; it is about to split.
  bake(scene, 'c-splitter', 76, 76, (g) => {
    g.fillStyle(WHITE, 1);
    for (let k = 0; k < 3; k++) {
      const a = Math.PI / 2 + k * (Math.PI * 2 / 3);
      g.fillCircle(38 + 11 * Math.cos(a), 38 + 11 * Math.sin(a), 17);
    }
    g.lineStyle(2, BLACK, 1);
    for (let k = 0; k < 3; k++) {
      const a = Math.PI / 2 + Math.PI / 3 + k * (Math.PI * 2 / 3);
      g.lineBetween(38, 38, 38 + 26 * Math.cos(a), 38 + 26 * Math.sin(a));
    }
    eyes(g, 34, 42, 53, 2.5);
  }, body(15));

  // Bomber r=12: egg, fat end forward, black cracks, fuse trailing up. The
  // fuse shows 13px of texture above the egg (was 7): the fuse IS the
  // silhouette. The egg sits 4px lower to make room and stays inside the
  // circle; the fuse crosses it by 6px of texture, a quarter of r. The
  // accent is the fuse's ember, pulsing.
  bake(scene, 'c-bomber', 64, 64, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillRect(30, 2, 4, 16);
    g.fillEllipse(32, 36, 40, 42);
    g.fillCircle(32, 40, 17);
    g.lineStyle(2, BLACK, 1);
    g.lineBetween(24, 22, 30, 30); g.lineBetween(30, 30, 26, 38);
    g.lineBetween(40, 26, 36, 34);
    eyes(g, 26, 38, 48, 2.5);
  }, body(12));
  bake(scene, 'a-bomber', 64, 64, (g) => {
    g.fillStyle(WHITE, 1).fillCircle(32, 7, 7);
  }, EMBER);

  // Spitter r=12: toad. Wide flat oval, mouth slot, eyes on top. Upright; the
  // accent is a gun tube that pivots at (32, 36) to track the squad.
  bake(scene, 'c-spitter', 64, 64, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillEllipse(32, 32, 48, 38);
    g.fillCircle(22, 18, 7); g.fillCircle(42, 18, 7);
    g.fillStyle(BLACK, 1).fillRoundedRect(14, 40, 36, 5, 2);
    eyes(g, 22, 42, 17, 3);
  }, body(12));
  // The tube is 30px of texture (was 24): a toad with a visible gun, rather
  // than a disc with a bump. It pivots at its top (`TUBE_PIVOT`), so the extra
  // length points at the squad and crosses the hit circle by ~3px of texture.
  bake(scene, 'a-spitter', 12, 30, (g) => {
    g.fillStyle(WHITE, 1).fillRoundedRect(2, 0, 8, 28, 3);
    g.fillStyle(BLACK, 1).fillCircle(6, 26, 2);
  }, TUBE);

  // Lancer r=13: arrowhead with fins swept back. Upright; the accent is the
  // trident it fires along (three tubes at the gun's own spread).
  bake(scene, 'c-lancer', 68, 68, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillTriangle(12, 32, 4, 8, 20, 26);
    g.fillTriangle(56, 32, 64, 8, 48, 26);
    g.beginPath();
    g.moveTo(34, 62); g.lineTo(52, 26); g.lineTo(34, 8); g.lineTo(16, 26); g.closePath();
    g.fillPath();
    g.lineStyle(2, BLACK, 1).lineBetween(34, 12, 34, 30);
    eyes(g, 28, 40, 34, 2.5);
  }, body(13));
  bake(scene, 'a-lancer', 68, 68, (g) => {
    g.lineStyle(4, WHITE, 1);
    for (const d of [-0.42, 0, 0.42]) {
      const a = Math.PI / 2 + d;
      g.lineBetween(34, 36, 34 + 24 * Math.cos(a), 36 + 24 * Math.sin(a));
    }
  }, TRIDENT);

  // Mortar r=14: a squat pot on stub feet with one wide black muzzle facing
  // down the screen. Upright; the accent is the loaded shell glowing in the
  // muzzle, tinted the shell's scarlet and pulsing like the Bomber's ember,
  // so the body that fires shells wears the shell's colour before it does.
  // Box 72 for R 28; the feet cross the circle by 4px of texture.
  bake(scene, 'c-mortar', 72, 72, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillRoundedRect(8, 50, 14, 12, 4);
    g.fillRoundedRect(50, 50, 14, 12, 4);
    g.fillRoundedRect(29, 52, 14, 12, 4);
    g.fillEllipse(36, 32, 54, 44);
    g.fillRoundedRect(20, 8, 32, 14, 6);
    g.lineStyle(2, BLACK, 1).lineBetween(14, 30, 58, 30);
    g.fillStyle(BLACK, 1).fillEllipse(36, 46, 30, 16);
    eyes(g, 28, 44, 22, 2.5);
  }, body(14));
  bake(scene, 'a-mortar', 72, 72, (g) => {
    g.fillStyle(WHITE, 1).fillEllipse(36, 46, 24, 12);
  }, EMBER);

  // Titan r=38: segmented grub. Three stacked ovals, seams, spines, a broad
  // head with mandibles and FIVE black gun ports along the front arc. The
  // accent is two pale eyes, haloed.
  bake(scene, 'c-titan', 176, 176, (g) => {
    g.fillStyle(WHITE, 1);
    for (let i = 0; i < 6; i++) {
      const y = 30 + i * 16;
      g.fillTriangle(8, y, 22, y - 6, 22, y + 6);
      g.fillTriangle(168, y, 154, y - 6, 154, y + 6);
    }
    g.fillEllipse(88, 130, 128, 60);
    g.fillTriangle(48, 150, 30, 176, 66, 156);
    g.fillTriangle(128, 150, 146, 176, 110, 156);
    g.fillEllipse(88, 88, 148, 66);
    g.fillEllipse(88, 44, 118, 54);
    // Seams: each upper segment outlined in black, which only shows where it
    // overlaps the one below (the rest of the stroke is black on background).
    g.lineStyle(4, BLACK, 1);
    g.strokeEllipse(88, 88, 148, 66);
    g.strokeEllipse(88, 44, 118, 54);
    g.fillStyle(BLACK, 1);
    for (let k = -2; k <= 2; k++) {
      const a = Math.PI / 2 + k * 0.45;
      g.fillCircle(88 + 52 * Math.cos(a), 108 + 52 * Math.sin(a), 4);
    }
  }, { ...body(38), outline: 4, light: [-0.15, -0.55] });
  bake(scene, 'a-titan', 176, 176, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillCircle(70, 136, 8); g.fillCircle(106, 136, 8);
    g.fillStyle(BLACK, 1);
    g.fillCircle(71, 138, 3.5); g.fillCircle(105, 138, 3.5);
  }, EYES);
}
