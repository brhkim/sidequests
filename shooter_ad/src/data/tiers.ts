/**
 * Rank tiers, borrowed from MMO item quality. Surplus army power promotes the
 * capped ring of units up this ladder instead of adding bodies that would wreck
 * the formation's footprint.
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
  { name: 'Grey',   shirt: 0x9aa3b5, trim: 0x6f7787, threshold: 1,  damage: 1,    fireRate: 1    },
  { name: 'Green',  shirt: 0x4ad07a, trim: 0x2c8a4e, threshold: 2,  damage: 1.8,  fireRate: 1.08 },
  { name: 'Blue',   shirt: 0x4aa8ff, trim: 0x2b6cb0, threshold: 4,  damage: 3.2,  fireRate: 1.16 },
  { name: 'Purple', shirt: 0xa96bff, trim: 0x6f3fb5, threshold: 8, damage: 5.8,  fireRate: 1.25 },
  { name: 'Orange', shirt: 0xff9838, trim: 0xc2661a, threshold: 16, damage: 10.5, fireRate: 1.35 },
  { name: 'Red',    shirt: 0xff4757, trim: 0xb22230, threshold: 32, damage: 19,   fireRate: 1.5  },
];

/** Highest tier index whose threshold is met by this power-per-unit. */
export function tierFor(powerPerUnit: number): number {
  let index = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (powerPerUnit >= TIERS[i].threshold) { index = i; break; }
  }
  return index;
}
