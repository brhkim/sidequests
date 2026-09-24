import Phaser from 'phaser';
import { GATES, HUD_ROWS } from '../../config';
import type { Gate } from '../../systems/Gates';
import { HW, NOTE } from '../art/cards';
import { FONT } from '../hud/types';
import { INK, TYPE } from '../theme';
import { placeOperator, splitOperator } from './Operator';

interface GateVisual {
  /** The sway groove (1.6): the lane a swaying card moves within, with its stops. */
  track: Phaser.GameObjects.NineSlice;
  shadow: Phaser.GameObjects.NineSlice;
  /** The target's breathing glow, added under the body. */
  glow: Phaser.GameObjects.NineSlice;
  body: Phaser.GameObjects.NineSlice;
  /** The target's white inner rim. */
  rim: Phaser.GameObjects.NineSlice;
  /** The SENSE mark's white edge. */
  edge: Phaser.GameObjects.NineSlice;
  /** The operator, drawn: `×` or `+`, or hidden when the magnitude has none. */
  op: Phaser.GameObjects.Image;
  /** The label, split: MAGNITUDE (`1.05`, `180%`, `2`) over AXIS (`DMG`, `GUNS`). */
  magnitude: Phaser.GameObjects.Text;
  axis: Phaser.GameObjects.Text;
  /** Which `type.label` the lines currently show, so setText is rare. */
  label: string;
  hasOp: boolean;
  /** The SENSE crown: a white pill with a notch, and its caption. */
  crown: Phaser.GameObjects.Image;
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
 * Body tint as a share of the axis colour: at rest, targeted, a sibling of
 * the target. The siblings are barely stepped down: mid-decision they are
 * the two alternatives still being compared, and at 0.5 they read as
 * already rejected. The rim, the breathing glow and the receptor mark the
 * target; the siblings keep their numbers at full strength.
 */
const SHADE = { rest: 0.88, target: 1, sibling: 0.8 } as const;
/** Body alpha in the same three states. */
const BODY_ALPHA = { rest: 0.9, target: 1, sibling: 0.85 } as const;
/** Drop-shadow alpha in the same three states. */
const SHADOW_ALPHA = { rest: 0.7, target: 0.7, sibling: 0.6 } as const;
/**
 * Where the field shows: the HUD band above it is opaque to here
 * (`HUD_ROWS.bottom`, which is also the spawn line).
 */
const FIELD_TOP = HUD_ROWS.bottom;
/** The SENSE crown's lowest centre while its card is still emerging: just under the HUD. */
const CROWN_FLOOR = FIELD_TOP + 20;
/** ...and never lower than this far below the card's top edge (over the cap, above the figure). */
const CROWN_ON_HEAD = 8;

/**
 * How far a card at centre `y` has come out from under the HUD, 0 to 1: it
 * fades in over its own height as it emerges below `FIELD_TOP`, so the fade
 * happens where it can be seen rather than behind the opaque strip. The
 * receptor on the judgment line reads the same curve.
 */
export function cardReveal(y: number): number {
  return Phaser.Math.Clamp((y + GATES.height / 2 - FIELD_TOP) / GATES.height, 0, 1);
}
/** Label rows, from the card's centre. The cap takes the top 9px. */
const MAG_Y = -5;
const AXIS_Y = 23;

function shade(color: number, k: number): number {
  const r = Math.round(((color >> 16) & 255) * k);
  const g = Math.round(((color >> 8) & 255) * k);
  const b = Math.round((color & 255) * k);
  return (r << 16) | (g << 8) | b;
}

/**
 * The descending offer cards, drawn as NOTES on the highway. Each is a
 * rounded, baked-gradient card in its axis colour (NineSlice, 3-sliced, so
 * the continuous width dead space and sway ask for costs no redraw) with a
 * lit cap - the note head - a 1px inner highlight, a crisp edge and a soft
 * offset drop shadow. Its label sits on the topmost gameplay layer - depth
 * 15, above the squad's bullet stream (12) - because a label a bullet can
 * cross is unreadable exactly when the decision is due.
 *
 * The drawn body is exactly `g.width - GATES.gap` wide, the hit test's width;
 * the shadow and the glow are soft and never read as the card's edge.
 *
 * The label is two lines, the magnitude over the axis word, because from wave
 * 10 dead space narrows the card to 83px. The magnitude's OPERATOR is drawn as
 * its own glyph (`×` and `+` are the same size and weight, white), because in
 * the face `×` is x-height small and the form - multiply or add - is the
 * whole question the card asks. Colour names the axis only: both forms of an
 * axis share it. The operator and figure are shrunk together to the card's
 * inner width when they overflow (`Operator`, shared with the screens'
 * tiles).
 *
 * States: at rest; TARGETED (the card the squad is lined up on: full colour, a
 * white inner rim, a glow breathing on the simulated clock); SIBLINGS of the
 * target step down only slightly (they are still being compared). On a
 * sensed offer the option best RIGHT NOW - priced by the same `scoreOffer`
 * par uses - wears the SENSE mark: a pulsing white crown
 * above the card with its caption, and a white edge ON the card. White and
 * above, never coloured and around, so the answer and the target never look
 * alike. The pulse reads the simulated clock.
 *
 * A swaying card (1.6, from judgment wave 31) sits in a GROOVE the width of
 * its travel: a recessed channel with a lit stop at each limit, grey rail
 * light only, so it reads as the road and never as a fourth option.
 */
export class GateCards {
  private readonly visuals: GateVisual[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  render(gates: readonly Gate[], marked: ReadonlySet<string>, target: GateTarget | null, elapsed: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 7);
    const breath = 0.5 + 0.5 * Math.sin(elapsed * 4.2);
    let used = 0;
    for (const g of gates) {
      if (!g.active) continue;
      const v = this.visuals[used] ?? this.make();
      used++;
      // Fade in as it comes out from under the HUD. Gates spawn above the
      // screen and would otherwise slide through the HUD numbers.
      const reveal = cardReveal(g.y);
      const on = reveal > 0;
      if (!on) { this.hide(v); continue; }
      const width = g.width - GATES.gap;
      const isTarget = target !== null && target.pair === g.pair && target.index === g.index;
      const isSibling = target !== null && target.pair === g.pair && !isTarget;
      const state = isTarget ? 'target' : isSibling ? 'sibling' : 'rest';
      const isMarked = marked.has(`${g.pair}:${g.index}`);
      const sways = g.swayAmplitude > 0;
      const top = g.y - GATES.height / 2;

      v.track.setVisible(sways);
      if (sways) {
        const tw = g.width + 2 * g.swayAmplitude - GATES.gap;
        if (v.track.width !== tw) v.track.setSize(tw, GATES.height);
        v.track.setPosition(g.laneX, g.y).setAlpha(reveal);
      }

      const pw = width + NOTE.pad * 2;
      if (v.body.width !== width) {
        v.body.setSize(width, GATES.height);
        v.rim.setSize(width, GATES.height);
        v.edge.setSize(width, GATES.height);
        v.shadow.setSize(pw, GATES.height + NOTE.pad * 2);
        v.glow.setSize(pw, GATES.height + NOTE.pad * 2);
      }
      v.shadow.setVisible(true).setPosition(g.x, g.y + 5).setAlpha(SHADOW_ALPHA[state] * reveal);
      v.body.setVisible(true).setPosition(g.x, g.y)
        .setTint(shade(g.type.color, SHADE[state])).setAlpha(BODY_ALPHA[state] * reveal);
      v.glow.setVisible(isTarget);
      v.rim.setVisible(isTarget);
      if (isTarget) {
        v.glow.setPosition(g.x, g.y).setTint(g.type.color).setAlpha((0.32 + 0.3 * breath) * reveal);
        v.rim.setPosition(g.x, g.y).setAlpha(0.8 * reveal);
      }
      v.edge.setVisible(isMarked);
      if (isMarked) v.edge.setPosition(g.x, g.y).setAlpha((0.7 + 0.3 * pulse) * reveal);

      if (v.label !== g.type.label) this.setLabel(v, g.type.label);
      // The operator and the figure, as one group centred on the card and
      // shrunk together when the pair overflows the inner width. Every
      // label is at full strength, siblings included: they are still options.
      placeOperator(v.op, v.magnitude, v.hasOp, g.x, g.y + MAG_Y, width - 8);
      v.op.setAlpha(reveal);
      v.magnitude.setAlpha(reveal);
      v.axis.setVisible(true).setPosition(g.x, g.y + AXIS_Y).setAlpha(reveal);

      v.crown.setVisible(isMarked);
      v.tag.setVisible(isMarked);
      if (isMarked) {
        // Held just under the HUD while its card is still coming out - but
        // never lower than over the card's own head, clear of its figure -
        // so a sensed offer is told as soon as its head shows, then rides
        // above the card.
        const cy = Math.max(top - 17 - 2 * pulse, Math.min(CROWN_FLOOR, top + CROWN_ON_HEAD));
        v.crown.setPosition(g.x, cy + 2).setScale(0.96 + 0.06 * pulse).setAlpha((0.85 + 0.15 * pulse) * reveal);
        v.tag.setPosition(g.x, cy - 1).setAlpha(reveal);
      }
    }
    for (let i = used; i < this.visuals.length; i++) this.hide(this.visuals[i]);
  }

  private setLabel(v: GateVisual, label: string): void {
    v.label = label;
    const { magnitude, axis } = splitLabel(label);
    const { op, figure } = splitOperator(magnitude);
    v.hasOp = op !== null;
    if (op !== null) v.op.setTexture(op);
    v.magnitude.setText(figure);
    v.axis.setText(axis);
  }

  private hide(v: GateVisual): void {
    v.track.setVisible(false); v.shadow.setVisible(false); v.glow.setVisible(false);
    v.body.setVisible(false); v.rim.setVisible(false); v.edge.setVisible(false);
    v.op.setVisible(false); v.magnitude.setVisible(false); v.axis.setVisible(false);
    v.crown.setVisible(false); v.tag.setVisible(false);
  }

  private make(): GateVisual {
    const s = this.scene;
    const h = GATES.height;
    const { slice, pad } = NOTE;
    const nine = (key: string, w: number, hh: number, sl: number, depth: number): Phaser.GameObjects.NineSlice =>
      s.add.nineslice(0, 0, key, undefined, w, hh, sl, sl, 0, 0).setDepth(depth).setVisible(false);
    const v: GateVisual = {
      track: nine(HW.groove, 100, h, slice, 2),
      shadow: nine(HW.noteShadow, 100 + pad * 2, h + pad * 2, slice + pad, 3).setTint(0x000000),
      glow: nine(HW.noteGlow, 100 + pad * 2, h + pad * 2, slice + pad, 3.5).setBlendMode(Phaser.BlendModes.ADD),
      body: nine(HW.note, 100, h, slice, 4),
      rim: nine(HW.noteRim, 100, h, slice, 4.2),
      edge: nine(HW.noteEdge, 100, h, slice, 4.3),
      op: s.add.image(0, 0, HW.opAdd).setDepth(15).setVisible(false),
      magnitude: s.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: `${TYPE.number.size}px`, fontStyle: TYPE.number.weight, color: '#ffffff',
        stroke: '#07070d', strokeThickness: 4,
        shadow: { offsetX: 0, offsetY: 2, color: 'rgba(0,0,0,0.6)', blur: 3, stroke: true, fill: true },
      }).setOrigin(0.5).setDepth(15).setVisible(false),
      axis: s.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: `${TYPE.label.size}px`, fontStyle: TYPE.label.weight, color: INK.primary,
        stroke: '#07070d', strokeThickness: 3,
      }).setOrigin(0.5).setLetterSpacing(TYPE.label.tracking).setDepth(15).setVisible(false),
      label: '',
      hasOp: false,
      crown: s.add.image(0, 0, HW.crown).setDepth(14.5).setVisible(false),
      tag: s.add.text(0, 0, 'SENSE', {
        fontFamily: FONT, fontSize: `${TYPE.caption.size}px`, fontStyle: '800', color: '#07070d',
      }).setOrigin(0.5).setLetterSpacing(2).setDepth(15).setVisible(false),
    };
    this.visuals.push(v);
    return v;
  }
}
