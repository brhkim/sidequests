import Phaser from 'phaser';
import { SQUAD, VIEW } from '../../config';
import { AXIS_COLOR } from '../../data/gates';
import { MAX_SENSE, senseChance } from '../../systems/Progression';
import { sensePips } from './TopRail';
import { CAPTION, compact, FONT, formatMult, hex, MONO, SMALL, type HudPayload } from './types';

/** The roots a bonus can draw, at the bottom, middle and top of the range. */
const SAMPLE_ROOTS = [1.1, 1.25, 1.4] as const;

/** Every held bonus, in the order the DETAILS page multiplies them. */
const ROWS = [
  'army', 'damage', 'damage', 'rate', 'rate', 'guns', 'pierce', 'move', 'time', 'sense',
] as const;

interface Row {
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
 * The pause screen's BONUSES page: the conversion, taught against the
 * player's own pools, and every bonus held.
 *
 * A raw draw is scaled to your pool as `a = (root - 1) * (1 + pool)`, so
 * `+31% DMG` and `x1.1 DMG` are the same bonus at a +210% pool and wildly
 * different at an empty one. So the page does NOT state the formula and leave
 * it there: it prints a RULER - three offers the player could plausibly be
 * shown, each with the multiplier it is actually worth to them right now -
 * and then one row per bonus, MOVE, TIME and SENSE included, each saying in a
 * line what it does to the sum (or that it does not enter it, and what it
 * buys instead). On an unheld row the VALUE dims and the label and note
 * stay at 0.75 or above: the note is the teaching, and the row you do not
 * hold is the one you are about to be offered. No coloured side stripes -
 * the label already wears the axis colour.
 */
export class PauseBonuses {
  readonly root: Phaser.GameObjects.Container;
  private readonly rulers: Ruler[] = [];
  private readonly rows: Row[] = [];
  private readonly standing: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const cx = VIEW.width / 2;
    const b: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { b.push(o); return o; };

    add(scene.add.text(cx, 98, 'stat  =  base × (1 + pool) × mult', {
      fontFamily: FONT, fontSize: '16px', color: SMALL,
    }).setOrigin(0.5, 0));

    // Two rulers side by side, because damage and rate are separate pools and
    // a player deep in one is often empty in the other - seeing the same
    // offer convert differently per axis is the lesson.
    for (const [i, axis] of (['damage', 'rate'] as const).entries()) {
      const x = 26 + i * 254;
      const color = AXIS_COLOR[axis];
      const head = add(scene.add.text(x, 118, '', {
        fontFamily: FONT, fontSize: '16px', color: hex(color), fontStyle: 'bold',
      }).setOrigin(0, 0));
      const divide = add(scene.add.text(x, 138, '', {
        fontFamily: FONT, fontSize: '14px', color: CAPTION,
      }).setOrigin(0, 0));
      const lines = SAMPLE_ROOTS.map((_, r) => add(scene.add.text(x, 160 + r * 22, '', {
        fontFamily: MONO, fontSize: '17px', color: '#e8ecf8', fontStyle: 'bold',
      }).setOrigin(0, 0)));
      this.rulers.push({ head, divide, lines });
    }

    add(scene.add.text(cx, 232, 'Neither form is better — convert, then take the bigger one.', {
      fontFamily: FONT, fontSize: '15px', color: '#9fe8ff', align: 'center',
    }).setOrigin(0.5, 0));
    add(scene.add.text(cx, 250, 'as a pool grows, the same × needs a bigger +% to match it', {
      fontFamily: FONT, fontSize: '14px', color: SMALL, align: 'center',
    }).setOrigin(0.5, 0));

    add(scene.add.rectangle(cx, 270, VIEW.width - 52, 1, 0x2a3350));
    add(scene.add.text(26, 278, 'WHAT YOU HOLD', {
      fontFamily: FONT, fontSize: '14px', color: SMALL, fontStyle: 'bold',
    }).setOrigin(0, 0).setLetterSpacing(1.5));
    this.standing = add(scene.add.text(VIEW.width - 26, 278, '', {
      fontFamily: FONT, fontSize: '14px', color: SMALL, fontStyle: 'bold',
    }).setOrigin(1, 0));

    for (const [i, axis] of ROWS.entries()) {
      const y = 298 + i * 40;
      const color = AXIS_COLOR[axis];
      this.rows.push({
        label: add(scene.add.text(28, y - 1, '', {
          fontFamily: FONT, fontSize: '14px', color: hex(color), fontStyle: 'bold',
        }).setOrigin(0, 0).setLetterSpacing(1)),
        value: add(scene.add.text(VIEW.width - 26, y - 2, '', {
          fontFamily: FONT, fontSize: '20px', color: '#f2f6ff', fontStyle: 'bold',
        }).setOrigin(1, 0)),
        note: add(scene.add.text(28, y + 15, '', {
          fontFamily: FONT, fontSize: '15px', color: CAPTION,
        }).setOrigin(0, 0)),
      });
    }
    this.root = scene.add.container(0, 0, b);
  }

  /**
   * The ruler: what an offer drawn at each end and the middle of the root
   * range would be SHOWN as, given this pool, and what it is therefore worth.
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

  private setRow(index: number, label: string, value: string, note: string, held: boolean): void {
    const row = this.rows[index];
    row.label.setText(label);
    row.value.setText(value);
    row.note.setText(note);
    row.label.setAlpha(held ? 1 : 0.75);
    row.value.setAlpha(held ? 1 : 0.45);
    row.note.setAlpha(held ? 0.85 : 0.75);
  }

  update(h: HudPayload): void {
    this.setRuler(0, 'DMG', h.damageBonus);
    this.setRuler(1, 'RATE', h.rateBonus);
    this.standing.setText(`${compact(h.dps)} DPS  ·  PAR ${compact(h.parDps)}`);

    // Army converts too, and does it without a pool term - the army IS the
    // base - so the worked number is the offer itself rather than a rate.
    const mult12 = Math.max(1, Math.round(h.power * 0.2));
    this.setRow(0, 'ARMY', compact(h.power),
      `power: ${h.units}/${SQUAD.ringCap} bodies and their rank · ×1.2 ARMY here = +${compact(mult12)}`,
      true);
    this.setRow(1, 'DMG POOL', `+${Math.round(h.damageBonus * 100)}%`,
      'every +% DMG adds up here, then multiplies base damage', h.damageBonus > 0);
    this.setRow(2, 'DMG MULT', formatMult(h.damageMult),
      'every × DMG stacks here; the pool then scales it as well', h.damageMult > 1);
    this.setRow(3, 'RATE POOL', `+${Math.round(h.rateBonus * 100)}%`,
      'every +% RATE adds up here, then multiplies fire rate', h.rateBonus > 0);
    this.setRow(4, 'RATE MULT', formatMult(h.rateMult),
      'every × RATE stacks here; the pool then scales it as well', h.rateMult > 1);
    this.setRow(5, 'GUNS', String(h.guns),
      'shots per volley, so DPS × guns · +N GUNS offers grow past 3', h.guns > 1);
    this.setRow(6, 'PIERCE', String(h.pierce),
      `bodies one shot goes through · worth ${formatMult(h.pierceMult)} now · grows past 3`,
      h.pierce > 0);
    // The three RISK axes: worth zero to the scoring, never taken by par.
    // Taking one is told RISK on the field, not graded, and counts as no
    // growth in the end screen's percentage. Said the same way on each row.
    this.setRow(7, 'MOVE', formatMult(h.moveMult),
      'squad speed · RISK: no DPS, par never takes it', h.moveMult > 1);
    const time = Math.round((1 / h.gateSpeedMult - 1) * 100);
    this.setRow(8, 'TIME', `+${time}%`,
      'offers fall slower · RISK: no DPS, par never takes it', time > 0);
    const chances = Array.from({ length: MAX_SENSE }, (_, i) => Math.round(senseChance(i + 1) * 100));
    this.setRow(9, 'SENSE', sensePips(h.sense),
      // Short enough at 15px to clear the pips on the right.
      `${Math.round(h.senseChance * 100)}% of offers best-marked · RISK: no DPS · ${chances.join('/')}% at 1/2/3`,
      h.sense > 0);
  }
}
