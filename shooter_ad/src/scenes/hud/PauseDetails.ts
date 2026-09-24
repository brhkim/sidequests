import Phaser from 'phaser';
import { ECHO, VIEW, WEAPON } from '../../config';
import { tierFor, tierRow, unitStats } from '../../data/tiers';
import {
  damageFactor, echoMultiplier, pierceMultiplier, rateFactor, unitShares, type Upgrades,
} from '../../systems/Progression';
import { INK } from '../theme';
import { compact, FONT, MONO, type HudPayload } from './types';

const MARGIN = 26;
const TOP = 144;
const LINE = 21;
const ROWS = 27;
/** The working's measure: the page's width between the margins. */
const MEASURE = VIEW.width - MARGIN * 2;

/**
 * The pause screen's DETAILS page: the DPS number on the rail, derived in
 * front of the player from the numbers on the strip - bodies and rank,
 * per-shot damage, shots per second, guns, pierce, total - and the same total
 * against one body, which is what the Titan asks. It is computed from the
 * same functions the squad fires with, so the last line IS the rail's number;
 * if it ever is not, one of them is wrong and this page is where that shows.
 * `endscreen.mjs` asserts exactly that.
 *
 * Monospace on purpose: the working is counted characters - each step's
 * terms sit under the step's number - and the columns only line up in a
 * fixed pitch. Every line is written to fit the 488px measure at 15px
 * (~54 characters); a line that grows past it (a late build's numbers)
 * shrinks the WHOLE block by one factor, so the columns stay aligned.
 * Three inks: the step headings bright, the working a step down, the
 * answer line the one white bold line.
 */
export class PauseDetails {
  readonly root: Phaser.GameObjects.Container;
  private readonly lines: Phaser.GameObjects.Text[] = [];
  private readonly styles: string[] = [];

  constructor(scene: Phaser.Scene) {
    const parts: Phaser.GameObjects.GameObject[] = [];
    parts.push(scene.add.text(MARGIN, 118, 'YOUR DAMAGE PER SECOND (DPS), STEP BY STEP', {
      fontFamily: FONT, fontSize: '14px', color: INK.caption, fontStyle: '700',
    }).setLetterSpacing(1.6));
    for (let i = 0; i < ROWS; i++) {
      const t = scene.add.text(MARGIN, TOP + i * LINE, '', {
        fontFamily: MONO, fontSize: '15px', color: WORKING,
      });
      parts.push(t);
      this.lines.push(t);
      this.styles.push('');
    }
    this.root = scene.add.container(0, 0, parts).setVisible(false);
  }

  /**
   * The leader is the worked body because it is the one the player can point
   * at; the ring total sums every body, since shares differ by one power
   * across the ring and ranks can straddle a row.
   */
  update(h: HudPayload): void {
    const u: Upgrades = {
      damageBonus: h.damageBonus, damageMult: h.damageMult,
      rateBonus: h.rateBonus, rateMult: h.rateMult,
      guns: h.guns, pierce: h.pierce,
      move: h.move, gateSpeedMult: h.gateSpeedMult, sense: h.sense, shield: h.shield, echo: h.echo,
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
    const em = echoMultiplier(h.echo);
    const total = withGuns * pm * em;
    const rank = tierRow(tierFor(lead)).name;
    const pct = Math.round(h.damageBonus * 100);
    const rpct = Math.round(h.rateBonus * 100);
    const standing = h.parDps > 0 ? Math.round(total / h.parDps * 100) : 100;

    const lines = [
      `1  ARMY ${compact(h.power)} power`,
      `   → ${shares.length} soldiers of ${low === lead ? compact(lead) : `${compact(low)}–${compact(lead)}`} power, rank ${rank}`,
      `   that rank: damage ×${num(stats.damage)}, rate ×${stats.fireRate.toFixed(2)}`,
      '',
      '2  DAMAGE PER SHOT  (the leader)',
      `   ${WEAPON.baseDamage} base × ${num(stats.damage)} rank × (1 + ${pct}%) × ${h.damageMult.toFixed(2)}`,
      `   = ${num(shotDamage)}`,
      '',
      '3  SHOTS PER SECOND  (the leader)',
      `   ${WEAPON.baseFireRate} base × ${stats.fireRate.toFixed(2)} rank × (1 + ${rpct}%) × ${h.rateMult.toFixed(2)}`,
      `   = ${num(shotsPerSec)}`,
      '',
      '4  ONE SOLDIER, THEN ALL OF THEM',
      `   leader ${num(shotDamage)} × ${num(shotsPerSec)} = ${num(shotDamage * shotsPerSec)} /s`,
      `   all ${shares.length} soldiers together = ${num(ring)} /s`,
      '',
      `5  × ${h.guns} GUN${h.guns === 1 ? '' : 'S'}  = ${num(withGuns)} /s`,
      `6  × PIERCE ${h.pierce}  (+${WEAPON.pierceQ} of a hit a level) → ×${pm.toFixed(2)}`,
      `7  × ECHO ${h.echo}  (full ghost ${ECHO.value}, half ${ECHO.value / 2}) → ×${em.toFixed(2)}`,
      `   = ${num(total)} /s`,
      '',
      `=  ${compact(total)} DPS      par ${compact(h.parDps)}  →  ${standing}%`,
      '   PAR: the best card taken, every time',
      '',
      'one body (the Titan): pierce and echoes add nothing',
      `   ${compact(withGuns)} /s`,
      'MOVE, TIME, SENSE, SHIELD add nothing here (INVEST)',
    ];
    let widest = 0;
    this.lines.forEach((t, i) => {
      const line = lines[i] ?? '';
      // The answer is the one bright, bold line; a step heading is bright;
      // the working stays a step quieter.
      const style = line.startsWith('=') ? 'answer' : /^\d/.test(line) ? 'step' : 'work';
      if (t.text !== line) t.setText(line);
      if (this.styles[i] !== style) {
        this.styles[i] = style;
        t.setStyle({
          color: style === 'answer' ? '#ffffff' : style === 'step' ? INK.primary : WORKING,
          fontStyle: style === 'work' ? 'normal' : 'bold',
        });
      }
      widest = Math.max(widest, t.width);
    });
    const fit = Math.min(1, MEASURE / Math.max(1, widest));
    for (const t of this.lines) t.setScale(fit);
  }
}

/** The working lines: readable (~8:1 on the lane bed), a step under the headings. */
const WORKING = INK.secondary;

/** Short numbers with a sensible precision: 0.94, 19.6, 641, 12.1k. */
function num(v: number): string {
  if (v >= 1000) return compact(v);
  if (v >= 100) return String(Math.round(v));
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
