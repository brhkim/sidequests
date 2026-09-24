import Phaser from 'phaser';
import { BLACK, WHITE, bake } from './draw';

/**
 * A rescue cage in two layers, both 2x boxes of 72 for `CAGE.radius` 18:
 * `cage-inmates` sits behind (a dark interior, three heads on torsos over a
 * floor plate, skin-tinted) and `cage` is the bars in front - frame, four
 * bars, top rail and a padlock at the bottom centre with a black keyhole.
 * Three tan bars in a square used to read as a crate; the people inside are
 * what say "shoot this open".
 *
 * Both are baked (`art/draw` `bake`): the bars are lit round stock with a
 * dark edge (so they read over a lane line), the inmates sit in the cage's
 * own shadow, a step darker than the skin tone, behind a translucent black
 * interior that gives the cage a volume on the road instead of a wireframe.
 */
export function makeCage(scene: Phaser.Scene): void {
  bake(scene, 'cage-inmates', 72, 72, (g) => {
    g.fillStyle(BLACK, 0.55).fillRect(6, 8, 60, 58);
    g.fillStyle(WHITE, 1);
    g.fillRoundedRect(8, 58, 56, 6, 2);
    for (const x of [20, 36, 52]) {
      g.fillRoundedRect(x - 7, 36, 14, 22, 4);
      g.fillCircle(x, 27, 7);
    }
  }, { r: 30, lo: 0.5, hi: 0.8, light: [-0.1, -0.4], pad: 4 });
  bake(scene, 'cage', 72, 72, (g) => {
    g.lineStyle(4, WHITE, 1);
    g.strokeRect(4, 6, 64, 62);
    for (const x of [18, 30, 42, 54]) g.lineBetween(x, 6, x, 68);
    g.lineStyle(6, WHITE, 1).lineBetween(2, 8, 70, 8);
    g.fillStyle(WHITE, 1).fillRoundedRect(28, 56, 16, 14, 3);
    g.lineStyle(4, WHITE, 1);
    g.beginPath(); g.arc(36, 56, 6, Math.PI, 0); g.strokePath();
    g.fillStyle(BLACK, 1).fillCircle(36, 62, 2.5);
    g.fillRect(35, 62, 2, 5);
  }, { r: 34, outline: 2, lo: 0.62, hi: 1, rim: 0.1, light: [-0.3, -0.6] });
}
