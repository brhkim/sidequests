import Phaser from 'phaser';
import { GATES } from '../../config';
import type { Gate } from '../../systems/Gates';
import { HW, NOTE, ROAD } from '../art/cards';
import { RAIL_HEIGHT } from '../hud/TopRail';
import { LIGHT } from '../theme';

/** The card the squad is lined up on, where it is and how wide it is drawn. */
export interface ReceptorTarget {
  readonly pair: number;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly color: number;
}

/** Px of descent over which a receptor comes up from faint to full. */
const RANGE = 560;
/** Receptors of the approaching offer's other options: a whisper of the rail light. */
const IDLE_ALPHA = 0.22;
/** Where a card starts to fade in under the rail (`GateCards`' reveal). */
const REVEAL_FROM = RAIL_HEIGHT + 6;

/**
 * The receptors on the judgment line - the rhythm game's answer to "which
 * card will I take". It replaces the old selection guide (white L-brackets on
 * the card, a stub and a ring over the leader).
 *
 *   - The TARGET's footprint - its x and drawn width, exactly as
 *     `FieldRender.findTarget` decides - lights on the judgment line in its
 *     axis colour: a glowing bar at depth 5, under the squad, and a bracket
 *     at each edge at depth 25, over everything on the field, so a full ring
 *     standing on the bar cannot hide where the footprint ends.
 *   - The leader wears a ring and a chevron pointing up the lane in the same
 *     colour (depth 25): the leader is what selects.
 *   - The approaching offer's other options show where they will land, as
 *     faint rail-light bars on the line. They never take a colour.
 *
 * Brightness rises as the note nears. Nothing here reads anything but the
 * gates and the squad's position.
 */
export class Receptors {
  private readonly bar: Phaser.GameObjects.NineSlice;
  private readonly idle: Phaser.GameObjects.NineSlice[] = [];
  private readonly capL: Phaser.GameObjects.Image;
  private readonly capR: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly chevron: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    const slice = (): Phaser.GameObjects.NineSlice => scene.add
      .nineslice(0, ROAD.judgment, HW.recBar, undefined, 100, 28, NOTE.slice, NOTE.slice, 0, 0)
      .setDepth(5).setVisible(false);
    // The idle footprints are light added to the road; the target's replaces
    // the judgment line's white with its colour, so it is drawn normally.
    for (let i = 0; i < GATES.perOffer; i++) {
      this.idle.push(slice().setTint(LIGHT.rail).setBlendMode(Phaser.BlendModes.ADD));
    }
    this.bar = slice();
    this.capL = scene.add.image(0, ROAD.judgment, HW.recCapL).setOrigin(7.5 / 24, 20 / 40).setDepth(25).setVisible(false);
    this.capR = scene.add.image(0, ROAD.judgment, HW.recCapR).setOrigin(16.5 / 24, 20 / 40).setDepth(25).setVisible(false);
    this.ring = scene.add.image(0, 0, HW.leader).setDepth(25).setVisible(false);
    this.chevron = scene.add.image(0, 0, HW.chevron).setDepth(25).setVisible(false);
  }

  render(gates: readonly Gate[], squadX: number, squadY: number, t: ReceptorTarget | null): void {
    // The approaching offer: the lowest one still above the squad.
    let pair = -1;
    let pairY = -Infinity;
    for (const g of gates) {
      if (g.active && g.y <= squadY && g.y > pairY) { pairY = g.y; pair = g.pair; }
    }
    const idleNear = pair < 0 ? 0 : Phaser.Math.Clamp(1 - (squadY - pairY) / RANGE, 0, 1);
    let used = 0;
    for (const g of gates) {
      if (!g.active || g.pair !== pair || used >= this.idle.length) continue;
      if (t !== null && t.pair === g.pair && t.index === g.index) continue;
      const s = this.idle[used++];
      const w = g.width - GATES.gap;
      if (s.width !== w) s.setSize(w, 28);
      s.setVisible(idleNear > 0).setX(g.x).setAlpha(IDLE_ALPHA * idleNear);
    }
    for (let i = used; i < this.idle.length; i++) this.idle[i].setVisible(false);

    const on = t !== null;
    this.bar.setVisible(on);
    this.capL.setVisible(on);
    this.capR.setVisible(on);
    this.ring.setVisible(on);
    this.chevron.setVisible(on);
    if (t === null) return;
    const near = Phaser.Math.Clamp(1 - (squadY - t.y) / RANGE, 0, 1);
    // Still under the HUD: the note is not on screen yet, so neither is most
    // of its receptor (the same reveal the card fades in on).
    const reveal = 0.35 + 0.65 * Phaser.Math.Clamp((t.y - REVEAL_FROM) / 44, 0, 1);
    const w = t.width - GATES.gap;
    if (this.bar.width !== w) this.bar.setSize(w, 28);
    this.bar.setX(t.x).setTint(t.color).setAlpha((0.5 + 0.5 * near) * reveal);
    const edge = (0.6 + 0.4 * near) * reveal;
    this.capL.setX(t.x - w / 2).setTint(t.color).setAlpha(edge);
    this.capR.setX(t.x + w / 2).setTint(t.color).setAlpha(edge);
    this.ring.setPosition(squadX, squadY - 2).setTint(t.color).setAlpha((0.55 + 0.45 * near) * reveal);
    this.chevron.setPosition(squadX, squadY - 34 - 4 * near).setTint(t.color).setAlpha((0.4 + 0.6 * near) * reveal);
  }
}
