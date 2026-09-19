import Phaser from 'phaser';
import { SQUAD, WEAPON } from '../../config';
import { AXIS_COLOR } from '../../data/gates';
import { tierFor, tierRow, unitStats } from '../../data/tiers';
import {
  damageFactor, MAX_SENSE, pierceMultiplier, rateFactor, senseChance, unitShares,
  type Upgrades,
} from '../../systems/Progression';
import { sensePips } from './TopRail';
import { VIEW } from '../../config';
import { compact, formatMult, hex, type HudPayload } from './types';

/**
 * Where the pause control lives. GameScene hit-tests this rectangle itself
 * rather than letting an interactive object in the UI scene do it, because a
 * tap that reaches BOTH scenes pauses the game and simultaneously orders the
 * squad to walk to x=486 - which it then does the moment you resume.
 */
export const PAUSE_BUTTON = { x: 486, y: 100, width: 88, height: 38 } as const;

const FONT = 'system-ui, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const MUTED = '#8f9ab5';
const FAINT = '#6f7a94';

/** The roots a bonus can draw, at the bottom, middle and top of the range. */
const SAMPLE_ROOTS = [1.1, 1.25, 1.4] as const;

type Page = 'bonuses' | 'details';

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

interface Tab {
  page: Page;
  label: Phaser.GameObjects.Text;
  underline: Phaser.GameObjects.Rectangle;
}

/** Every held bonus, in the order the DETAILS page multiplies them. */
const ROWS = [
  'army', 'damage', 'damage', 'rate', 'rate', 'guns', 'pierce', 'move', 'time', 'sense',
] as const;

/**
 * Pause, and the only place the game explains itself. Two pages:
 *
 * **BONUSES** teaches the conversion and lists everything held. The mechanic is
 * a conversion: a raw draw is scaled to your pool as `a = (root - 1) * (1 +
 * pool)`, so `+31% DMG` and `x1.1 DMG` are the same bonus at a +210% pool and
 * wildly different at an empty one. A player who has not worked that out reads
 * every offer as noise and the game is unplayable as designed. So the page does
 * NOT state the formula and leave it there: it prints a RULER against the
 * player's own pools - three offers they could plausibly be shown, each with
 * the multiplier it is actually worth to them right now - and then one row per
 * bonus, MOVE, TIME and SENSE included, each saying in a line what it does to
 * the sum (or that it does not enter it, and what it buys instead).
 *
 * **DETAILS** is the DPS number on the rail, derived in front of the player
 * from the numbers on the strip: bodies and rank, per-shot damage, shots per
 * second, guns, pierce, total - and the same total against one body, which is
 * what the Titan asks. It is computed from the same functions the squad fires
 * with, so the last line IS the rail's number; if it ever is not, one of them
 * is wrong and this page is where that would show.
 *
 * Rejected: a worked table of before/after damage (true, but the player does
 * not care what 15.5 becomes, they care which of two labels is bigger); and
 * colouring the forms differently, which would answer the question for them.
 */
export class PauseScreen {
  private readonly root: Phaser.GameObjects.Container;
  private readonly bonuses: Phaser.GameObjects.Container;
  private readonly details: Phaser.GameObjects.Container;
  private readonly tabs: Tab[] = [];
  private readonly rulers: Ruler[] = [];
  private readonly rows: Row[] = [];
  private readonly standing: Phaser.GameObjects.Text;
  private readonly detailLines: Phaser.GameObjects.Text[] = [];
  private page: Page = 'bonuses';

  constructor(scene: Phaser.Scene, onResume: () => void, onRestart: () => void) {
    const cx = VIEW.width / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { parts.push(o); return o; };

    add(scene.add.rectangle(cx, VIEW.height / 2, VIEW.width, VIEW.height, 0x05070f, 1));

    add(scene.add.text(cx, 18, 'PAUSED', {
      fontFamily: FONT, fontSize: '26px', color: '#e8ecf8', fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    // Tabs. Fixed-width hit bars, for the reason the start screen's mode
    // toggle has one: the target must not move under the finger.
    for (const [i, spec] of ([['bonuses', 'BONUSES'], ['details', 'DETAILS']] as const).entries()) {
      const x = cx + (i === 0 ? -90 : 90);
      const label = add(scene.add.text(x, 62, spec[1], {
        fontFamily: FONT, fontSize: '14px', color: MUTED, fontStyle: 'bold',
      }).setOrigin(0.5, 0).setLetterSpacing(1.6));
      const underline = add(scene.add.rectangle(x, 84, 120, 2, 0x9fe8ff, 1).setOrigin(0.5, 0));
      const hit = add(scene.add.rectangle(x, 70, 170, 40, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true }));
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.showPage(spec[0]);
      });
      this.tabs.push({ page: spec[0], label, underline });
    }

    // ---- page one: the conversion, and what you hold ----------------------
    const b: Phaser.GameObjects.GameObject[] = [];
    const addB = <T extends Phaser.GameObjects.GameObject>(o: T): T => { b.push(o); return o; };

    addB(scene.add.text(cx, 98, 'stat  =  base × (1 + pool) × mult', {
      fontFamily: FONT, fontSize: '14px', color: FAINT,
    }).setOrigin(0.5, 0));

    // The teaching block. Two rulers side by side, because damage and rate are
    // separate pools and a player deep in one is often empty in the other -
    // seeing the same offer convert differently per axis is the lesson.
    for (const [i, axis] of (['damage', 'rate'] as const).entries()) {
      const x = 26 + i * 254;
      const color = AXIS_COLOR[axis];
      addB(scene.add.rectangle(x - 10, 120, 3, 104, color, 0.9).setOrigin(0, 0));
      const head = addB(scene.add.text(x, 118, '', {
        fontFamily: FONT, fontSize: '14px', color: hex(color), fontStyle: 'bold',
      }).setOrigin(0, 0));
      const divide = addB(scene.add.text(x, 138, '', {
        fontFamily: FONT, fontSize: '11px', color: MUTED,
      }).setOrigin(0, 0));
      const lines = SAMPLE_ROOTS.map((_, r) => addB(scene.add.text(x, 160 + r * 22, '', {
        fontFamily: MONO, fontSize: '15px', color: '#e8ecf8', fontStyle: 'bold',
      }).setOrigin(0, 0)));
      this.rulers.push({ head, divide, lines });
    }

    addB(scene.add.text(
      cx, 232,
      'Neither form is better — convert, then take the bigger one.',
      { fontFamily: FONT, fontSize: '13px', color: '#9fe8ff', align: 'center' },
    ).setOrigin(0.5, 0));
    addB(scene.add.text(
      cx, 250,
      'as a pool grows, the same × needs a bigger +% to match it',
      { fontFamily: FONT, fontSize: '11px', color: FAINT, align: 'center' },
    ).setOrigin(0.5, 0));

    addB(scene.add.rectangle(cx, 270, VIEW.width - 52, 1, 0x2a3350));
    addB(scene.add.text(26, 278, 'WHAT YOU HOLD', {
      fontFamily: FONT, fontSize: '11px', color: FAINT, fontStyle: 'bold',
    }).setOrigin(0, 0).setLetterSpacing(1.4));
    this.standing = addB(scene.add.text(VIEW.width - 26, 278, '', {
      fontFamily: FONT, fontSize: '11px', color: FAINT, fontStyle: 'bold',
    }).setOrigin(1, 0));

    for (const [i, axis] of ROWS.entries()) {
      const y = 298 + i * 40;
      const color = AXIS_COLOR[axis];
      this.rows.push({
        accent: addB(scene.add.rectangle(16, y + 2, 3, 30, color, 0.9).setOrigin(0, 0)),
        label: addB(scene.add.text(28, y - 1, '', {
          fontFamily: FONT, fontSize: '12px', color: hex(color), fontStyle: 'bold',
        }).setOrigin(0, 0).setLetterSpacing(1)),
        value: addB(scene.add.text(VIEW.width - 26, y - 2, '', {
          fontFamily: FONT, fontSize: '20px', color: '#f2f6ff', fontStyle: 'bold',
        }).setOrigin(1, 0)),
        note: addB(scene.add.text(28, y + 15, '', {
          fontFamily: FONT, fontSize: '11px', color: MUTED,
        }).setOrigin(0, 0)),
      });
    }
    this.bonuses = scene.add.container(0, 0, b);
    parts.push(this.bonuses);

    // ---- page two: the DPS number, derived ---------------------------------
    const d: Phaser.GameObjects.GameObject[] = [];
    d.push(scene.add.text(26, 100, 'YOUR DPS, STEP BY STEP', {
      fontFamily: FONT, fontSize: '11px', color: FAINT, fontStyle: 'bold',
    }).setOrigin(0, 0).setLetterSpacing(1.4));
    for (let i = 0; i < 26; i++) {
      const t = scene.add.text(26, 122 + i * 22, '', {
        fontFamily: MONO, fontSize: '13px', color: '#e8ecf8',
      }).setOrigin(0, 0);
      d.push(t);
      this.detailLines.push(t);
    }
    this.details = scene.add.container(0, 0, d).setVisible(false);
    parts.push(this.details);

    button(scene, add, 736, 'RESUME', 0x3ecf7a, onResume);
    button(scene, add, 806, 'RESTART', 0xff4757, onRestart);

    add(scene.add.text(cx, 872, 'P or ESC also pauses and resumes', {
      fontFamily: FONT, fontSize: '13px', color: '#4d5670',
    }).setOrigin(0.5, 0));

    // Hidden until asked for. A container is VISIBLE by default, and an opaque
    // full-screen panel at depth 55 that nobody requested covers the entire
    // game - which is exactly the bug the start screen shipped.
    this.root = scene.add.container(0, 0, parts).setDepth(55).setVisible(false);
    this.showPage('bonuses');
  }

  private showPage(page: Page): void {
    this.page = page;
    this.bonuses.setVisible(page === 'bonuses');
    this.details.setVisible(page === 'details');
    for (const t of this.tabs) {
      const on = t.page === page;
      t.label.setColor(on ? '#e8ecf8' : MUTED);
      t.underline.setVisible(on);
    }
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
    this.setRow(7, 'MOVE', formatMult(h.moveMult),
      'squad speed · no DPS — buys reaching the gate you judged best', h.moveMult > 1);
    const time = Math.round((1 / h.gateSpeedMult - 1) * 100);
    this.setRow(8, 'TIME', `+${time}%`,
      'offers fall slower · no DPS — buys seconds to do the arithmetic', time > 0);
    const chances = Array.from({ length: MAX_SENSE }, (_, i) => Math.round(senseChance(i + 1) * 100));
    this.setRow(9, 'SENSE', sensePips(h.sense),
      `${Math.round(h.senseChance * 100)}% of offers arrive with their best marked`
      + ` · ${chances.join(' / ')}% at 1 / 2 / 3`,
      h.sense > 0);

    this.setDetails(h);
  }

  /**
   * The rail's DPS, derived line by line from the strip's numbers with the
   * functions the squad fires with. The leader is the worked body because it
   * is the one the player can point at; the ring total sums every body, since
   * shares differ by one power across the ring and ranks can straddle a row.
   */
  private setDetails(h: HudPayload): void {
    const u: Upgrades = {
      damageBonus: h.damageBonus, damageMult: h.damageMult,
      rateBonus: h.rateBonus, rateMult: h.rateMult,
      guns: h.guns, pierce: h.pierce,
      moveMult: h.moveMult, gateSpeedMult: h.gateSpeedMult, sense: h.sense,
    };
    const shares = unitShares(h.power);
    const lead = shares[0];
    const low = shares[shares.length - 1];
    const stats = unitStats(lead);
    const dmgF = damageFactor(u);
    const rateF = rateFactor(u);
    const shotDamage = WEAPON.baseDamage * stats.damage * dmgF;
    const shotsPerSec = WEAPON.baseFireRate * stats.fireRate * rateF;
    let ring = 0;
    for (const s of shares) {
      const st = unitStats(s);
      ring += (WEAPON.baseDamage * st.damage * dmgF) * (WEAPON.baseFireRate * st.fireRate * rateF);
    }
    const pm = pierceMultiplier(h.pierce);
    const withGuns = ring * h.guns;
    const total = withGuns * pm;
    const rank = tierRow(tierFor(lead)).name;
    const pct = Math.round(h.damageBonus * 100);
    const rpct = Math.round(h.rateBonus * 100);
    const standing = h.parDps > 0 ? Math.round(total / h.parDps * 100) : 100;

    const lines = [
      `1  ARMY ${compact(h.power)}`,
      `   → ${shares.length} bodies of ${low === lead ? compact(lead) : `${compact(low)}–${compact(lead)}`} power each, rank ${rank}`,
      `   leader's rank: damage ×${num(stats.damage)}, rate ×${stats.fireRate.toFixed(2)}`,
      '',
      '2  DAMAGE PER SHOT  (leader)',
      `   ${WEAPON.baseDamage} base × ${num(stats.damage)} rank × (1 + ${pct}%) × ${h.damageMult.toFixed(2)}`,
      `   = ${num(shotDamage)}`,
      '',
      '3  SHOTS PER SECOND  (leader)',
      `   ${WEAPON.baseFireRate} base × ${stats.fireRate.toFixed(2)} rank × (1 + ${rpct}%) × ${h.rateMult.toFixed(2)}`,
      `   = ${num(shotsPerSec)}`,
      '',
      '4  PER BODY, THEN THE RING',
      `   leader ${num(shotDamage)} × ${num(shotsPerSec)} = ${num(shotDamage * shotsPerSec)} /s`,
      `   all ${shares.length} bodies together = ${num(ring)} /s`,
      '',
      `5  × ${h.guns} GUN${h.guns === 1 ? '' : 'S'}  = ${num(withGuns)} /s`,
      '',
      `6  × PIERCE ${h.pierce}  (each level +${WEAPON.pierceQ} of a hit → ×${pm.toFixed(2)})`,
      `   = ${num(total)} /s`,
      '',
      `=  ${compact(total)} DPS      par ${compact(h.parDps)}  →  ${standing}%`,
      '',
      `against ONE body (the Titan) pierce is worth nothing:`,
      `   ${compact(withGuns)} /s`,
      `MOVE ×${h.moveMult.toFixed(2)}, TIME, SENSE are not in this sum`,
    ];
    this.detailLines.forEach((t, i) => t.setText(lines[i] ?? ''));
  }

  show(h: HudPayload): void {
    this.update(h);
    this.root.setVisible(true);
  }

  hide(): void { this.root.setVisible(false); }

  get visible(): boolean { return this.root.visible; }

  get currentPage(): Page { return this.page; }
}

/** Short numbers with a sensible precision: 0.94, 19.6, 641, 12.1k. */
function num(v: number): string {
  if (v >= 1000) return compact(v);
  if (v >= 100) return String(Math.round(v));
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

type Adder = <T extends Phaser.GameObjects.GameObject>(o: T) => T;

function button(
  scene: Phaser.Scene, add: Adder, y: number,
  text: string, color: number, onTap: () => void,
): void {
  const cx = VIEW.width / 2;
  const rect = add(scene.add.rectangle(cx, y, 280, 54, color, 0.16)
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
