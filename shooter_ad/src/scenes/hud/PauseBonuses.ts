import Phaser from 'phaser';
import { SQUAD, VIEW } from '../../config';
import { AXIS_COLOR, type BonusAxis } from '../../data/gates';
import { MAX_SENSE, senseChance } from '../../systems/Progression';
import { CardTile, TILE } from './CardTile';
import { standingColor } from './TopRail';
import { CAPTION, compact, FONT, formatMult, hex, MONO, SMALL, type HudPayload } from './types';

/** The roots a bonus can draw, at the bottom, middle and top of the range. */
const SAMPLE_ROOTS = [1.1, 1.25, 1.4] as const;

/** Every axis, in the order the DETAILS page multiplies them, then the RISK three. */
const AXES: readonly BonusAxis[] = ['army', 'damage', 'rate', 'guns', 'pierce', 'move', 'time', 'sense'];
const GRID_X = 18;
const GRID_Y = 298;
const GRID_GAP = 8;

interface Ruler {
  head: Phaser.GameObjects.Text;
  divide: Phaser.GameObjects.Text;
  lines: Phaser.GameObjects.Text[];
}

/**
 * The pause screen's BONUSES page: the conversion, taught against the
 * player's own pools, and every bonus held - as gate cards.
 *
 * A raw draw is scaled to your pool as `a = (root - 1) * (1 + pool)`, so
 * `+31% DMG` and `x1.1 DMG` are the same bonus at a +210% pool and wildly
 * different at an empty one. So the page does NOT state the formula and leave
 * it there: it prints a RULER - three offers the player could plausibly be
 * shown, each with the multiplier it is actually worth to them right now.
 *
 * Beneath the ruler, what you hold is eight card tiles in the field's own
 * anatomy (the author's call, 2026-09-20, over ten text rows): one per axis,
 * the magnitude the strip shows over the axis word, held tiles lit and unheld
 * tiles dim exactly as strip cells are. One line under the grid says what
 * the tapped tile does; it opens on ARMY and follows the finger, so the
 * teaching is one sentence at a time rather than ten at once. The three RISK
 * axes say so on the tile.
 */
export class PauseBonuses {
  readonly root: Phaser.GameObjects.Container;
  private readonly rulers: Ruler[] = [];
  private readonly tiles: CardTile[] = [];
  private readonly notes: string[] = AXES.map(() => '');
  private readonly note: Phaser.GameObjects.Text;
  private readonly noteHead: Phaser.GameObjects.Text;
  private readonly standing: Phaser.GameObjects.Text;
  private selected = 0;

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
    add(scene.add.text(cx, 252, 'as a pool grows, the same × needs a bigger +% to match it', {
      fontFamily: FONT, fontSize: '14px', color: SMALL, align: 'center',
    }).setOrigin(0.5, 0));

    add(scene.add.rectangle(cx, 276, VIEW.width - 52, 1, 0x2a3350));

    // The grid: four tiles a row, two rows, in DPS order then the RISK three.
    AXES.forEach((axis, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = GRID_X + TILE.width / 2 + col * (TILE.width + GRID_GAP);
      const y = GRID_Y + TILE.height / 2 + row * (TILE.height + GRID_GAP);
      const tile = new CardTile(scene, x, y, AXIS_COLOR[axis], TILE.width, TILE.height, axis === 'sense');
      for (const p of tile.parts) add(p);
      const hit = add(scene.add.rectangle(x, y, TILE.width, TILE.height, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true }));
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => { p.event.stopPropagation(); this.select(i); });
      this.tiles.push(tile);
    });

    // One line of teaching at a time, under the grid, headed by the axis;
    // the hint that says how sits between the grid and the line it explains.
    const gridBottom = GRID_Y + 2 * TILE.height + GRID_GAP;
    add(scene.add.text(cx, gridBottom + 8, 'tap a card for what it does', {
      fontFamily: FONT, fontSize: '14px', color: SMALL,
    }).setOrigin(0.5, 0));
    const noteY = gridBottom + 34;
    this.noteHead = add(scene.add.text(26, noteY, '', {
      fontFamily: FONT, fontSize: '14px', color: SMALL, fontStyle: 'bold',
    }).setOrigin(0, 0).setLetterSpacing(1.5));
    this.note = add(scene.add.text(26, noteY + 22, '', {
      fontFamily: FONT, fontSize: '16px', color: CAPTION, wordWrap: { width: VIEW.width - 52 },
    }).setOrigin(0, 0).setLineSpacing(4));

    // Your DPS against par, in the standing colour the rail uses for it.
    this.standing = add(scene.add.text(cx, 648, '', {
      fontFamily: FONT, fontSize: '16px', color: SMALL, fontStyle: 'bold',
    }).setOrigin(0.5, 0));

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

  private select(i: number): void {
    this.selected = i;
    this.tiles.forEach((t, j) => t.select(j === i));
    this.noteHead.setText(AXES[i].toUpperCase()).setColor(hex(AXIS_COLOR[AXES[i]]));
    this.note.setText(this.notes[i]);
  }

  private setTile(i: number, magnitude: string, axis: string, held: boolean, note: string): void {
    this.tiles[i].set(magnitude, axis).setHeld(held);
    this.notes[i] = note;
  }

  update(h: HudPayload): void {
    this.setRuler(0, 'DMG', h.damageBonus);
    this.setRuler(1, 'RATE', h.rateBonus);
    this.standing.setText(`${compact(h.dps)} DPS  ·  PAR ${compact(h.parDps)}`)
      .setColor(standingColor(h.parDps > 0 ? h.dps / h.parDps : 1));

    const mult12 = Math.max(1, Math.round(h.power * 0.2));
    this.setTile(0, compact(h.power), 'ARMY', true,
      `Your power: ${h.units}/${SQUAD.ringCap} bodies at rank ${h.tierName}. Every army bonus is a share of what you hold, so ×1.2 ARMY here = +${compact(mult12)}.`);
    this.setTile(1, `+${Math.round(h.damageBonus * 100)}%`,
      h.damageMult > 1 ? `DMG ${formatMult(h.damageMult)}` : 'DMG',
      h.damageBonus > 0 || h.damageMult > 1,
      'Every +% DMG adds into the pool, which multiplies base damage; every × DMG stacks into the mult, and the pool scales that too.');
    this.setTile(2, `+${Math.round(h.rateBonus * 100)}%`,
      h.rateMult > 1 ? `RATE ${formatMult(h.rateMult)}` : 'RATE',
      h.rateBonus > 0 || h.rateMult > 1,
      'Every +% RATE adds into the pool, which multiplies fire rate; every × RATE stacks into the mult, and the pool scales that too.');
    this.setTile(3, String(h.guns), 'GUNS', h.guns > 1,
      'Shots per volley, so DPS × guns. Past 3 held, +N GUNS offers grow with what you hold.');
    this.setTile(4, String(h.pierce), 'PIERCE', h.pierce > 0,
      `Bodies one shot goes through, worth ${formatMult(h.pierceMult)} now. Past 3 held, +N PIERCE offers grow. Worth nothing against one body: the Titan.`);
    this.setTile(5, formatMult(h.moveMult), 'MOVE RISK', h.moveMult > 1,
      'Squad speed. RISK: no DPS and par never takes it. It buys reaching the card you judged best; the run counts it as no growth.');
    const time = Math.round((1 / h.gateSpeedMult - 1) * 100);
    this.setTile(6, `+${time}%`, 'TIME RISK', time > 0,
      'Offers fall slower. RISK: no DPS and par never takes it. It buys seconds to do the sum; the run counts it as no growth.');
    const chances = Array.from({ length: MAX_SENSE }, (_, i) => Math.round(senseChance(i + 1) * 100));
    this.tiles[7].setPips(h.sense);
    this.setTile(7, '', `SENSE ${Math.round(h.senseChance * 100)}%`, h.sense > 0,
      `${Math.round(h.senseChance * 100)}% of offers arrive with the best card marked (${chances.join(' / ')}% at 1 / 2 / 3 held). RISK: no DPS and par never takes it.`);
    this.select(this.selected);
  }
}
