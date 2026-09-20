import Phaser from 'phaser';
import { BLACK, WHITE, texture } from './draw';

/**
 * A rescue cage in two layers, both 2x boxes of 72 for `CAGE.radius` 18:
 * `cage-inmates` sits behind (three heads on torsos over a floor plate,
 * skin-tinted and dimmed) and `cage` is the bars in front - frame, four bars,
 * top rail and a padlock at the bottom centre with a black keyhole. Three tan
 * bars in a square used to read as a crate; the people inside are what say
 * "shoot this open".
 */
export function makeCage(scene: Phaser.Scene): void {
  texture(scene, 'cage-inmates', 72, 72, (g) => {
    g.fillStyle(WHITE, 1);
    g.fillRoundedRect(8, 58, 56, 6, 2);
    for (const x of [20, 36, 52]) {
      g.fillRoundedRect(x - 7, 36, 14, 22, 4);
      g.fillCircle(x, 27, 7);
    }
  });
  texture(scene, 'cage', 72, 72, (g) => {
    g.lineStyle(4, WHITE, 1);
    g.strokeRect(4, 6, 64, 62);
    for (const x of [18, 30, 42, 54]) g.lineBetween(x, 6, x, 68);
    g.lineStyle(6, WHITE, 1).lineBetween(2, 8, 70, 8);
    g.fillStyle(WHITE, 1).fillRoundedRect(28, 56, 16, 14, 3);
    g.lineStyle(4, WHITE, 1);
    g.beginPath(); g.arc(36, 56, 6, Math.PI, 0); g.strokePath();
    g.fillStyle(BLACK, 1).fillCircle(36, 62, 2.5);
    g.fillRect(35, 62, 2, 5);
  });
}
