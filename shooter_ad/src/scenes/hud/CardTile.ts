import Phaser from 'phaser';
import { GATES, RENDER } from '../../config';
import { FONT, hex } from './types';

/** The one object the screens borrow from the field: a gate card's anatomy. */
export const TILE = { width: 120, height: GATES.height, roof: RENDER.gate.roof } as const;

/**
 * A gate card off the field, for the screens: the 4px roof in the axis
 * colour, the body tinted in the same colour, a 2px stroke, and the label as
 * magnitude over axis word - exactly what `render/GateCards` draws, so a
 * player who has taken one offer reads a pause tile or a start-screen demo
 * without learning anything new.
 *
 * `held` is the pause page's question: a tile for a bonus the player holds
 * nothing of sits at the unheld fill and its magnitude dims, the way an
 * unheld strip cell does. `select` draws the field's TARGET mark - the two
 * white L-brackets at the bottom corners the leader's card wears - never
 * the white stroke, which is the SENSE mark and means "the best card".
 *
 * The magnitude shrinks to fit when a number is wider than the card, as it
 * does on the field; the axis word never does. The Phone Floor puts the
 * smallest text at 13px, so a tile's axis line is written to fit instead.
 */
export class CardTile {
  readonly parts: Phaser.GameObjects.GameObject[];
  private readonly rect: Phaser.GameObjects.Rectangle;
  private readonly roof: Phaser.GameObjects.Rectangle;
  private readonly magnitude: Phaser.GameObjects.Text;
  private readonly axis: Phaser.GameObjects.Text;
  private readonly brackets: Phaser.GameObjects.Graphics;
  private readonly pips: Phaser.GameObjects.Arc[] = [];
  private color: number;
  private held = true;

  constructor(
    scene: Phaser.Scene, readonly x: number, readonly y: number, color: number,
    width: number = TILE.width, height: number = TILE.height, withPips = false,
  ) {
    this.color = color;
    this.rect = scene.add.rectangle(x, y, width, height, color, 0.18).setStrokeStyle(2, color, 0.8);
    this.roof = scene.add.rectangle(x, y - height / 2, width, TILE.roof, color, 1).setOrigin(0.5, 0);
    this.magnitude = scene.add.text(x, y - 9, '', {
      fontFamily: FONT, fontSize: `${GATES.magnitudeSize}px`, color: '#e8ecf8', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.axis = scene.add.text(x, y + 18, '', {
      fontFamily: FONT, fontSize: '14px', color: '#e8ecf8', fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(2);
    // The target brackets, drawn once at the tile's bottom corners and shown
    // by `select`: the field's own "this one".
    this.brackets = scene.add.graphics().setVisible(false);
    this.brackets.lineStyle(3, 0xffffff, 0.95);
    const bottom = y + height / 2 - 1;
    for (const side of [-1, 1]) {
      const cxs = x + side * (width / 2 - 1);
      this.brackets.beginPath();
      this.brackets.moveTo(cxs, bottom - 14);
      this.brackets.lineTo(cxs, bottom);
      this.brackets.lineTo(cxs - side * 14, bottom);
      this.brackets.strokePath();
    }
    this.parts = [this.rect, this.roof, this.magnitude, this.axis, this.brackets];
    if (withPips) {
      // Three drawn pips in place of a magnitude: the rail's own SENSE glyph.
      for (const dx of [-24, 0, 24]) {
        const pip = scene.add.circle(x + dx, y - 9, 8, 0xe8ecf8, 0).setStrokeStyle(1.5, 0xe8ecf8, 0.9);
        this.pips.push(pip);
        this.parts.push(pip);
      }
    }
  }

  /** Magnitude over axis word; a magnitude wider than the card shrinks to fit. */
  set(magnitude: string, axis: string, axisColor?: string): this {
    this.magnitude.setText(magnitude).setScale(1).setVisible(magnitude !== '');
    const inner = this.rect.width - 8;
    this.magnitude.setScale(Math.min(1, inner / Math.max(1, this.magnitude.width)));
    this.axis.setText(axis);
    if (axisColor) this.axis.setColor(axisColor);
    return this;
  }

  /** Filled pips for the count held, on a tile made with pips. */
  setPips(count: number): this {
    this.pips.forEach((pip, i) => pip.setFillStyle(0xe8ecf8, i < count ? 0.9 : 0));
    return this;
  }

  setHeld(held: boolean): this {
    this.held = held;
    this.rect.setFillStyle(this.color, held ? 0.18 : 0.06);
    this.rect.setStrokeStyle(2, this.color, held ? 0.8 : 0.45);
    this.roof.setAlpha(held ? 1 : 0.55);
    this.magnitude.setAlpha(held ? 1 : 0.6);
    this.axis.setAlpha(held ? 1 : 0.8);
    for (const pip of this.pips) pip.setAlpha(held ? 1 : 0.6);
    return this;
  }

  select(on: boolean): this {
    this.brackets.setVisible(on);
    this.setHeld(this.held);
    return this;
  }

  setAlpha(a: number): this {
    for (const p of this.parts) (p as Phaser.GameObjects.Rectangle).setAlpha(a);
    return this;
  }

  setY(y: number): this {
    const dy = y - this.rect.y;
    this.rect.y += dy; this.roof.y += dy; this.magnitude.y += dy; this.axis.y += dy;
    this.brackets.y += dy;
    for (const pip of this.pips) pip.y += dy;
    return this;
  }
}

/**
 * A button in the card's shape: roof, tinted body, stroke, one word. The
 * filled primary action is ARMY green. Returns the parts (for a container)
 * and the hit rectangle to bind.
 */
export function cardButton(
  scene: Phaser.Scene, x: number, y: number, width: number, height: number,
  color: number, label: string, fontSize = 22,
): { parts: Phaser.GameObjects.GameObject[]; hit: Phaser.GameObjects.Rectangle } {
  const body = scene.add.rectangle(x, y, width, height, color, 0.2).setStrokeStyle(2, color, 0.9);
  const roof = scene.add.rectangle(x, y - height / 2, width, TILE.roof, color, 1).setOrigin(0.5, 0);
  const text = scene.add.text(x, y + 1, label, {
    fontFamily: FONT, fontSize: `${fontSize}px`, color: hex(color), fontStyle: 'bold',
  }).setOrigin(0.5).setLetterSpacing(1);
  return { parts: [body, roof, text], hit: body };
}
