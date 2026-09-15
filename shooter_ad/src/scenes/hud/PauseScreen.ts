import Phaser from 'phaser';
import { SQUAD, VIEW } from '../../config';
import { AXIS_COLOR } from '../../data/gates';
import { compact, formatMult, hex, type HudPayload } from './types';

/**
 * Where the pause control lives. GameScene hit-tests this rectangle itself
 * rather than letting an interactive object in the UI scene do it, because a
 * tap that reaches BOTH scenes pauses the game and simultaneously orders the
 * squad to walk to x=486 - which it then does the moment you resume.
 */
export const PAUSE_BUTTON = { x: 486, y: 100, width: 88, height: 38 } as const;

const FONT = 'system-ui, sans-serif';
const MUTED = '#8f9ab5';
const FAINT = '#6f7a94';

/** The roots a bonus can draw, at the bottom, middle and top of the range. */
const SAMPLE_ROOTS = [1.1, 1.25, 1.4] as const;

interface Row {
  accent: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  note: Phaser.GameObjects.Text;
}

interface Ruler {
  head: Phaser.GameObjects.Text;
  divide: Phaser.GameObjects.Text;
  lines: Phaser.GameObjects.Text[];
}

/**
 * Pause, and the only place the game explains itself.
 *
 * The mechanic is a conversion: a raw draw is scaled to your pool as
 * `a = (root - 1) * (1 + pool)`, so `+31% DMG` and `x1.1 DMG` are the same
 * bonus at a +210% pool and wildly different at an empty one. A player who has
 * not worked that out reads every offer as noise and the game is unplayable as
 * designed.
 *
 * So this screen does NOT state the formula and leave it there. It prints a
 * RULER against the player's own pools: three offers they could plausibly be
 * shown, each with the multiplier it is actually worth to them right now. That
 * is usable inside ten seconds, which an algebraic identity is not, and it
 * re-teaches itself every time the pool moves because the numbers change.
 *
 * Rejected: a worked table of before/after damage (true, but the player does
 * not care what 15.5 becomes, they care which of two labels is bigger); and
 * colouring the forms differently, which would answer the question for them.
 */
export class PauseScreen {
  private readonly root: Phaser.GameObjects.Container;
  private readonly rulers: Ruler[] = [];
  private readonly rows: Row[] = [];
  private readonly standing: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, onResume: () => void, onRestart: () => void) {
    const cx = VIEW.width / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { parts.push(o); return o; };

    add(scene.add.rectangle(cx, VIEW.height / 2, VIEW.width, VIEW.height, 0x05070f, 1));

    add(scene.add.text(cx, 34, 'PAUSED', {
      fontFamily: FONT, fontSize: '30px', color: '#e8ecf8', fontStyle: 'bold',
    }).setOrigin(0.5, 0));
    add(scene.add.text(cx, 74, 'stat  =  base × (1 + pool) × mult', {
      fontFamily: FONT, fontSize: '15px', color: FAINT,
    }).setOrigin(0.5, 0));

    // The teaching block. Two rulers side by side, because damage and rate are
    // separate pools and a player deep in one is often empty in the other -
    // seeing the same offer convert differently per axis is the lesson.
    for (const [i, axis] of (['damage', 'rate'] as const).entries()) {
      const x = 26 + i * 254;
      const color = AXIS_COLOR[axis];
      add(scene.add.rectangle(x - 10, 118, 3, 118, color, 0.9).setOrigin(0, 0));
      const head = add(scene.add.text(x, 116, '', {
        fontFamily: FONT, fontSize: '15px', color: hex(color), fontStyle: 'bold',
      }).setOrigin(0, 0));
      const divide = add(scene.add.text(x, 138, '', {
        fontFamily: FONT, fontSize: '12px', color: MUTED,
      }).setOrigin(0, 0));
      const lines = SAMPLE_ROOTS.map((_, r) => add(scene.add.text(x, 164 + r * 24, '', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '16px', color: '#e8ecf8', fontStyle: 'bold',
      }).setOrigin(0, 0)));
      this.rulers.push({ head, divide, lines });
    }

    add(scene.add.text(
      cx, 244,
      'Neither form is better — convert, then take the bigger one.',
      { fontFamily: FONT, fontSize: '14px', color: '#9fe8ff', align: 'center' },
    ).setOrigin(0.5, 0));
    add(scene.add.text(
      cx, 264,
      'as a pool grows, the same × needs a bigger +% to match it',
      { fontFamily: FONT, fontSize: '12px', color: FAINT, align: 'center' },
    ).setOrigin(0.5, 0));

    add(scene.add.rectangle(cx, 286, VIEW.width - 52, 1, 0x2a3350));
    add(scene.add.text(26, 296, 'WHAT YOU HOLD', {
      fontFamily: FONT, fontSize: '12px', color: FAINT, fontStyle: 'bold',
    }).setOrigin(0, 0).setLetterSpacing(1.4));
    this.standing = add(scene.add.text(VIEW.width - 26, 296, '', {
      fontFamily: FONT, fontSize: '12px', color: FAINT, fontStyle: 'bold',
    }).setOrigin(1, 0));

    const AXES = ['army', 'damage', 'damage', 'rate', 'rate', 'guns', 'pierce'] as const;
    for (const [i, axis] of AXES.entries()) {
      const y = 324 + i * 50;
      const color = AXIS_COLOR[axis];
      this.rows.push({
        accent: add(scene.add.rectangle(16, y + 2, 3, 36, color, 0.9).setOrigin(0, 0)),
        label: add(scene.add.text(28, y, '', {
          fontFamily: FONT, fontSize: '13px', color: hex(color), fontStyle: 'bold',
        }).setOrigin(0, 0).setLetterSpacing(1)),
        value: add(scene.add.text(VIEW.width - 26, y - 2, '', {
          fontFamily: FONT, fontSize: '22px', color: '#f2f6ff', fontStyle: 'bold',
        }).setOrigin(1, 0)),
        note: add(scene.add.text(28, y + 18, '', {
          fontFamily: FONT, fontSize: '12px', color: MUTED,
        }).setOrigin(0, 0)),
      });
    }

    button(scene, add, 714, 'RESUME', 0x3ecf7a, onResume);
    button(scene, add, 794, 'RESTART', 0xff4757, onRestart);

    add(scene.add.text(cx, 872, 'P or ESC also pauses and resumes', {
      fontFamily: FONT, fontSize: '13px', color: '#4d5670',
    }).setOrigin(0.5, 0));

    // Hidden until asked for. A container is VISIBLE by default, and an opaque
    // full-screen panel at depth 55 that nobody requested covers the entire
    // game - which is exactly the bug the start screen shipped.
    this.root = scene.add.container(0, 0, parts).setDepth(55).setVisible(false);
  }

  /**
   * The ruler: what an offer drawn at each end and the middle of the root range
   * would be SHOWN as, given this pool, and what it is therefore worth.
   *
   * Both columns are the same three underlying draws, so the row the player
   * recognises on one side hands them the answer on the other.
   */
  private setRuler(index: number, word: string, pool: number): void {
    const r = this.rulers[index];
    const factor = 1 + pool;
    r.head.setText(`${word} POOL  +${Math.round(pool * 100)}%`);
    // At an empty pool the two forms are literally the same offer, which is
    // worth saying outright - the ruler alone looks like a rounding coincidence.
    r.divide.setText(pool > 0
      ? `a shown +%  ÷ ${factor.toFixed(2)}  →  its ×`
      : 'at +0% both forms are identical');
    SAMPLE_ROOTS.forEach((rootValue, i) => {
      const percent = Math.round((rootValue - 1) * factor * 100);
      r.lines[i].setText(`+${percent}%  ≡  ×${rootValue.toFixed(2)}`);
    });
  }

  private setRow(
    index: number, label: string, value: string, note: string, held: boolean,
  ): void {
    const row = this.rows[index];
    row.label.setText(label);
    row.value.setText(value);
    row.note.setText(note);
    const alpha = held ? 1 : 0.34;
    row.accent.setAlpha(held ? 0.9 : 0.2);
    row.label.setAlpha(alpha);
    row.value.setAlpha(alpha);
    row.note.setAlpha(held ? 0.85 : 0.3);
  }

  update(h: HudPayload): void {
    this.setRuler(0, 'DMG', h.damageBonus);
    this.setRuler(1, 'RATE', h.rateBonus);

    this.standing.setText(`${compact(h.dps)} DPS  ·  PAR ${compact(h.parDps)}`);

    // Army converts too, and does it without a pool term - the army IS the
    // base - so the worked number is the offer itself rather than a rate.
    const mult12 = Math.max(1, Math.round(h.power * 0.2));
    this.setRow(0, 'ARMY', compact(h.power),
      `${h.units}/${SQUAD.ringCap} on screen · here ×1.2 ARMY = +${compact(mult12)}`, true);
    this.setRow(1, 'DMG POOL', `+${Math.round(h.damageBonus * 100)}%`,
      'every +% DMG lands here, and scales every ×', h.damageBonus > 0);
    this.setRow(2, 'DMG MULT', formatMult(h.damageMult),
      'multiplies base damage, which the pool then amplifies', h.damageMult > 1);
    this.setRow(3, 'RATE POOL', `+${Math.round(h.rateBonus * 100)}%`,
      'every +% RATE lands here, and scales every ×', h.rateBonus > 0);
    this.setRow(4, 'RATE MULT', formatMult(h.rateMult),
      'multiplies base fire rate, which the pool amplifies', h.rateMult > 1);
    this.setRow(5, 'GUNS', String(h.guns),
      'bullets per volley — a flat multiplier on everything', h.guns > 1);
    this.setRow(6, 'PIERCE', String(h.pierce),
      `bodies hit per bullet — priced at ${formatMult(h.pierceMult)}`, h.pierce > 0);
  }

  show(h: HudPayload): void {
    this.update(h);
    this.root.setVisible(true);
  }

  hide(): void { this.root.setVisible(false); }

  get visible(): boolean { return this.root.visible; }
}

type Adder = <T extends Phaser.GameObjects.GameObject>(o: T) => T;

function button(
  scene: Phaser.Scene, add: Adder, y: number,
  text: string, color: number, onTap: () => void,
): void {
  const cx = VIEW.width / 2;
  const rect = add(scene.add.rectangle(cx, y, 280, 58, color, 0.16)
    .setStrokeStyle(2, color, 0.9)
    .setInteractive({ useHandCursor: true }));
  rect.on('pointerdown', (p: Phaser.Input.Pointer) => {
    // Stop the tap also reaching the game underneath.
    p.event.stopPropagation();
    onTap();
  });
  add(scene.add.text(cx, y, text, {
    fontFamily: FONT, fontSize: '21px', color: hex(color), fontStyle: 'bold',
  }).setOrigin(0.5));
}
