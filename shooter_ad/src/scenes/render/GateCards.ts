import Phaser from 'phaser';
import { COLORS, GATES, RENDER } from '../../config';
import { AXIS_COLOR } from '../../data/gates';
import type { Gate } from '../../systems/Gates';
import { FONT, hex } from '../hud/types';
import { RAIL_HEIGHT } from '../hud/TopRail';

interface GateVisual {
  rect: Phaser.GameObjects.Rectangle;
  roof: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  /** The SENSE mark: a bar above the roof and its caption on a backing. */
  bar: Phaser.GameObjects.Rectangle;
  tagBack: Phaser.GameObjects.Rectangle;
  tag: Phaser.GameObjects.Text;
}

/** The card the squad is lined up on this frame, and the offer it belongs to. */
export interface GateTarget {
  readonly pair: number;
  readonly index: number;
}

/**
 * The descending offer cards. Each has a translucent body in its axis colour,
 * a solid ROOF bar along its top edge, and its label on the topmost gameplay
 * layer - depth 15, above the squad's bullet stream (12), because a label a
 * bullet can cross is unreadable exactly when the decision is due.
 *
 * On a sensed offer the option that is best RIGHT NOW - priced by the same
 * `scoreOffer` par and the death screen use - wears a pulsing bar and a
 * `SENSE` caption. It is recomputed every frame rather than fixed at spawn,
 * so if taking the previous gate changes which of the three is best, the mark
 * moves with the truth. The pulse reads the simulated clock for its phase.
 *
 * The card the squad is lined up on brightens and its two siblings fade, so
 * which of three the centre unit will pass through is never a guess.
 */
export class GateCards {
  private readonly visuals: GateVisual[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  render(gates: readonly Gate[], marked: ReadonlySet<string>, target: GateTarget | null, elapsed: number): void {
    const pulse = 0.55 + 0.45 * Math.sin(elapsed * 7);
    let used = 0;
    for (const g of gates) {
      if (!g.active) continue;
      const v = this.visuals[used] ?? this.make();
      // Fade in clear of the top rail. Gates spawn above the screen and would
      // otherwise slide through the HUD numbers, putting two unrelated sets of
      // figures on top of each other exactly where the player reads par.
      const reveal = Phaser.Math.Clamp((g.y - RAIL_HEIGHT - 6) / 44, 0, 1);
      const width = g.width - GATES.gap;
      const isTarget = target !== null && target.pair === g.pair && target.index === g.index;
      const isSibling = target !== null && target.pair === g.pair && !isTarget;
      const fill = isTarget ? RENDER.gate.targetFill : isSibling ? 0.1 : RENDER.gate.fill;
      const stroke = isTarget ? 1 : isSibling ? 0.5 : 0.8;
      const top = g.y - GATES.height / 2;
      const on = reveal > 0;
      v.rect.setVisible(on).setPosition(g.x, g.y).setSize(width, GATES.height)
        .setFillStyle(g.type.color, fill * reveal)
        .setStrokeStyle(isTarget ? 3 : 2, g.type.color, stroke * reveal);
      v.roof.setVisible(on).setPosition(g.x, top).setSize(width, RENDER.gate.roof)
        .setFillStyle(g.type.color, reveal);
      v.label.setVisible(on).setPosition(g.x, g.y).setAlpha(reveal);
      if (v.label.text !== g.type.label) v.label.setText(g.type.label);

      const isMarked = on && marked.has(`${g.pair}:${g.index}`);
      const barY = top - 3 - 3;
      v.bar.setVisible(isMarked).setPosition(g.x, barY).setSize(width, 6)
        .setFillStyle(AXIS_COLOR.sense, (0.55 + 0.45 * pulse) * reveal);
      v.tagBack.setVisible(isMarked).setPosition(g.x, barY).setAlpha(0.85 * reveal);
      v.tag.setVisible(isMarked).setPosition(g.x, barY + 1).setAlpha(reveal);
      used++;
    }
    for (let i = used; i < this.visuals.length; i++) {
      const v = this.visuals[i];
      v.rect.setVisible(false); v.roof.setVisible(false); v.label.setVisible(false);
      v.bar.setVisible(false); v.tagBack.setVisible(false); v.tag.setVisible(false);
    }
  }

  private make(): GateVisual {
    const s = this.scene;
    const v: GateVisual = {
      rect: s.add.rectangle(0, 0, 10, GATES.height, 0xffffff, RENDER.gate.fill).setDepth(4),
      roof: s.add.rectangle(0, 0, 10, RENDER.gate.roof, 0xffffff, 1).setOrigin(0.5, 0).setDepth(4),
      label: s.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: `${GATES.labelSize}px`, color: COLORS.text, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(15),
      bar: s.add.rectangle(0, 0, 10, 6, AXIS_COLOR.sense, 1).setDepth(4).setVisible(false),
      tagBack: s.add.rectangle(0, 0, 52, 18, 0x0b0f1c, 0.85).setDepth(14).setVisible(false),
      tag: s.add.text(0, 0, 'SENSE', {
        fontFamily: FONT, fontSize: '12px', color: hex(AXIS_COLOR.sense), fontStyle: 'bold',
      }).setOrigin(0.5).setLetterSpacing(2).setDepth(15).setVisible(false),
    };
    this.visuals.push(v);
    return v;
  }
}
