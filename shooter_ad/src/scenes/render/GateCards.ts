import Phaser from 'phaser';
import { COLORS, GATES, RENDER } from '../../config';
import { AXIS_COLOR } from '../../data/gates';
import type { Gate } from '../../systems/Gates';
import { FONT, hex } from '../hud/types';
import { RAIL_HEIGHT } from '../hud/TopRail';

interface GateVisual {
  rect: Phaser.GameObjects.Rectangle;
  roof: Phaser.GameObjects.Rectangle;
  /** The label, split: MAGNITUDE (`×1.05`, `+2`) over AXIS (`DMG`, `GUNS`). */
  magnitude: Phaser.GameObjects.Text;
  axis: Phaser.GameObjects.Text;
  /** Which `type.label` the two lines currently show, so setText is rare. */
  label: string;
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
 * Splits a gate label into its two lines at the LAST space - `+180% DMG` is
 * `+180%` over `DMG`, `+2 PIERCE` is `+2` over `PIERCE`. `+SENSE` has no
 * space: it shows `+` over `SENSE`, so the axis word sits on the axis line
 * like every other card's. The label string itself is untouched - the
 * DecisionLog and every instrument read `type.label`, and this is display.
 */
export function splitLabel(label: string): { magnitude: string; axis: string } {
  const at = label.lastIndexOf(' ');
  if (at > 0) return { magnitude: label.slice(0, at), axis: label.slice(at + 1) };
  const word = label.match(/[A-Z].*$/);
  if (word && word.index) return { magnitude: label.slice(0, word.index), axis: word[0] };
  return { magnitude: label, axis: '' };
}

/**
 * The descending offer cards. Each has a translucent body in its axis colour,
 * a solid ROOF bar along its top edge, and its label on the topmost gameplay
 * layer - depth 15, above the squad's bullet stream (12), because a label a
 * bullet can cross is unreadable exactly when the decision is due.
 *
 * The label is two lines, magnitude over axis, because from wave 4 dead space
 * narrows the card (`GATES.deadSpace`) and a one-line `+180% DMG` needs more
 * than the 100px floor. The magnitude is drawn at `GATES.magnitudeSize` and
 * SHRUNK to the card's inner width when it overflows - `+1840%` at 26px is
 * wider than the narrowest card - so every label the generator can produce
 * fits, and the common short ones stay large.
 *
 * On a sensed offer the option that is best RIGHT NOW - priced by the same
 * `scoreOffer` par and the death screen use - wears a pulsing bar and a
 * `SENSE` caption, and its body takes a white stroke - distinct from the
 * targeted card's brackets, so the answer and the target never look alike.
 * It is recomputed every frame rather than fixed at spawn,
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
      const isMarked = on && marked.has(`${g.pair}:${g.index}`);
      v.rect.setVisible(on).setPosition(g.x, g.y).setSize(width, GATES.height)
        .setFillStyle(g.type.color, fill * reveal);
      if (isMarked) v.rect.setStrokeStyle(isTarget ? 3 : 2, 0xffffff, reveal);
      else v.rect.setStrokeStyle(isTarget ? 3 : 2, g.type.color, stroke * reveal);
      v.roof.setVisible(on).setPosition(g.x, top).setSize(width, RENDER.gate.roof)
        .setFillStyle(g.type.color, reveal);
      if (v.label !== g.type.label) {
        v.label = g.type.label;
        const { magnitude, axis } = splitLabel(g.type.label);
        v.magnitude.setText(magnitude).setScale(1);
        v.axis.setText(axis);
      }
      // Two lines centred on the card: the magnitude a little above centre,
      // the axis word tucked beneath it. The 4px inset keeps a shrunk
      // magnitude off the card's stroke.
      const inner = width - 4;
      v.magnitude.setVisible(on).setPosition(g.x, g.y - 9).setAlpha(reveal)
        .setScale(Math.min(1, inner / Math.max(1, v.magnitude.width)));
      v.axis.setVisible(on).setPosition(g.x, g.y + 18).setAlpha(reveal);

      // 8px bar with an alpha floor of 0.8: at 6px pulsing to 0.55 it was the
      // least legible thing on the field.
      const barY = top - 3 - 4;
      v.bar.setVisible(isMarked).setPosition(g.x, barY).setSize(width, 8)
        .setFillStyle(AXIS_COLOR.sense, (0.8 + 0.2 * pulse) * reveal);
      v.tagBack.setVisible(isMarked).setPosition(g.x, barY).setAlpha(0.96 * reveal);
      v.tag.setVisible(isMarked).setPosition(g.x, barY + 1).setAlpha(reveal);
      used++;
    }
    for (let i = used; i < this.visuals.length; i++) {
      const v = this.visuals[i];
      v.rect.setVisible(false); v.roof.setVisible(false);
      v.magnitude.setVisible(false); v.axis.setVisible(false);
      v.bar.setVisible(false); v.tagBack.setVisible(false); v.tag.setVisible(false);
    }
  }

  private make(): GateVisual {
    const s = this.scene;
    const v: GateVisual = {
      rect: s.add.rectangle(0, 0, 10, GATES.height, 0xffffff, RENDER.gate.fill).setDepth(4),
      roof: s.add.rectangle(0, 0, 10, RENDER.gate.roof, 0xffffff, 1).setOrigin(0.5, 0).setDepth(4),
      magnitude: s.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: `${GATES.magnitudeSize}px`, color: COLORS.text, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(15),
      axis: s.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: `${GATES.axisSize}px`, color: COLORS.text, fontStyle: 'bold',
      }).setOrigin(0.5).setLetterSpacing(2).setDepth(15),
      label: '',
      bar: s.add.rectangle(0, 0, 10, 8, AXIS_COLOR.sense, 1).setDepth(4).setVisible(false),
      tagBack: s.add.rectangle(0, 0, 64, 22, 0x0b0f1c, 0.96).setDepth(14).setVisible(false),
      tag: s.add.text(0, 0, 'SENSE', {
        fontFamily: FONT, fontSize: '14px', color: hex(AXIS_COLOR.sense), fontStyle: 'bold',
      }).setOrigin(0.5).setLetterSpacing(2).setDepth(15).setVisible(false),
    };
    this.visuals.push(v);
    return v;
  }
}
