import Phaser from 'phaser';
import { ARENA, VIEW } from '../../config';
import { AXIS_COLOR } from '../../data/gates';
import { compact, formatMult, hex, type HudPayload } from './types';

/**
 * The active-bonus readout, directly beneath the breach line: every input to
 * the DPS product, and nothing else.
 *
 * Why it has to exist: a raw bonus draws `a = (root - 1) * (1 + pool)`, so
 * `+31% DMG` against `×1.25 DMG` is only decidable if you know your damage pool
 * is 210%. Without the pool on screen the central judgement of the game is a
 * coin flip.
 *
 * Why it is here and not in a rail: the game is 540x960 portrait, and widening
 * the canvas shrinks the playfield badly under Scale.FIT on a phone. The eye is
 * already at the red line because that is where the threat resolves, so this
 * costs no extra attention.
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
 * - Values are LEFT-aligned off a coloured accent, so a digit appearing does
 *   not shuffle the whole cell sideways mid-wave.
 * - A cell you hold nothing on fades out, so what you actually have pops
 *   without needing to read any of it.
 */
const TOP = ARENA.breachY + 2;
const CELLS = [
  { axis: 'army' as const, label: 'ARMY', width: 100 },
  { axis: 'damage' as const, label: 'DMG', width: 128 },
  { axis: 'rate' as const, label: 'RATE', width: 128 },
  { axis: 'guns' as const, label: 'GUNS', width: 92 },
  { axis: 'pierce' as const, label: 'PIERCE', width: 92 },
];

interface Cell {
  accent: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  main: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
  last: string;
}

export class BonusStrip {
  private readonly cells: Cell[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    scene.add.rectangle(0, TOP, VIEW.width, VIEW.height - TOP, 0x0b0f1c, 0.96)
      .setOrigin(0, 0);

    let x = 0;
    for (const spec of CELLS) {
      const color = AXIS_COLOR[spec.axis];
      const textX = x + 18;
      this.cells.push({
        accent: scene.add.rectangle(x + 8, TOP + 12, 3, 70, color, 0.9).setOrigin(0, 0),
        label: scene.add.text(textX, TOP + 10, spec.label, {
          fontFamily: 'system-ui, sans-serif', fontSize: '12px',
          color: hex(color), fontStyle: 'bold',
        }).setOrigin(0, 0).setLetterSpacing(1.2),
        main: scene.add.text(textX, TOP + 24, '', {
          fontFamily: 'system-ui, sans-serif', fontSize: '26px',
          color: '#f2f6ff', fontStyle: 'bold',
        }).setOrigin(0, 0),
        sub: scene.add.text(textX, TOP + 61, '', {
          fontFamily: 'system-ui, sans-serif', fontSize: '15px',
          color: '#8b99bb', fontStyle: 'bold',
        }).setOrigin(0, 0),
        last: '',
      });
      x += spec.width;
    }
  }

  update(h: HudPayload): void {
    // Army: power, with the rank it buys underneath in the rank's own colour.
    // Always "held" - there is no identity for an army.
    this.set(0, compact(h.power), h.tierName.toUpperCase(), true, hex(h.tierColor));
    // Sub-lines are blank at identity. Four columns of `x1.00` is four pieces
    // of furniture the eye has to step over to find the one that changed.
    this.set(1, `+${Math.round(h.damageBonus * 100)}%`, multOrBlank(h.damageMult),
      h.damageBonus > 0 || h.damageMult > 1);
    this.set(2, `+${Math.round(h.rateBonus * 100)}%`, multOrBlank(h.rateMult),
      h.rateBonus > 0 || h.rateMult > 1);
    this.set(3, String(h.guns), multOrBlank(h.guns), h.guns > 1);
    // Pierce shows what it is actually worth, from the same valuation par
    // prices it with - a bare `2` says nothing about what a level buys.
    this.set(4, String(h.pierce), multOrBlank(h.pierceMult), h.pierce > 0);
  }

  reset(): void {
    for (const cell of this.cells) cell.last = '';
  }

  private set(index: number, main: string, sub: string, held: boolean, subColor = '#8b99bb'): void {
    const cell = this.cells[index];
    cell.main.setText(main);
    cell.sub.setText(sub).setColor(subColor);

    const alpha = held ? 1 : 0.32;
    cell.accent.setAlpha(held ? 0.9 : 0.22);
    cell.label.setAlpha(alpha);
    cell.main.setAlpha(alpha);
    cell.sub.setAlpha(0.95);

    // A gate you drove through has to register somewhere other than the toast,
    // which is already gone by the time the next offer appears.
    const signature = `${main}|${sub}`;
    if (cell.last !== '' && cell.last !== signature) this.flash(cell);
    cell.last = signature;
  }

  private flash(cell: Cell): void {
    this.scene.tweens.killTweensOf(cell.main);
    cell.main.setScale(1.15).setColor('#ffffff');
    this.scene.tweens.add({
      targets: cell.main, scale: 1, duration: 320, ease: 'Quad.easeOut',
      onComplete: () => cell.main.setColor('#f2f6ff'),
    });
  }
}

function multOrBlank(mult: number): string {
  return mult > 1 ? formatMult(mult) : '';
}
