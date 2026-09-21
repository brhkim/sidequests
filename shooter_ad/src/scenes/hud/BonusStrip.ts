import Phaser from 'phaser';
import { HUD_ROWS, VIEW } from '../../config';
import { RAIL_HEIGHT } from './TopRail';
import { AXIS_COLOR } from '../../data/gates';
import { compact, FONT, formatMult, hex, type HudPayload } from './types';

/** The strip's height; the field begins beneath the rail and the strip. */
export const STRIP_HEIGHT = HUD_ROWS.strip;

/**
 * The active-bonus readout, directly beneath the top rail: every input to
 * the DPS product, and nothing else.
 *
 * It sat beneath the breach line until the author played on a phone: the
 * thumb steering the squad covered it, and every conversion meant a glance
 * from the bottom of the screen to the top and back. Under the rail the two
 * readouts are one glance - the run above, the squad below it - and the
 * thumb covers nothing but ground. The cost is 94px of the descent hidden
 * behind the panel at the top, where an offer is furthest from mattering.
 *
 * Why it has to exist: a raw bonus draws `a = (root - 1) * (1 + pool)`, so
 * `+31% DMG` against `×1.25 DMG` is only decidable if you know your damage pool
 * is 210%. Without the pool on screen the central judgement of the game is a
 * coin flip.
 *
 * Why it is a strip and not a wider rail: the game is 540x960 portrait, and
 * widening the canvas shrinks the playfield badly under Scale.FIT on a phone.
 *
 * ARMY moved down here from the top rail. It is a conversion input exactly as
 * the pools are - `+120 ARMY` means nothing until you know you hold 504 - and
 * it was the one term of `squadDps` that lived at the other end of the screen
 * from the rest. Five cells now, in the order the pause screen's DETAILS page
 * multiplies them: bodies, damage, rate, guns, pierce.
 *
 * Three things do the legibility work in a 540x94 strip:
 *
 * - The POOL is the big number and the multiplier is the small one, because
 *   the pool is what the conversion needs and the multiplier cancels out of it.
 * - Values are LEFT-aligned, so a digit appearing does not shuffle the whole
 *   cell sideways mid-wave. Cells are parted by 1px hairlines; the axis
 *   colour is on the label, and a coloured side stripe on top of it said
 *   the same thing twice.
 * - A cell you hold nothing on fades, so what you actually have pops without
 *   needing to read any of it - to 0.55, not further, so it still reads.
 *
 * A cell that changes flashes in the colour of WHY it changed: the grade of
 * the pick, green for army gained, red for army lost. `prime` sets that
 * colour from the event; the next change spends it.
 */
const TOP = RAIL_HEIGHT;
const CELLS = [
  { axis: 'army' as const, label: 'ARMY', width: 100 },
  { axis: 'damage' as const, label: 'DMG', width: 128 },
  { axis: 'rate' as const, label: 'RATE', width: 128 },
  { axis: 'guns' as const, label: 'GUNS', width: 92 },
  { axis: 'pierce' as const, label: 'PIERCE', width: 92 },
];
const MAIN = '#f2f6ff';

interface Cell {
  label: Phaser.GameObjects.Text;
  main: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
  last: string;
}

export class BonusStrip {
  private readonly cells: Cell[] = [];
  private readonly floater: Phaser.GameObjects.Text;
  private pending: number | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    scene.add.rectangle(0, TOP, VIEW.width, STRIP_HEIGHT, 0x0b0f1c, 0.96)
      .setOrigin(0, 0);
    scene.add.rectangle(0, TOP + STRIP_HEIGHT, VIEW.width, 1, 0x2a3350, 1).setOrigin(0, 0);

    let x = 0;
    for (const spec of CELLS) {
      const color = AXIS_COLOR[spec.axis];
      const textX = x + 18;
      if (x > 0) scene.add.rectangle(x, TOP + 12, 1, 70, 0x2a3350, 1).setOrigin(0, 0);
      this.cells.push({
        label: scene.add.text(textX, TOP + 10, spec.label, {
          fontFamily: FONT, fontSize: '14px', color: hex(color), fontStyle: 'bold',
        }).setOrigin(0, 0).setLetterSpacing(1.2),
        main: scene.add.text(textX, TOP + 24, '', {
          fontFamily: FONT, fontSize: '26px', color: MAIN, fontStyle: 'bold',
        }).setOrigin(0, 0),
        sub: scene.add.text(textX, TOP + 61, '', {
          fontFamily: FONT, fontSize: '17px', color: '#8b99bb', fontStyle: 'bold',
        }).setOrigin(0, 0),
        last: '',
      });
      x += spec.width;
    }
    // `-N` / `+N` over the ARMY cell, rising out of the strip.
    this.floater = scene.add.text(50, TOP + 4, '', {
      fontFamily: FONT, fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 1).setStroke('#05070f', 3).setDepth(1).setVisible(false);
  }

  update(h: HudPayload): void {
    // Army: power alone. The rank word sat beneath it in the rank's colour
    // until 2026-09-20; the author dropped it ("it stopped being relevant a
    // long time ago") - the shirts on the field already say it. Always
    // "held" - there is no identity for an army.
    this.set(0, compact(h.power), '', true);
    // Sub-lines are blank at identity. Four columns of `x1.00` is four pieces
    // of furniture the eye has to step over to find the one that changed.
    this.set(1, `+${compact(h.damageBonus * 100)}%`, multOrBlank(h.damageMult),
      h.damageBonus > 0 || h.damageMult > 1);
    this.set(2, `+${compact(h.rateBonus * 100)}%`, multOrBlank(h.rateMult),
      h.rateBonus > 0 || h.rateMult > 1);
    this.set(3, compact(h.guns), multOrBlank(h.guns), h.guns > 1);
    // Pierce shows what it is actually worth, from the same valuation par
    // prices it with - a bare `2` says nothing about what a level buys.
    this.set(4, compact(h.pierce), multOrBlank(h.pierceMult), h.pierce > 0);
    this.pending = null;
  }

  /** The colour the next changed cell flashes in; spent by the next `update`. */
  prime(color: number): void { this.pending = color; }

  /** Flash a cell now, whatever changed, e.g. ARMY on a batch of fire hits. */
  flashCell(index: number, color: number, ms = 500): void {
    this.flash(this.cells[index], color, ms);
  }

  /** `-3` or `+5` rising out of the ARMY cell. */
  float(text: string, color: number): void {
    const f = this.floater;
    this.scene.tweens.killTweensOf(f);
    f.setText(text).setColor(hex(color)).setPosition(50, TOP + 4).setAlpha(1).setVisible(true);
    this.scene.tweens.add({
      targets: f, y: TOP - 22, alpha: 0, duration: 700, ease: 'Quad.easeOut',
      onComplete: () => f.setVisible(false),
    });
  }

  reset(): void {
    for (const cell of this.cells) cell.last = '';
    this.pending = null;
    this.scene.tweens.killTweensOf(this.floater);
    this.floater.setVisible(false);
  }

  private set(index: number, main: string, sub: string, held: boolean, subColor = '#8b99bb'): void {
    const cell = this.cells[index];
    cell.main.setText(main);
    cell.sub.setText(sub).setColor(subColor);

    const alpha = held ? 1 : 0.55;
    cell.label.setAlpha(alpha);
    cell.main.setAlpha(alpha);
    cell.sub.setAlpha(0.95);

    // A gate you drove through has to register somewhere other than the field,
    // where the wash is already gone by the time the next offer appears.
    const signature = `${main}|${sub}`;
    if (cell.last !== '' && cell.last !== signature) this.flash(cell, this.pending ?? 0xffffff, 500);
    cell.last = signature;
  }

  private flash(cell: Cell, color: number, ms: number): void {
    this.scene.tweens.killTweensOf(cell.main);
    cell.main.setScale(1.15).setColor(hex(color));
    this.scene.tweens.add({
      targets: cell.main, scale: 1, duration: ms, ease: 'Quad.easeOut',
      onComplete: () => cell.main.setColor(MAIN),
    });
  }
}

function multOrBlank(mult: number): string {
  return mult > 1 ? formatMult(mult) : '';
}
