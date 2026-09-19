import Phaser from 'phaser';
import { BLACK, WHITE, texture } from './draw';

/**
 * The squad stays human: a rank-coloured shirt under a skin-toned head. Both
 * are outlined in black at 2x, which is what turns nineteen overlapping units
 * into nineteen units - without an edge the ring read as one blob. A small
 * black rifle rises from the right shoulder; the leader's head wears a visor
 * band on top of being drawn larger (`SQUAD.leaderScale`).
 *
 * Display sizes are unchanged from the unoutlined art: body 14x20, head 10.
 */
export function makeSquad(scene: Phaser.Scene): void {
  texture(scene, 'body', 28, 40, (g) => {
    g.fillStyle(BLACK, 1).fillRect(20, 0, 4, 16);
    g.fillStyle(WHITE, 1).fillRoundedRect(2, 6, 24, 32, 9);
    g.lineStyle(3, BLACK, 1).strokeRoundedRect(2, 6, 24, 32, 9);
  });
  texture(scene, 'head', 20, 20, (g) => head(g, false));
  texture(scene, 'head-lead', 20, 20, (g) => head(g, true));
}

function head(g: Phaser.GameObjects.Graphics, visor: boolean): void {
  g.fillStyle(WHITE, 1).fillCircle(10, 10, 8);
  g.lineStyle(2, BLACK, 1).strokeCircle(10, 10, 8);
  if (visor) g.fillStyle(BLACK, 1).fillRoundedRect(4, 8, 12, 4, 1);
}
