import Phaser from 'phaser';
import { GATES } from '../../config';
import { HW } from '../art/cards';
import { SCREEN_TEX } from '../art/screens';
import { placeOperator, splitOperator } from '../render/Operator';
import { INK } from '../theme';
import { slice } from './ScreenButton';
import { FONT } from './types';

export { cardButton, segmented, type ButtonVariant, type CardButton } from './ScreenButton';

/** A tile's default footprint: the field note's width and height. */
export const TILE = { width: 120, height: GATES.height } as const;

/** Unheld: the note is there, dimmed, the way an unheld strip cell is. */
const DIM = { body: 0.38, gloss: 0.35, magnitude: 0.6, axis: 0.8 } as const;
const SHADOW_DROP = 4;

/**
 * A note off the highway, for the screens: the start screen's demo offer,
 * the pause page's ten bonuses. The anatomy is the direction contract's
 * note - rounded 9px, a baked gradient body in the axis colour, a lit cap,
 * a lighter inner edge, a white gloss over the upper half and a soft
 * offset shadow - with the label as magnitude over axis word, so a player
 * who has taken one offer reads a tile without learning anything new.
 *
 * `held` is the pause page's question: a tile for a bonus held at nothing
 * dims. `select` draws the old field's target mark (the field now uses receptors on the
 * judgment line) - white L-brackets at the
 * bottom corners - never a white outline, which is the SENSE mark and
 * means "the best card".
 *
 * Both lines shrink to fit the tile when a value is wider than it (a late
 * `RATE ×1.02K`), rather than every tile being sized for the rare case; the
 * Phone Floor keeps the axis word at 13px or more at rest.
 *
 * Every part is a flat object at the tile's own centre (no Container), so
 * `setY` and `setScale` move them together and the probes read the words.
 */
export class CardTile {
  readonly parts: Phaser.GameObjects.GameObject[];
  private readonly shadow: Phaser.GameObjects.NineSlice;
  private readonly body: Phaser.GameObjects.NineSlice;
  private readonly gloss: Phaser.GameObjects.NineSlice;
  /** The operator, drawn as the field's glyph (`Operator`), and the figure after it. */
  private readonly op: Phaser.GameObjects.Image;
  private readonly magnitude: Phaser.GameObjects.Text;
  private readonly axis: Phaser.GameObjects.Text;
  private readonly magY: number;
  private readonly magSize: number;
  private hasOp = false;
  private readonly brackets: Phaser.GameObjects.Graphics;
  private readonly pips: Phaser.GameObjects.Arc[] = [];
  private readonly offsets = new Map<Phaser.GameObjects.Components.Transform, number>();
  private color: number;
  private held = true;
  private alpha = 1;
  private scale = 1;
  private axisFit = 1;
  private cy: number;

  constructor(
    scene: Phaser.Scene, readonly x: number, y: number, color: number,
    readonly width: number = TILE.width, readonly height: number = TILE.height, withPips = false,
    magnitudeSize = 26,
  ) {
    this.color = color;
    this.cy = y;
    // The label sits 3px low: the lit cap takes the top 7px of the note.
    const magY = height >= 72 ? -9 : -7;
    const axisY = height >= 72 ? 20 : 17;
    this.magY = magY;
    this.magSize = magnitudeSize;
    this.shadow = slice(scene, SCREEN_TEX.shadow, x, y + SHADOW_DROP, width, height).setAlpha(0.75);
    this.body = slice(scene, SCREEN_TEX.note, x, y, width, height).setTint(color);
    this.gloss = slice(scene, SCREEN_TEX.gloss, x, y, width, height);
    this.op = scene.add.image(x, y + magY, HW.opAdd).setVisible(false);
    this.magnitude = scene.add.text(x, y + magY, '', {
      fontFamily: FONT, fontSize: `${magnitudeSize}px`, color: INK.primary, fontStyle: '800',
    }).setOrigin(0.5).setShadow(0, 1, 'rgba(0,0,0,0.5)', 3);
    this.axis = scene.add.text(x, y + axisY, '', {
      fontFamily: FONT, fontSize: '14px', color: INK.primary, fontStyle: '700',
    }).setOrigin(0.5).setLetterSpacing(1.6).setShadow(0, 1, 'rgba(0,0,0,0.5)', 2);
    // The target brackets, drawn once and shown by `select`.
    this.brackets = scene.add.graphics({ x, y }).setVisible(false);
    this.brackets.lineStyle(3, 0xffffff, 0.95);
    const bottom = height / 2 + 3;
    for (const side of [-1, 1]) {
      const cxs = side * (width / 2 + 3);
      this.brackets.beginPath();
      this.brackets.moveTo(cxs, bottom - 16);
      this.brackets.lineTo(cxs, bottom);
      this.brackets.lineTo(cxs - side * 16, bottom);
      this.brackets.strokePath();
    }
    this.parts = [this.shadow, this.body, this.gloss, this.op, this.magnitude, this.axis, this.brackets];
    // The operator and the figure are laid out together by `placeFigure`.
    this.offsets.set(this.shadow, SHADOW_DROP).set(this.body, 0).set(this.gloss, 0)
      .set(this.axis, axisY).set(this.brackets, 0);
    if (withPips) {
      // Three drawn pips in place of a magnitude: the rail's own SENSE glyph.
      for (const dx of [-22, 0, 22]) {
        const pip = scene.add.circle(x + dx, y + magY, 7, 0xffffff, 0).setStrokeStyle(2, 0xffffff, 0.95);
        this.pips.push(pip);
        this.parts.push(pip);
        this.offsets.set(pip, magY);
      }
    }
  }

  /**
   * Magnitude over axis word; either shrinks to fit the tile's inside. The
   * magnitude's leading `×` / `+` is drawn as the field note's operator
   * glyph, the same split and the same layout (`Operator`), so a tile and
   * the note it stands for cannot disagree.
   */
  set(magnitude: string, axis: string, axisColor?: string): this {
    const inner = this.width - 12;
    const { op, figure } = splitOperator(magnitude);
    this.hasOp = op !== null;
    if (op !== null && this.op.texture.key !== op) this.op.setTexture(op);
    if (this.magnitude.text !== figure) this.magnitude.setText(figure);
    this.placeFigure();
    if (this.axis.text !== axis) this.axis.setText(axis);
    this.axisFit = Math.min(1, inner / Math.max(1, this.axis.width));
    this.axis.setScale(this.axisFit * this.scale);
    if (axisColor) this.axis.setColor(axisColor);
    return this;
  }

  /** Re-tints the note to another axis; the start screen's demo cycles offers. */
  setColor(color: number): this {
    this.color = color;
    this.body.setTint(color);
    return this;
  }

  get tint(): number { return this.color; }

  /** Filled pips for the count held, on a tile made with pips. */
  setPips(count: number): this {
    this.pips.forEach((pip, i) => pip.setFillStyle(0xffffff, i < count ? 0.95 : 0));
    return this;
  }

  setHeld(held: boolean): this {
    this.held = held;
    return this.apply();
  }

  select(on: boolean): this {
    this.brackets.setVisible(on);
    return this;
  }

  /** Fades the whole note (the demo's arrival, the screens' entrance). */
  setAlpha(a: number): this {
    this.alpha = a;
    return this.apply();
  }

  setY(y: number): this {
    this.cy = y;
    for (const [o, dy] of this.offsets) o.y = y + dy * this.scale;
    this.placeFigure();
    return this;
  }

  /** Scales the note about its centre - the demo's hit swells it as it lands. */
  setScale(s: number): this {
    this.scale = s;
    for (const [o, dy] of this.offsets) {
      o.setScale(o === this.axis ? s * this.axisFit : s);
      o.y = this.cy + dy * s;
    }
    this.placeFigure();
    return this;
  }

  /** The operator and the figure as one group, fitted to the tile's inside. */
  private placeFigure(): void {
    placeOperator(this.op, this.magnitude, this.hasOp, this.x, this.cy + this.magY * this.scale,
      this.width - 12, this.magSize, this.scale);
  }

  private apply(): this {
    const h = this.held, a = this.alpha;
    this.shadow.setAlpha(0.75 * a * (h ? 1 : 0.5));
    this.body.setAlpha(a * (h ? 1 : DIM.body));
    this.gloss.setAlpha(a * (h ? 1 : DIM.gloss));
    this.magnitude.setAlpha(a * (h ? 1 : DIM.magnitude));
    this.op.setAlpha(a * (h ? 1 : DIM.magnitude));
    this.axis.setAlpha(a * (h ? 1 : DIM.axis));
    this.brackets.setAlpha(a);
    for (const pip of this.pips) pip.setAlpha(a * (h ? 1 : DIM.magnitude));
    return this;
  }
}
