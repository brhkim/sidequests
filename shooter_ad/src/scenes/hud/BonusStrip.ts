import Phaser from 'phaser';
import { ARENA, VIEW } from '../../config';
import { AXIS_COLOR } from '../../data/gates';
import { formatMult, hex, type HudPayload } from './types';

/**
 * The active-bonus readout, directly beneath the breach line.
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
  { axis: 'damage' as const, label: 'DMG', width: 168 },
  { axis: 'rate' as const, label: 'RATE', width: 168 },
  { axis: 'guns' as const, label: 'GUNS', width: 102 },
  { axis: 'pierce' as const, label: 'PIERCE', width: 102 },
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
      const textX = x + 20;
      this.cells.push({
        accent: scene.add.rectangle(x + 10, TOP + 12, 3, 70, color, 0.9).setOrigin(0, 0),
        label: scene.add.text(textX, TOP + 10, spec.label, {
          fontFamily: 'system-ui, sans-serif', fontSize: '12px',
          color: hex(color), fontStyle: 'bold',
        }).setOrigin(0, 0).setLetterSpacing(1.2),
        main: scene.add.text(textX, TOP + 24, '', {
          fontFamily: 'system-ui, sans-serif', fontSize: '26px',
          color: '#f2f6ff', fontStyle: 'bold',
        }).setOrigin(0, 0),
        sub: scene.add.text(textX, TOP + 60, '', {
          fontFamily: 'system-ui, sans-serif', fontSize: '18px',
          color: '#8b99bb', fontStyle: 'bold',
        }).setOrigin(0, 0),
        last: '',
      });
      x += spec.width;
    }
  }

  update(h: HudPayload): void {
    // Sub-lines are blank at identity. Four columns of `x1.00` is four pieces
    // of furniture the eye has to step over to find the one that changed.
    this.set(0, `+${Math.round(h.damageBonus * 100)}%`, h.damageMult, h.damageBonus > 0);
    this.set(1, `+${Math.round(h.rateBonus * 100)}%`, h.rateMult, h.rateBonus > 0);
    this.set(2, String(h.guns), h.guns, h.guns > 1);
    // Pierce shows what it is actually worth, from the same valuation par
    // prices it with - a bare `2` says nothing about diminishing returns.
    this.set(3, String(h.pierce), h.pierceMult, h.pierce > 0);
  }

  reset(): void {
    for (const cell of this.cells) cell.last = '';
  }

  private set(index: number, main: string, mult: number, poolHeld: boolean): void {
    const cell = this.cells[index];
    cell.main.setText(main);
    cell.sub.setText(mult > 1 ? formatMult(mult) : '');

    const held = poolHeld || mult > 1;
    const alpha = held ? 1 : 0.32;
    cell.accent.setAlpha(held ? 0.9 : 0.22);
    cell.label.setAlpha(alpha);
    cell.main.setAlpha(alpha);
    cell.sub.setAlpha(0.95);

    // A gate you drove through has to register somewhere other than the toast,
    // which is already gone by the time the next offer appears.
    const signature = `${main}|${mult}`;
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
