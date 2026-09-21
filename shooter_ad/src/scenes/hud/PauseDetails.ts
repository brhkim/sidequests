import Phaser from 'phaser';
import { ECHO, WEAPON } from '../../config';
import { tierFor, tierRow, unitStats } from '../../data/tiers';
import {
  damageFactor, echoMultiplier, pierceMultiplier, rateFactor, unitShares, type Upgrades,
} from '../../systems/Progression';
import { compact, FONT, MONO, SMALL, type HudPayload } from './types';

/**
 * The pause screen's DETAILS page: the DPS number on the rail, derived in
 * front of the player from the numbers on the strip - bodies and rank,
 * per-shot damage, shots per second, guns, pierce, total - and the same total
 * against one body, which is what the Titan asks. It is computed from the
 * same functions the squad fires with, so the last line IS the rail's number;
 * if it ever is not, one of them is wrong and this page is where that shows.
 * `endscreen.mjs` asserts exactly that.
 */
export class PauseDetails {
  readonly root: Phaser.GameObjects.Container;
  private readonly lines: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    const parts: Phaser.GameObjects.GameObject[] = [];
    parts.push(scene.add.text(26, 104, 'YOUR DAMAGE PER SECOND (DPS), STEP BY STEP', {
      fontFamily: FONT, fontSize: '14px', color: SMALL, fontStyle: 'bold',
    }).setOrigin(0, 0).setLetterSpacing(1.5));
    for (let i = 0; i < 26; i++) {
      const t = scene.add.text(26, 128 + i * 22, '', {
        fontFamily: MONO, fontSize: '16px', color: WORKING,
      }).setOrigin(0, 0);
      parts.push(t);
      this.lines.push(t);
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
      moveMult: h.moveMult, gateSpeedMult: h.gateSpeedMult, sense: h.sense, shield: h.shield, echo: h.echo,
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
      `   → ${shares.length} soldiers of ${low === lead ? compact(lead) : `${compact(low)}–${compact(lead)}`} power each, rank ${rank}`,
      `   that rank: damage ×${num(stats.damage)}, fire rate ×${stats.fireRate.toFixed(2)}`,
      '',
      '2  DAMAGE PER SHOT  (the leader)',
      `   ${WEAPON.baseDamage} base × ${num(stats.damage)} rank × (1 + ${pct}% pool) × ${h.damageMult.toFixed(2)}`,
      `   = ${num(shotDamage)}`,
      '',
      '3  SHOTS PER SECOND  (the leader)',
      `   ${WEAPON.baseFireRate} base × ${stats.fireRate.toFixed(2)} rank × (1 + ${rpct}% pool) × ${h.rateMult.toFixed(2)}`,
      `   = ${num(shotsPerSec)}`,
      '',
      '4  ONE SOLDIER, THEN ALL OF THEM',
      `   leader ${num(shotDamage)} × ${num(shotsPerSec)} = ${num(shotDamage * shotsPerSec)} /s`,
      `   all ${shares.length} soldiers together = ${num(ring)} /s`,
      '',
      `5  × ${h.guns} GUN${h.guns === 1 ? '' : 'S'}  = ${num(withGuns)} /s`,
      '',
      `6  × PIERCE ${h.pierce}  (each level +${WEAPON.pierceQ} of a hit → ×${pm.toFixed(2)})`,
      `7  × ECHO ${h.echo}  (each ghost army priced ${ECHO.value} of yours → ×${em.toFixed(2)})`,
      `   = ${num(total)} /s`,
      '',
      `=  ${compact(total)} DPS      par ${compact(h.parDps)}  →  ${standing}%`,
      '   PAR: the best card taken, every time',
      '',
      'against one body (the Titan), pierce and echoes add nothing:',
      `   ${compact(withGuns)} /s`,
      'MOVE, TIME, SENSE and SHIELD add nothing here (RISK)',
    ];
    // The answer is the one bright, bold line; the working stays quieter.
    this.lines.forEach((t, i) => {
      const line = lines[i] ?? '';
      const answer = line.startsWith('=');
      t.setText(line).setStyle({ color: answer ? '#ffffff' : WORKING, fontStyle: answer ? 'bold' : 'normal' });
    });
  }
}

/** The working lines: readable (~9:1), but a step under the answer. */
const WORKING = '#c9d2ea';

/** Short numbers with a sensible precision: 0.94, 19.6, 641, 12.1k. */
function num(v: number): string {
  if (v >= 1000) return compact(v);
  if (v >= 100) return String(Math.round(v));
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
