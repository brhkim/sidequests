import Phaser from 'phaser';
import { BLACK, WHITE, bake, type Finish } from './draw';

/**
 * The squad stays human: a rank-coloured shirt under a skin-toned head. Both
 * are outlined in black at 2x, which is what turns nineteen overlapping units
 * into nineteen units - without an edge the ring read as one blob. A small
 * black rifle rises from the right shoulder; the leader's head wears a visor
 * band on top of being drawn larger (`SQUAD.leaderScale`).
 *
 * Two finishes of one drawing (display sizes unchanged: body 14x20, head 10):
 *
 *   body / head / head-lead           the soldiers, on the field and on the
 *                                     start screen: lit shoulders in the rank
 *                                     shirt exactly, a shaded hem, a darker rim.
 *   sq-holo-body / -head / -head-lead the same drawing lit flat and cut by
 *                                     scanlines, for the ECHO ghosts - drawn
 *                                     additive at `echoAlpha`, so a ghost reads
 *                                     as a projection and never as a second
 *                                     squad.
 */
const SOLDIER: Finish = { r: 16, lo: 0.6, hi: 1, rim: 0.22, pad: 3, light: [-0.25, -0.5] };
const SKIN: Finish = { r: 8, lo: 0.68, hi: 1, pad: 3, light: [-0.3, -0.45] };
const HOLO_BODY: Finish = { ...SOLDIER, lo: 0.85, rim: 0, scan: 4, scanAlpha: 0.25 };
const HOLO_SKIN: Finish = { ...SKIN, lo: 0.85, scan: 4, scanAlpha: 0.25 };

export function makeSquad(scene: Phaser.Scene): void {
  const variants: readonly [string, Finish, Finish][] = [
    ['', SOLDIER, SKIN],
    ['sq-holo-', HOLO_BODY, HOLO_SKIN],
  ];
  for (const [prefix, shirt, skin] of variants) {
    bake(scene, `${prefix}body`, 28, 40, torso, shirt);
    bake(scene, `${prefix}head`, 20, 20, (g) => head(g, false), skin);
    bake(scene, `${prefix}head-lead`, 20, 20, (g) => head(g, true), skin);
  }
}

function torso(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(BLACK, 1).fillRect(20, 0, 4, 16);
  g.fillStyle(WHITE, 1).fillRoundedRect(2, 6, 24, 32, 9);
  g.lineStyle(3, BLACK, 1).strokeRoundedRect(2, 6, 24, 32, 9);
}

function head(g: Phaser.GameObjects.Graphics, visor: boolean): void {
  g.fillStyle(WHITE, 1).fillCircle(10, 10, 8);
  g.lineStyle(2, BLACK, 1).strokeCircle(10, 10, 8);
  if (visor) g.fillStyle(BLACK, 1).fillRoundedRect(4, 8, 12, 4, 1);
}
