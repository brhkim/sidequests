import { SQUAD, WEAPON } from '../config';
import { TIERS, tierFor } from '../data/tiers';
import type { GateType } from '../data/gates';

export interface Upgrades {
  damageMult: number;
  fireRateMult: number;
  guns: number;
  pierce: number;
  /** Counts of each stacking upgrade, for diminishing returns. */
  damageStacks: number;
  fireRateStacks: number;
}

/** Everything a gate can change. The squad owns one; the difficulty model
 *  runs a second, shadow copy representing perfect play. */
export interface Progress {
  power: number;
  upgrades: Upgrades;
}

export function freshUpgrades(): Upgrades {
  return {
    damageMult: 1, fireRateMult: 1, guns: 1, pierce: 0,
    damageStacks: 0, fireRateStacks: 0,
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
 * Sustained damage per second for a given progress state.
 *
 * This is the single definition of squad strength: the difficulty model scales
 * enemies against it, and the squad fires from the same numbers. Keeping one
 * implementation is the point - two would drift and the difficulty curve would
 * silently stop matching the game.
 */
export function squadDps(p: Progress): number {
  let dps = 0;
  for (const share of unitShares(p.power)) {
    const tier = TIERS[tierFor(share)];
    const damage = WEAPON.baseDamage * tier.damage * p.upgrades.damageMult;
    const rate = WEAPON.baseFireRate * tier.fireRate * p.upgrades.fireRateMult;
    dps += damage * rate * p.upgrades.guns;
  }
  return dps;
}

/**
 * Applies a gate. Returns a short label for the floating feedback text.
 *
 * Stacking weapon upgrades diminish: the nth damage gate is worth
 * `value * diminish^n`. Without that the additive multipliers outrun every
 * enemy curve after a handful of gates, which is what made bonuses feel
 * overpowered.
 */
export function applyGate(p: Progress, gate: GateType): string {
  const u = p.upgrades;
  switch (gate.kind) {
    case 'add':
      p.power = clampPower(p.power + gate.value);
      return `+${gate.value}`;
    case 'sub':
      p.power = clampPower(p.power - gate.value);
      return `-${gate.value}`;
    case 'mul':
      p.power = clampPower(Math.floor(p.power) * gate.value);
      return `x${gate.value}`;
    case 'div':
      p.power = Math.max(1, Math.floor(p.power / gate.value));
      return `/${gate.value}`;
    case 'firerate':
      u.fireRateMult += gate.value * Math.pow(WEAPON.upgradeDiminish, u.fireRateStacks);
      u.fireRateStacks++;
      return 'FIRE RATE UP';
    case 'damage':
      u.damageMult += gate.value * Math.pow(WEAPON.upgradeDiminish, u.damageStacks);
      u.damageStacks++;
      return 'DAMAGE UP';
    case 'multishot':
      u.guns += gate.value;
      return `${u.guns} GUNS`;
    case 'pierce':
      u.pierce += gate.value;
      return 'PIERCING';
    case 'shield': return 'SHIELD';
    case 'slowmo': return 'SLOW MOTION';
    case 'frenzy': return 'FRENZY';
  }
}

function clampPower(value: number): number {
  return Math.max(0, Math.min(SQUAD.maxPower, value));
}

/** Deep copy, so the difficulty model can try a gate without committing. */
export function cloneProgress(p: Progress): Progress {
  return { power: p.power, upgrades: { ...p.upgrades } };
}
