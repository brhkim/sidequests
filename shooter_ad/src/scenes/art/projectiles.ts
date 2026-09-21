import Phaser from 'phaser';
import { BLACK, WHITE, texture } from './draw';

/**
 * Squad bullets stay what they were: a cream pill on the tier ladder, no
 * outline, pointing up. Enemy bullets are the opposite in every axis that
 * can be read at a glance - a black-outlined dart with a bright core, in a
 * hue no body wears, rotated along its velocity - so one is never mistaken
 * for a small Runner. The hit radius (`ENEMY_FIRE.radius`) is untouched; the
 * dart is 8x16 on screen around a 5px circle.
 */
export function makeProjectiles(scene: Phaser.Scene): void {
  texture(scene, 'bullet', 6, 14, (g) => {
    g.fillStyle(WHITE, 1).fillRoundedRect(0, 0, 6, 14, 3);
  });

  // Nose DOWN at (8, 30), rounded tail up. The shell is translucent so the
  // tint reads darker there than on the solid core, which is the only place
  // a second shade comes from without a second texture.
  texture(scene, 'ebullet', 16, 32, (g) => {
    g.lineStyle(3, BLACK, 1);
    g.fillStyle(WHITE, 0.72);
    g.beginPath();
    g.moveTo(8, 30); g.lineTo(1, 12);
    g.arc(8, 10, 7, Math.PI, 0);
    g.lineTo(15, 12); g.closePath();
    g.fillPath(); g.strokePath();
    g.fillStyle(WHITE, 1).fillEllipse(8, 14, 5, 14);
  });

  // The Mortar's shell: a fat black-outlined round with a bright core, in
  // `COLORS.enemyShell`. Box 40 for the 9px hit circle (R 18 of texture);
  // the outline sits on the circle. It is drawn as a disc rather than a
  // dart so nothing about it says "fast", and it is twice a dart's size on
  // screen so it is read as the one to step out of.
  texture(scene, 'eshell', 40, 40, (g) => {
    g.lineStyle(3, BLACK, 1);
    g.fillStyle(WHITE, 0.72);
    g.fillCircle(20, 20, 17);
    g.strokeCircle(20, 20, 17);
    g.fillStyle(WHITE, 1).fillCircle(17, 17, 8);
  });

  // Death pop shard: a small triangle, tinted the body's colour.
  texture(scene, 'shard', 16, 16, (g) => {
    g.fillStyle(WHITE, 1).fillTriangle(8, 1, 15, 15, 1, 15);
  });
}
