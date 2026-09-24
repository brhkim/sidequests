import type Phaser from 'phaser';
import { HW } from '../art/cards';

/** The operator glyph's footprint, px, beside a figure set at `OP_FIGURE_SIZE`. */
export const OP_WIDTH = 19;
/** The figure size the glyph is drawn for; at any other size it scales with the figure. */
export const OP_FIGURE_SIZE = 26;

/**
 * A magnitude's leading operator, split off for drawing: `×1.25` is the
 * multiply glyph and `1.25`, `+40%` the add glyph and `40%`, a bare `+`
 * (`+SENSE`, `+TIME`) the add glyph alone. `op` is the glyph's texture key,
 * or null when the magnitude has none. In Saira `×` is x-height small and
 * reads as a speck beside the figure, and the FORM - multiply or add - is the
 * whole question a card asks, so both are drawn as equal-size glyphs
 * (`art/cards` `HW.opMult` / `HW.opAdd`). Display only: the label strings
 * every instrument reads are untouched.
 *
 * The one definition for the field's notes (`GateCards`) and the screens'
 * tiles (`CardTile`), so the two cannot drift apart.
 */
export function splitOperator(magnitude: string): { op: string | null; figure: string } {
  const first = magnitude.charAt(0);
  if (first === '×') return { op: HW.opMult, figure: magnitude.slice(1) };
  if (first === '+') return { op: HW.opAdd, figure: magnitude.slice(1) };
  return { op: null, figure: magnitude };
}

/**
 * Lays the glyph and the figure out as ONE group centred on `cx` at `y`,
 * shrunk together (never separately) when the pair is wider than `inner`.
 * `size` is the figure's font size - the glyph scales with it - and `scale`
 * any outer scale the whole note is drawn at. `figure.width` is read
 * unscaled. Sets position, scale and visibility; alpha is the caller's.
 */
export function placeOperator(
  op: Phaser.GameObjects.Image, figure: Phaser.GameObjects.Text, hasOp: boolean,
  cx: number, y: number, inner: number, size = OP_FIGURE_SIZE, scale = 1,
): void {
  const k = size / OP_FIGURE_SIZE;
  const fw = figure.text === '' ? 0 : figure.width;
  const opw = hasOp ? OP_WIDTH * k : 0;
  const total = opw + fw;
  const s = Math.min(1, inner / Math.max(1, total)) * scale;
  const x0 = cx - (total * s) / 2;
  op.setVisible(hasOp);
  if (hasOp) op.setPosition(x0 + (opw * s) / 2, y + s).setScale(k * s);
  figure.setVisible(fw > 0).setPosition(x0 + opw * s + (fw * s) / 2, y).setScale(s);
}
