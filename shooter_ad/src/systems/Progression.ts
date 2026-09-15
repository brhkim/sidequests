import { ARENA, GATES, SCORING, SQUAD, WEAPON } from '../config';
import { unitStats } from '../data/tiers';
import type { GateType } from '../data/gates';

/**
 * The additive / multiplicative split, which is the core mechanic.
 *
 * A stat is `base * (1 + bonusPool) * mult`. Early, the additive form wins
 * easily: `+10%` of base beats `x1.05` of a small total. Late it inverts - at a
 * pool of +200%, another `+10%` adds a tenth of base while `x1.05` adds five
 * hundredths of a 3x total. There is a crossover, it moves as you build, and
 * finding it is the game.
 */
export interface Upgrades {
  damageBonus: number;
  damageMult: number;
  rateBonus: number;
  rateMult: number;
  guns: number;
  pierce: number;
  /**
   * The movement economy. Neither term touches damage; both buy REACH - the
   * share of an offer the squad can actually get to before it passes.
   */
  moveMult: number;
  /** Multiplier ON gate approach speed, so `+TIME` drives it DOWN. */
  gateSpeedMult: number;
}

/** Everything a gate can change. The squad owns one; the difficulty model
 *  runs a second, shadow copy representing perfect play. */
export interface Progress {
  power: number;
  upgrades: Upgrades;
}

export function freshUpgrades(): Upgrades {
  return {
    damageBonus: 0, damageMult: 1, rateBonus: 0, rateMult: 1, guns: 1, pierce: 0,
    moveMult: 1, gateSpeedMult: 1,
  };
}

/**
 * Power dealt out across the capped ring: index i holds `shares[i]` power.
 * The remainder goes to the innermost units first, so the leader ranks up
 * before the outer ring catches up.
 */
export function unitShares(power: number): number[] {
  const count = Math.max(1, Math.min(Math.floor(power), SQUAD.ringCap));
  const total = Math.floor(power);
  const base = Math.floor(total / count);
  const extra = total % count;
  const shares = new Array<number>(count);
  for (let i = 0; i < count; i++) shares[i] = base + (i < extra ? 1 : 0);
  return shares;
}

/**
 * What a piercing bullet is actually worth: `1 + q + q^2 + ... + q^P`, where
 * `q` is the chance of meeting another body after a hit.
 *
 * `q` is a tuned constant, NOT live enemy density. Density swings wildly across
 * a wave, so a value measured at the instant of a decision scores the pick
 * against a truth that lasted one second. A stable approximation the death
 * screen can still stand behind a minute later is worth more than a precise one
 * it cannot - and par and the player must price it identically either way.
 */
export function pierceMultiplier(pierce: number): number {
  const q = WEAPON.pierceQ;
  return (1 - Math.pow(q, pierce + 1)) / (1 - q);
}

/**
 * The movement economy, in one place so par and the player cannot drift.
 *
 * Gate approach speed rises with the wave and is pulled back down by `+TIME`;
 * squad speed is pushed up by `x MOVE`. Both end up in the same quantity -
 * how far the squad can travel while an offer descends.
 */
export function waveGateSpeedMult(wave: number): number {
  return Math.min(GATES.maxSpeedMult, 1 + Math.max(0, wave - 1) * GATES.speedPerWave);
}

/** Px/s an offer descends at, for this wave and this run's accumulated `+TIME`. */
export function gateSpeed(wave: number, u: Upgrades): number {
  return GATES.speed * waveGateSpeedMult(wave) * u.gateSpeedMult;
}

/** Px/s the squad centre may travel. */
export function moveSpeed(u: Upgrades): number {
  return SQUAD.moveSpeed * u.moveMult;
}

/** Seconds from a gate's spawn above the screen to the squad's lane line. */
export function gateDescentSeconds(wave: number, u: Upgrades): number {
  return (ARENA.laneY + GATES.height) / gateSpeed(wave, u);
}

/**
 * Reach: lane widths the squad can cover while one offer descends, after the
 * share of that descent it can actually spend travelling (`SCORING.reachShare`
 * - the rest is dodging and staying on target).
 *
 * Deliberately NOT clamped to 1. A clamp would make every `x MOVE` past
 * saturation worth exactly zero, which is the failure this whole valuation
 * exists to remove; `accessFactor` saturates smoothly instead, so a bonus the
 * squad barely needs is worth little rather than nothing.
 */
export function reach(wave: number, u: Upgrades): number {
  const laneWidth = ARENA.maxX - ARENA.minX;
  const travel = moveSpeed(u) * gateDescentSeconds(wave, u) * SCORING.reachShare;
  return travel / laneWidth;
}

/**
 * What that reach is worth, as a factor on damage output: `1 - w / (1 + reach)`.
 *
 * Strictly increasing, asymptotic to 1, never equal to it. A squad that cannot
 * move at all is priced at `1 - w` of one that can be anywhere, because a
 * player who can never get to the option they judged best stops compounding;
 * and a squad already covering the lane still gains a little from more, which
 * is honest - offers do not all arrive in the lane you are standing in.
 */
export function accessFactor(r: number): number {
  return 1 - SCORING.accessWeight / (1 + Math.max(0, r));
}

/**
 * What a progress state is WORTH to a decision, as opposed to what it kills.
 *
 * `squadDps` is what actually destroys enemies and is what the difficulty model
 * budgets against - access does not kill anything, so folding it into the
 * budget would tell the curve the player is stronger than they are. Scoring is
 * the other question: given two offers, which leaves you better off over the
 * rest of the run. Reaching future offers is part of that answer, so this is
 * what `Scoring.scoreOffer` prices with. Keep the two separate.
 */
export function progressValue(p: Progress, wave: number): number {
  return squadDps(p) * accessFactor(reach(wave, p.upgrades));
}

export function damageFactor(u: Upgrades): number { return (1 + u.damageBonus) * u.damageMult; }
export function rateFactor(u: Upgrades): number { return (1 + u.rateBonus) * u.rateMult; }

/**
 * Sustained damage per second for a given progress state.
 *
 * This is the single definition of squad strength: the difficulty model scales
 * enemies against it, the squad fires from the same numbers, and every bonus is
 * priced by it. Keeping one implementation is the point - two would drift, the
 * difficulty curve would silently stop matching the game, and the death
 * screen's "optimal pick" marker would be lying to the player about their own
 * mistake.
 */
export function squadDps(p: Progress): number {
  const dmg = damageFactor(p.upgrades);
  const rate = rateFactor(p.upgrades);
  let dps = 0;
  for (const share of unitShares(p.power)) {
    const stats = unitStats(share);
    dps += (WEAPON.baseDamage * stats.damage * dmg)
      * (WEAPON.baseFireRate * stats.fireRate * rate);
  }
  return dps * p.upgrades.guns * pierceMultiplier(p.upgrades.pierce);
}

/** Applies a gate. Returns the label for the floating feedback text. */
export function applyGate(p: Progress, gate: GateType): string {
  const u = p.upgrades;
  switch (gate.axis) {
    case 'army':
      // Army is a count of bodies: it stays whole, so the number the gate
      // promised is the number the player can read off the formation.
      p.power = clampPower(Math.round(gate.form === 'mult'
        ? p.power * gate.value
        : p.power + gate.value));
      break;
    case 'damage':
      if (gate.form === 'mult') u.damageMult *= gate.value;
      else u.damageBonus += gate.value;
      break;
    case 'rate':
      if (gate.form === 'mult') u.rateMult *= gate.value;
      else u.rateBonus += gate.value;
      break;
    case 'guns':
      u.guns += gate.value;
      break;
    case 'pierce':
      u.pierce += gate.value;
      break;
    case 'move':
      u.moveMult *= gate.value;
      break;
    case 'time':
      // The gate promises slower approach; the stat it moves is the SPEED, so
      // the draw divides. `+20% TIME` is exactly 1.2x the seconds to decide.
      u.gateSpeedMult /= gate.value;
      break;
  }
  return gate.label;
}

function clampPower(value: number): number {
  return Math.max(0, Math.min(SQUAD.maxPower, value));
}

/** Deep copy, so the difficulty model can try a gate without committing. */
export function cloneProgress(p: Progress): Progress {
  return { power: p.power, upgrades: { ...p.upgrades } };
}
