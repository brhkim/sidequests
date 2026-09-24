import Phaser from 'phaser';
import { BLACK, WHITE, bake, canvasTexture, texture } from './draw';

/**
 * Two streams that must never be confused:
 *
 * - **Squad bullets** are glowing streaks pointing up: a soft capsule whose
 *   bright head leads and whose tail fades inside a faint halo, drawn
 *   ADDITIVE and tinted by the density ladder (`bulletTint`). Every pixel is
 *   white under the multiply tint, so the whole streak IS the ladder colour
 *   and a heavier bullet reads as its tier. No outline - nothing the squad
 *   fires has one.
 * - **Enemy bullets** are the opposite on every axis that reads at a glance:
 *   a black-outlined dart with a hot core, in a hue no body wears, rotated
 *   along its velocity, drawn at NORMAL blend inside a baked halo of its own
 *   colour - so it stays distinct over the additive stream and is never
 *   mistaken for a small Runner (which has legs, eyes and no glow). The hit
 *   radius (`ENEMY_FIRE.radius`) is untouched; the dart is still 8x16 on
 *   screen around a 5px circle, the halo is extra.
 */
export function makeProjectiles(scene: Phaser.Scene): void {
  // The old flat pill, kept for anything outside the field that draws one.
  texture(scene, 'bullet', 6, 14, (g) => {
    g.fillStyle(WHITE, 1).fillRoundedRect(0, 0, 6, 14, 3);
  });

  // The streak, at 2x: 24x52 of texture, 12x26 on screen. Head up at y ~6.
  canvasTexture(scene, 'bullet-streak', 24, 52, (ctx, w, h) => {
    const cx = w / 2;
    // Halo, soft, longest behind the head.
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      ctx.fillStyle = `rgba(255,255,255,${0.06 * (1 - t) + 0.025})`;
      const rw = 4 + t * 7, top = 3 + t * 3;
      roundRect(ctx, cx - rw, top, rw * 2, h - top - 4 - t * 12, rw);
    }
    // Core capsule, solid at the head, fading toward the tail.
    const core = ctx.createLinearGradient(0, 5, 0, h - 5);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(0.4, 'rgba(255,255,255,0.9)');
    core.addColorStop(1, 'rgba(255,255,255,0.08)');
    ctx.fillStyle = core;
    roundRect(ctx, cx - 4.5, 5, 9, h - 12, 4.5);
  });

  // Nose DOWN at (8, 30), rounded tail up: a grey shell (the hue in shade)
  // around a white core (the hue exactly), a black outline, then a halo of
  // the dart's own colour.
  bake(scene, 'ebullet', 16, 32, (g) => {
    g.lineStyle(3, BLACK, 1);
    g.fillStyle(0xa8a8a8, 1);
    g.beginPath();
    g.moveTo(8, 30); g.lineTo(1, 12);
    g.arc(8, 10, 7, Math.PI, 0);
    g.lineTo(15, 12); g.closePath();
    g.fillPath(); g.strokePath();
    g.fillStyle(WHITE, 1).fillEllipse(8, 14, 5, 14);
  }, { flat: 1, glow: 5, glowAlpha: 0.7, pad: 10 });

  // The Mortar's shell: a fat black-outlined round with a bright core, in
  // `COLORS.enemyShell`. Box 40 for the 9px hit circle (R 18 of texture);
  // the outline sits on the circle and the halo is outside it. It is drawn
  // as a disc rather than a dart so nothing about it says "fast", and it is
  // twice a dart's size on screen so it is read as the one to step out of.
  bake(scene, 'eshell', 40, 40, (g) => {
    g.lineStyle(3, BLACK, 1);
    g.fillStyle(0x9c9c9c, 1);
    g.fillCircle(20, 20, 17);
    g.strokeCircle(20, 20, 17);
    g.fillStyle(WHITE, 1).fillCircle(17, 17, 9);
  }, { flat: 1, glow: 7, glowAlpha: 0.7, pad: 12 });

  // Death pop shard: a small outlined triangle, tinted the body's colour.
  bake(scene, 'shard', 16, 16, (g) => {
    g.fillStyle(WHITE, 1).fillTriangle(8, 1, 15, 15, 1, 15);
  }, { r: 7, outline: 2, lo: 0.62, hi: 1, pad: 3 });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, Math.max(h, r * 2), r);
  ctx.fill();
}
