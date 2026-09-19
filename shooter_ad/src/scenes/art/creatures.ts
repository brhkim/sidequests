import Phaser from 'phaser';
import { BLACK, WHITE, eyes, seam, texture } from './draw';

/**
 * How one enemy type is drawn. Keyed by `EnemyType.id`, read by
 * `SpriteRender.renderEnemies`, which has no per-type branch of its own:
 * adding a creature is a texture here and a row in this table.
 *
 * The rule that keeps this rendering-only: **`radius` is simulation and the
 * sprite is fitted to it.** Every box is `2 * (2r + margin)` with the hit
 * circle (`R = 2r` texture px) centred; solid mass stays inside R and only
 * thin appendages cross it, by a quarter of r at most. Never grow a radius
 * to fit a drawing.
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

export const CREATURE_ART: Readonly<Record<string, CreatureArt>> = {
  grunt: { body: 'c-grunt', rotate: true },
  runner: { body: 'c-runner', rotate: true },
  brute: { body: 'c-brute', rotate: true },
  shielder: { body: 'c-shielder', accent: 'a-shielder', rotate: true },
  splitter: { body: 'c-splitter', rotate: true, pulse: 'swell' },
  bomber: { body: 'c-bomber', accent: 'a-bomber', rotate: true, pulse: 'fuse' },
  spitter: { body: 'c-spitter', accent: 'a-spitter', rotate: false, aims: true },
  lancer: { body: 'c-lancer', accent: 'a-lancer', rotate: false },
  titan: { body: 'c-titan', accent: 'a-titan', rotate: false, big: true },
};

/** A type with no row above still draws: a plain disc, so nothing vanishes. */
export const FALLBACK_ART: CreatureArt = { body: 'c-fallback', rotate: false };

/** Every texture faces DOWN (+y, toward the squad); rotation is applied live. */
export function makeCreatures(scene: Phaser.Scene): void {
  texture(scene, 'c-fallback', 64, 64, (g) => {
    g.fillStyle(WHITE, 1).fillCircle(32, 32, 30);
    eyes(g, 26, 38, 40, 3);
  });

  // Grunt r=11: beetle. Oval, six stub legs, head lobe forward, seam.
  texture(scene, 'c-grunt', 56, 56, (g) => {
    g.fillStyle(WHITE, 1);
    for (let i = 0; i < 3; i++) {
      g.fillRoundedRect(4, 12 + i * 10, 12, 5, 2);
      g.fillRoundedRect(40, 12 + i * 10, 12, 5, 2);
    }
    g.fillEllipse(28, 26, 40, 42);
    g.fillCircle(28, 44, 9);
    eyes(g, 24, 32, 46, 2.5);
    g.lineStyle(2, BLACK, 1).lineBetween(14, 26, 42, 26);
  });

  // Runner r=9: dart. Narrow pointed body, thin legs swept back.
  texture(scene, 'c-runner', 52, 52, (g) => {
    g.lineStyle(3, WHITE, 1);
    g.lineBetween(18, 18, 6, 4); g.lineBetween(34, 18, 46, 4);
    g.lineBetween(16, 26, 8, 14); g.lineBetween(36, 26, 44, 14);
    g.fillStyle(WHITE, 1);
    g.fillEllipse(26, 20, 26, 22);
    g.fillTriangle(26, 48, 13, 18, 39, 18);
    eyes(g, 22, 30, 32, 2);
  });

  // Brute r=19: crab. Wide flat oval, tusks forward, thick legs, plate seams.
  texture(scene, 'c-brute', 92, 92, (g) => {
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
  });

  // Shielder r=14: round body; the PLATE is the accent, a crescent across the
  // front arc it armours (+-54 degrees). Both rotate with the facing.
  texture(scene, 'c-shielder', 72, 72, (g) => {
    g.fillStyle(WHITE, 1).fillEllipse(36, 34, 50, 54);
    for (let i = 0; i < 2; i++) {
      g.fillRoundedRect(6, 22 + i * 12, 10, 5, 2);
      g.fillRoundedRect(56, 22 + i * 12, 10, 5, 2);
    }
    eyes(g, 30, 42, 44, 2.5);
    seam(g, 36, 36, 24, 0.22, 0.78, 2);
  });
  texture(scene, 'a-shielder', 72, 72, (g) => {
    g.lineStyle(8, WHITE, 1);
    g.beginPath(); g.arc(36, 36, 30, 0.2 * Math.PI, 0.8 * Math.PI); g.strokePath();
  });

  // Splitter r=15: three lobes with black seams. Swells; it is about to split.
  texture(scene, 'c-splitter', 76, 76, (g) => {
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
  });

  // Bomber r=12: egg, fat end forward, black cracks, fuse stub trailing up.
  // The accent is the fuse's ember, pulsing.
  texture(scene, 'c-bomber', 64, 64, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillRect(30, 4, 4, 12);
    g.fillEllipse(32, 34, 42, 46);
    g.fillCircle(32, 40, 17);
    g.lineStyle(2, BLACK, 1);
    g.lineBetween(24, 22, 30, 30); g.lineBetween(30, 30, 26, 38);
    g.lineBetween(40, 26, 36, 34);
    eyes(g, 26, 38, 48, 2.5);
  });
  texture(scene, 'a-bomber', 64, 64, (g) => {
    g.fillStyle(WHITE, 1).fillCircle(32, 6, 5);
  });

  // Spitter r=12: toad. Wide flat oval, mouth slot, eyes on top. Upright; the
  // accent is a gun tube that pivots at (32, 36) to track the squad.
  texture(scene, 'c-spitter', 64, 64, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillEllipse(32, 32, 48, 38);
    g.fillCircle(22, 18, 7); g.fillCircle(42, 18, 7);
    g.fillStyle(BLACK, 1).fillRoundedRect(18, 40, 28, 4, 2);
    eyes(g, 22, 42, 17, 3);
  });
  texture(scene, 'a-spitter', 12, 24, (g) => {
    g.fillStyle(WHITE, 1).fillRoundedRect(2, 0, 8, 22, 3);
    g.fillStyle(BLACK, 1).fillCircle(6, 20, 2);
  });

  // Lancer r=13: arrowhead with fins swept back. Upright; the accent is the
  // trident it fires along (three tubes at the gun's own spread).
  texture(scene, 'c-lancer', 68, 68, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillTriangle(12, 32, 4, 8, 20, 26);
    g.fillTriangle(56, 32, 64, 8, 48, 26);
    g.beginPath();
    g.moveTo(34, 62); g.lineTo(52, 26); g.lineTo(34, 8); g.lineTo(16, 26); g.closePath();
    g.fillPath();
    g.lineStyle(2, BLACK, 1).lineBetween(34, 12, 34, 30);
    eyes(g, 28, 40, 34, 2.5);
  });
  texture(scene, 'a-lancer', 68, 68, (g) => {
    g.lineStyle(4, WHITE, 1);
    for (const d of [-0.42, 0, 0.42]) {
      const a = Math.PI / 2 + d;
      g.lineBetween(34, 36, 34 + 24 * Math.cos(a), 36 + 24 * Math.sin(a));
    }
  });

  // Titan r=38: segmented grub. Three stacked ovals, seams, spines, a broad
  // head with mandibles and FIVE black gun ports along the front arc. The
  // accent is two pale eyes.
  texture(scene, 'c-titan', 176, 176, (g) => {
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
  });
  texture(scene, 'a-titan', 176, 176, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillCircle(70, 136, 8); g.fillCircle(106, 136, 8);
    g.fillStyle(BLACK, 1);
    g.fillCircle(71, 138, 3.5); g.fillCircle(105, 138, 3.5);
  });
}
