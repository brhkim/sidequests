/**
 * Rank tiers, borrowed from MMO item quality. Surplus army power promotes the
 * capped ring of units up this ladder instead of adding bodies that would wreck
 * the formation's footprint.
 *
 * The ladder runs past red into six prestige ranks. That is MECHANICAL, not
 * decoration: `squadDps` reaches power only through these rows, so wherever the
 * ladder stops, every army-size bonus above it becomes a measured no-op and the
 * difficulty model's reference player starts picking between options it cannot
 * tell apart. `SQUAD.maxPower` is derived from the top row for the same reason.
 */
export interface Tier {
  readonly name: string;
  readonly shirt: number;
  readonly trim: number;
  /** Power-per-unit required to reach this tier. */
  readonly threshold: number;
  readonly damage: number;
  readonly fireRate: number;
}

export const TIERS: readonly Tier[] = [
  { name: 'Grey',      shirt: 0x9aa3b5, trim: 0x6f7787, threshold: 1,    damage: 1,    fireRate: 1    },
  { name: 'Green',     shirt: 0x4ad07a, trim: 0x2c8a4e, threshold: 2,    damage: 1.8,  fireRate: 1.08 },
  { name: 'Blue',      shirt: 0x4aa8ff, trim: 0x2b6cb0, threshold: 4,    damage: 3.2,  fireRate: 1.16 },
  { name: 'Purple',    shirt: 0xa96bff, trim: 0x6f3fb5, threshold: 8,    damage: 5.8,  fireRate: 1.25 },
  { name: 'Orange',    shirt: 0xff9838, trim: 0xc2661a, threshold: 16,   damage: 10.5, fireRate: 1.35 },
  { name: 'Red',       shirt: 0xff4757, trim: 0xb22230, threshold: 32,   damage: 19,   fireRate: 1.5  },
  // --- prestige ---------------------------------------------------------
  { name: 'Bronze',    shirt: 0xc87f3a, trim: 0x8a4f1c, threshold: 64,   damage: 34,   fireRate: 1.62 },
  { name: 'Silver',    shirt: 0xd7dde8, trim: 0x8d97a8, threshold: 128,  damage: 61,   fireRate: 1.75 },
  { name: 'Gold',      shirt: 0xffd24a, trim: 0xbf8f10, threshold: 256,  damage: 110,  fireRate: 1.89 },
  { name: 'Platinum',  shirt: 0x9fe8ff, trim: 0x4d93ad, threshold: 512,  damage: 198,  fireRate: 2.04 },
  { name: 'Diamond',   shirt: 0x7af0d8, trim: 0x2f9c8a, threshold: 1024, damage: 356, fireRate: 2.2 },
  { name: 'Prismatic', shirt: 0xff8ff0, trim: 0xa93fa0, threshold: 2048, damage: 640,  fireRate: 2.38 },
];

/** Power-per-unit at the top of the ladder. `SQUAD.maxPower` is derived from it. */
export const MAX_PER_UNIT = TIERS[TIERS.length - 1].threshold;

/** Highest tier index whose threshold is met by this power-per-unit. */
export function tierFor(powerPerUnit: number): number {
  let index = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (powerPerUnit >= TIERS[i].threshold) { index = i; break; }
  }
  return index;
}

/**
 * Damage and fire rate for a unit holding this much power, interpolated
 * geometrically BETWEEN tier rows rather than stepped at them.
 *
 * Thresholds double, but bonus magnitudes are drawn from [1.05, 1.50] - so on a
 * stepped ladder a `x1.2 ARMY` would cross a threshold only occasionally and be
 * worth exactly nothing the rest of the time. A bonus that usually changes
 * nothing is the noise the design explicitly cuts, so power reaches damage
 * continuously and the tier row survives only as the visible rank.
 */
export function unitStats(powerPerUnit: number): { damage: number; fireRate: number } {
  const i = tierFor(powerPerUnit);
  const lo = TIERS[i];
  const hi = TIERS[i + 1];
  if (!hi || powerPerUnit <= lo.threshold) {
    return { damage: lo.damage, fireRate: lo.fireRate };
  }
  const f = Math.log(powerPerUnit / lo.threshold) / Math.log(hi.threshold / lo.threshold);
  return {
    damage: lo.damage * Math.pow(hi.damage / lo.damage, f),
    fireRate: lo.fireRate * Math.pow(hi.fireRate / lo.fireRate, f),
  };
}

/**
 * Bullet colour by DENSITY - how many real bullets one drawn bullet stands for.
 *
 * At high GUNS and RATE the true stream is thousands of shots a second and the
 * playfield becomes a solid cream mass: you can no longer see what is being
 * hit, or by how much. The renderer therefore draws a bounded SUBSET of the
 * stream (see `RENDER.maxVisibleShotsPerSecond`) and colours each drawn bullet
 * by how much of the stream it represents.
 *
 * This deliberately reuses the shirt ladder above rather than inventing a
 * second scale. It is already the game's vocabulary for "this thing stands for
 * more than it looks like" - a red unit is a unit carrying 32 power, not one
 * body - so a red bullet reads as heavy fire without the player learning
 * anything new. Thresholds double, which is the right shape: fire rate
 * compounds multiplicatively, so a linear scale would sit at the top for most
 * of a run.
 *
 * Tier 0 is the cream a bullet has always been, because at density under 2 a
 * drawn bullet IS a real bullet and nothing is being collapsed. The ladder
 * starts exactly where the lie starts.
 */
export const BULLET_BASE = 0xfff3b0;

const BULLET_TINTS: readonly number[] = [BULLET_BASE, ...TIERS.slice(1).map((t) => t.shirt)];

export function bulletTint(density: number): number {
  return BULLET_TINTS[Math.min(tierFor(density), BULLET_TINTS.length - 1)];
}
