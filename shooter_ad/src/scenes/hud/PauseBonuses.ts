import Phaser from 'phaser';
import { SQUAD, VIEW } from '../../config';
import { AXIS_COLOR, type BonusAxis } from '../../data/gates';
import { MAX_ECHO, MAX_MOVE, MAX_SENSE, MAX_SHIELD, senseChance } from '../../systems/Progression';
import { ECHO, MOVE, SHIELD } from '../../config';
import { SCREEN_PIXEL } from '../art/screens';
import { INK, SURFACE } from '../theme';
import { CardTile } from './CardTile';
import { standingColor } from './TopRail';
import { compact, FONT, formatMult, GRADE_COLOR, hex, MONO, type HudPayload } from './types';

/** The roots a bonus can draw, at the bottom, middle and top of the range. */
const SAMPLE_ROOTS = [1.1, 1.25, 1.4] as const;

/** Every axis, in the order the DETAILS page multiplies them, then the INVEST four. */
const AXES: readonly BonusAxis[] = ['army', 'damage', 'rate', 'guns', 'pierce', 'echo', 'move', 'time', 'sense', 'shield'];
/** Where each axis sits in the 4x3 grid: six DPS axes over two rows, the INVEST four the third. */
const SLOT = [0, 1, 2, 3, 4, 5, 8, 9, 10, 11] as const;
const GRID = { x: 22, y: 288, cols: 4, gap: 5, rowGap: 6 } as const;
/**
 * Ten notes on a 4x3 grid of the field note's width, shorter (120x64
 * against 120x88) so the page still has room for the ruler above and a
 * five-line note below. The four INVEST axes take the whole third row and
 * the two free slots of the second row name them, so a tile's caption is
 * only ever its axis word - `MOVE INVEST` ran past a 120px tile.
 */
const PAUSE_TILE = { width: 120, height: 64 } as const;
const NOTE_Y = 506;
const MARGIN = 26;

interface Ruler {
  head: Phaser.GameObjects.Text;
  divide: Phaser.GameObjects.Text;
  lines: Phaser.GameObjects.Text[];
}

/**
 * The pause screen's BONUSES page: the conversion, taught against the
 * player's own pools, and every bonus held - as notes.
 *
 * A raw draw is scaled to your pool as `a = (root - 1) * (1 + pool)`, so
 * `+31% DMG` and `x1.1 DMG` are the same bonus at a +210% pool and wildly
 * different at an empty one. So the page does NOT state the formula and leave
 * it there: it prints a RULER - three offers the player could plausibly be
 * shown, each with the multiplier it is actually worth to them right now.
 *
 * Beneath the ruler, what you hold is ten notes in the field's anatomy (the
 * author's call, 2026-09-20, over ten text rows): the magnitude the strip
 * shows over the axis word, held notes lit and unheld dim. The line under
 * the grid says what the tapped note does; it opens on ARMY and follows the
 * finger, so the teaching is one sentence at a time.
 *
 * Every note is written for somebody who has not read HOW TO PLAY (the
 * author, 2026-09-20): a term is explained where it is used.
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
    const text = (x: number, y: number, s: string, size: number, color: string, weight = '500') =>
      add(scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: weight }));

    text(cx, 118, 'a +% card adds to a pool you keep  ·  a × card multiplies', 15, '#9fe8ff').setOrigin(0.5, 0);

    // Two rulers side by side, because damage and rate are separate pools and
    // a player deep in one is often empty in the other - seeing the same
    // offer convert differently per axis is the lesson.
    for (const [i, axis] of (['damage', 'rate'] as const).entries()) {
      const x = MARGIN + i * 254;
      const head = text(x, 146, '', 15, hex(AXIS_COLOR[axis]), '700').setLetterSpacing(0.6);
      const divide = text(x, 166, '', 14, INK.caption);
      const lines = SAMPLE_ROOTS.map((_, r) => add(scene.add.text(x, 188 + r * 21, '', {
        fontFamily: MONO, fontSize: '16px', color: INK.primary, fontStyle: 'bold',
      })));
      this.rulers.push({ head, divide, lines });
    }

    text(cx, 254, 'Neither kind is better. Convert, then take the bigger one.', 15, '#9fe8ff').setOrigin(0.5, 0);
    add(scene.add.image(cx, 280, SCREEN_PIXEL).setDisplaySize(VIEW.width - 52, 1).setTint(SURFACE.hairline));

    const at = (slot: number) => {
      const col = slot % GRID.cols, row = Math.floor(slot / GRID.cols);
      return {
        x: GRID.x + PAUSE_TILE.width / 2 + col * (PAUSE_TILE.width + GRID.gap),
        y: GRID.y + PAUSE_TILE.height / 2 + row * (PAUSE_TILE.height + GRID.rowGap),
      };
    };
    AXES.forEach((axis, i) => {
      const { x, y } = at(SLOT[i]);
      const tile = new CardTile(scene, x, y, AXIS_COLOR[axis], PAUSE_TILE.width, PAUSE_TILE.height, axis === 'sense', 24);
      for (const p of tile.parts) add(p);
      // A fixed hit area over the whole note, taller than the 44px floor.
      const hit = add(scene.add.zone(x, y, PAUSE_TILE.width, PAUSE_TILE.height).setInteractive({ useHandCursor: true }));
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => { p.event.stopPropagation(); this.select(i); });
      this.tiles.push(tile);
    });

    // The two free slots of the second row name the row beneath them: the
    // INVEST word in its grade colour, and what it means.
    const label = at(6);
    const lx = label.x - PAUSE_TILE.width / 2 + 10;
    text(lx, label.y - 20, 'INVEST', 20, hex(GRADE_COLOR.risk), 'italic 800').setLetterSpacing(1).setPadding(0, 0, 8, 0);
    text(lx, label.y + 6, 'the row below adds no damage', 14, INK.secondary);

    // One line of teaching at a time, under the grid, headed by the axis,
    // with the hint that says how at the head's right.
    this.noteHead = text(MARGIN, NOTE_Y, '', 14, INK.caption, '700').setLetterSpacing(1.6);
    text(VIEW.width - MARGIN, NOTE_Y + 1, 'tap a card for what it does', 13, INK.caption).setOrigin(1, 0);
    this.note = add(scene.add.text(MARGIN, NOTE_Y + 24, '', {
      fontFamily: FONT, fontSize: '16px', color: INK.secondary, fontStyle: '500',
      wordWrap: { width: VIEW.width - MARGIN * 2 },
    }).setLineSpacing(3));

    // Your DPS against par, in the standing colour the rail uses for it.
    add(scene.add.image(cx, 678, SCREEN_PIXEL).setDisplaySize(VIEW.width - 52, 1).setTint(SURFACE.hairline));
    text(MARGIN, 690, 'YOU  ·  THE SHADOW PLAYER', 13, INK.caption, '600').setLetterSpacing(1.2);
    this.standing = text(VIEW.width - MARGIN, 686, '', 17, INK.caption, '800').setOrigin(1, 0);

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
    r.head.setText(`YOUR ${word} POOL  +${Math.round(pool * 100)}%`);
    // At an empty pool the two forms are literally the same offer, which is
    // worth saying outright - the ruler alone looks like a rounding coincidence.
    r.divide.setText(pool > 0
      ? `a +% card ÷ ${factor.toFixed(2)}  =  its ×`
      : 'at +0% both kinds are the same');
    SAMPLE_ROOTS.forEach((rootValue, i) => {
      const percent = Math.round((rootValue - 1) * factor * 100);
      // Padded so the `=` column holds when a pool pushes a figure to three digits.
      r.lines[i].setText(`${`+${percent}%`.padEnd(6)} =  ×${rootValue.toFixed(2)}`);
    });
  }

  private select(i: number): void {
    this.selected = i;
    this.tiles.forEach((t, j) => t.select(j === i));
    const invest = i >= 6;
    this.noteHead.setText(invest ? `${AXES[i].toUpperCase()}  ·  INVEST` : AXES[i].toUpperCase())
      .setColor(hex(AXIS_COLOR[AXES[i]]));
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
      `Your soldiers. ${h.units} of ${SQUAD.ringCap} are on screen; power past that makes each one stronger. An ARMY card adds soldiers as a share of what you hold, so ×1.2 ARMY right now = +${compact(mult12)}.`);
    this.setTile(1, `+${Math.round(h.damageBonus * 100)}%`,
      h.damageMult > 1 ? `DMG ${formatMult(h.damageMult)}` : 'DMG',
      h.damageBonus > 0 || h.damageMult > 1,
      `Damage per shot. A +% DMG card adds to your damage pool (now +${Math.round(h.damageBonus * 100)}%); a × DMG card multiplies on top of it (now ${formatMult(h.damageMult)}). Both raise the same number.`);
    this.setTile(2, `+${Math.round(h.rateBonus * 100)}%`,
      h.rateMult > 1 ? `RATE ${formatMult(h.rateMult)}` : 'RATE',
      h.rateBonus > 0 || h.rateMult > 1,
      `Shots per second. Works exactly like DMG: a +% RATE card adds to the rate pool (now +${Math.round(h.rateBonus * 100)}%), a × RATE card multiplies on top (now ${formatMult(h.rateMult)}).`);
    this.setTile(3, String(h.guns), 'GUNS', h.guns > 1,
      `Shots fired at once. ${h.guns === 1 ? 'Two guns is double the damage.' : `${h.guns} guns is ${h.guns}× the damage.`} Past 3 held, a card offers +2 or more so it stays worth taking.`);
    this.setTile(4, String(h.pierce), 'PIERCE', h.pierce > 0,
      `Enemies one shot passes through. Each level is worth half a hit more (${formatMult(h.pierceMult)} right now). Worth nothing against a lone body like the Titan.`);
    this.setTile(5, String(h.echo), 'ECHO', h.echo > 0,
      `Ghost armies beside yours that fire what you fire: a half-size one on the left at 1 held, one on the right at 2, then each grows to full at 3 and 4 (${MAX_ECHO} max). They take no damage and block nothing; a ghost pushed off the edge fires into nothing. PAR counts a full one as ${Math.round(ECHO.value * 100)}% of your army (${formatMult(h.echoMult)} right now).`);
    const moveLadder = MOVE.mult.slice(1).map((m) => formatMult(m)).join(' / ');
    this.setTile(6, formatMult(h.moveMult), 'MOVE', h.move > 0,
      `How fast your squad walks: ${moveLadder} at 1 / 2 / 3 held (${h.move} of ${MAX_MOVE}). Adds no damage, so it is an INVEST card: it helps you reach the card you want, but the shadow player (PAR) never takes it and the score counts it as no growth.`);
    const time = Math.round((1 / h.gateSpeedMult - 1) * 100);
    this.setTile(7, `+${time}%`, 'TIME', time > 0,
      `Cards fall ${time > 0 ? `${time}% ` : ''}slower, so you have longer to compare them. Adds no damage, so it is an INVEST card: PAR never takes it and the score counts it as no growth.`);
    const chances = Array.from({ length: MAX_SENSE }, (_, i) => Math.round(senseChance(i + 1) * 100));
    this.tiles[8].setPips(h.sense);
    this.setTile(8, '', `SENSE ${Math.round(h.senseChance * 100)}%`, h.sense > 0,
      `${Math.round(h.senseChance * 100)}% of offers arrive with the best card outlined in white (${chances.join(' / ')}% at 1 / 2 / 3 held). Adds no damage, so it is an INVEST card: PAR never takes it and the score counts it as no growth.`);
    const perLevel = SHIELD.blocksPerLevel;
    this.setTile(9, h.shield > 0 ? `${h.shieldReady}/${h.shieldCapacity}` : '0', 'SHIELD', h.shield > 0,
      `Blocks enemy shots, and enemies that touch your ring, before they cost you soldiers: ${perLevel} blocks every ${SHIELD.windowSeconds}s per level held (${h.shield} of ${MAX_SHIELD}; ${h.shieldReady} ready now). A shell or a body is one block; one that walks past you is not blocked. Adds no damage, so it is an INVEST card: PAR never takes it and the score counts it as no growth.`);
    this.select(this.selected);
  }
}
