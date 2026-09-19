import type { EnemyTier } from '../config';

/**
 * Enemy roster. Adding a type is an append to `ENEMIES` below: pick a `motion`
 * kind, fill in its parameters, name its `tier` (which is what it costs when
 * it reaches the army - see `CONTACT` in config), and optionally hang traits
 * (`gun`, `escort`, `splitInto`, `frontArmor`) off it. Only a genuinely NEW
 * kind of movement needs a case in `systems/EnemyMotion.ts`; everything else
 * here is data the existing cases already read.
 *
 * Every kind below is used by at least one type, deliberately. A plain
 * straight-down walker was removed rather than left unused: this roster already
 * shipped a `charger` case no enemy referenced, and an unused case is a claim
 * about the game that nothing on screen backs up.
 */

/**
 * Movement kinds. Each is one case in `EnemyMotion.applyMotion`, and each
 * carries its own parameters so the tuning travels with the type rather than
 * hiding in the code.
 */
export type Motion =
  /** Weaves laterally while advancing. `amplitude` is px/s at the extreme. */
  | { readonly kind: 'zigzag'; readonly amplitude: number; readonly frequency: number }
  /** Slow approach, then sprints once within `trigger` px of the lane. */
  | { readonly kind: 'charger'; readonly trigger: number; readonly sprint: number }
  /**
   * Point-to-point: picks a lateral waypoint, walks to it, picks another. Not a
   * sine - the lateral velocity is constant and the turns are abrupt, which is
   * what makes a facing-based shield readable.
   */
  | { readonly kind: 'waypoint'; readonly lateral: number; readonly span: number }
  /**
   * Advances, then backs off for `retreat` seconds before advancing again.
   * Retreat is bounded twice over - see `EnemyMotion` - so it can neither leave
   * the top of the screen nor stall out.
   */
  | {
      readonly kind: 'harass';
      readonly advance: number;
      readonly retreat: number;
      readonly retreatSpeed: number;
      readonly maxRetreat: number;
    }
  /** Idles slowly, then dashes diagonally for `duration` at `speed`x. */
  | {
      readonly kind: 'dash';
      readonly interval: number;
      readonly duration: number;
      readonly speed: number;
      readonly idle: number;
      readonly lateral: number;
    }
  /** Wide, slow lateral drift. Boss movement. */
  | { readonly kind: 'drift'; readonly amplitude: number; readonly frequency: number };

/** Enemies that shoot back. Bullets are owned by `systems/EnemyBullets.ts`. */
export interface GunSpec {
  /** Seconds between volleys. */
  readonly interval: number;
  /** Bullets per volley, fanned across `spread` radians. */
  readonly count: number;
  readonly spread: number;
  readonly speed: number;
  /** Squad power destroyed per bullet that lands. */
  readonly damage: number;
  /** Leads toward the squad instead of firing straight down. */
  readonly aimed: boolean;
}

/** Periodically spawns another type alongside itself. */
export interface EscortSpec {
  readonly interval: number;
  readonly spawn: string;
  readonly count: number;
}

export interface EnemyType {
  readonly id: string;
  readonly name: string;
  readonly motion: Motion;
  /** Body tint. Textures are white with black detail, so this is the hue. */
  readonly color: number;
  /** Tint of the type's overlay sprite (plate, fuse, gun, eyes), where the
   * art table in `scenes/art/creatures.ts` gives it one. Rendering only. */
  readonly accent: number;
  readonly radius: number;
  readonly hp: number;
  readonly speed: number;
  /**
   * What reaching the army costs, by contact or by breach: a row of `CONTACT`,
   * chosen by body size. The one price for both, so there is no second table
   * for the two to disagree over.
   */
  readonly tier: EnemyTier;
  /** Direction-independent damage reduction. 0 = none, 0.6 = takes 40%. */
  readonly armor: number;
  /**
   * Extra reduction applied ONLY to shots arriving inside the cone the enemy
   * is facing (its movement direction). Flank and rear shots ignore it, which
   * is what makes the Shielder a positional problem rather than a stat.
   */
  readonly frontArmor?: number;
  /** Relative spawn weight once unlocked. */
  readonly weight: number;
  /** First wave this type can appear on. */
  readonly minWave: number;
  readonly gun?: GunSpec;
  readonly escort?: EscortSpec;
  readonly splitInto?: string;
  readonly splitCount?: number;
}

export const ENEMIES: readonly EnemyType[] = [
  {
    id: 'grunt', name: 'Grunt',
    motion: { kind: 'waypoint', lateral: 26, span: 90 },
    color: 0x7f8a63, accent: 0xdde6c8,
    radius: 11, hp: 6, speed: 34, tier: 'basic', armor: 0, weight: 100, minWave: 1,
  },
  {
    id: 'runner', name: 'Runner',
    motion: { kind: 'zigzag', amplitude: 78, frequency: 3.4 },
    color: 0xe8d44d, accent: 0xfff6c0,
    radius: 9, hp: 4, speed: 82, tier: 'basic', armor: 0, weight: 55, minWave: 2,
  },
  {
    id: 'brute', name: 'Brute',
    motion: { kind: 'charger', trigger: 300, sprint: 2.8 },
    color: 0xb5473f, accent: 0xffd9c2,
    radius: 19, hp: 46, speed: 21, tier: 'large', armor: 0.15, weight: 40, minWave: 3,
  },
  {
    id: 'shielder', name: 'Shielder',
    // Fast lateral legs on purpose: the shield points where it is walking, so
    // a hard sideways leg is the window where its front is not facing you.
    motion: { kind: 'waypoint', lateral: 74, span: 190 },
    color: 0x5b7fa8, accent: 0xbcd8ff,
    radius: 14, hp: 26, speed: 27, tier: 'medium',
    armor: 0.1, frontArmor: 0.65, weight: 35, minWave: 4,
  },
  {
    id: 'splitter', name: 'Splitter',
    motion: { kind: 'dash', interval: 2.4, duration: 0.5, speed: 4.2, idle: 0.45, lateral: 1.1 },
    color: 0x63c76a, accent: 0xd8ffd0,
    radius: 15, hp: 20, speed: 31, tier: 'medium', armor: 0, weight: 32, minWave: 5,
    splitInto: 'grunt', splitCount: 3,
  },
  {
    id: 'bomber', name: 'Bomber',
    motion: { kind: 'charger', trigger: 190, sprint: 2.2 },
    color: 0xff7a2f, accent: 0xffe066,
    radius: 12, hp: 11, speed: 68, tier: 'large', armor: 0, weight: 28, minWave: 6,
  },
  {
    id: 'spitter', name: 'Spitter',
    motion: { kind: 'waypoint', lateral: 58, span: 150 },
    color: 0x3fc9c9, accent: 0xf4fbff,
    radius: 12, hp: 16, speed: 30, tier: 'medium', armor: 0, weight: 30, minWave: 4,
    gun: { interval: 2.1, count: 1, spread: 0, speed: 210, damage: 1, aimed: true },
  },
  {
    id: 'lancer', name: 'Lancer',
    // Hangs back and shells the lane rather than committing to the breach.
    motion: { kind: 'harass', advance: 2.6, retreat: 1.3, retreatSpeed: 0.8, maxRetreat: 110 },
    color: 0xc2557f, accent: 0xfff0f4,
    radius: 13, hp: 22, speed: 38, tier: 'medium', armor: 0.1, weight: 24, minWave: 7,
    gun: { interval: 2.6, count: 3, spread: 0.42, speed: 185, damage: 1, aimed: false },
  },
  {
    id: 'titan', name: 'Titan',
    motion: { kind: 'drift', amplitude: 42, frequency: 0.8 },
    color: 0x8a3fb8, accent: 0xffd7ff,
    radius: 38, hp: 420, speed: 15, tier: 'titan', armor: 0.35, weight: 0, minWave: 5,
    escort: { interval: 2.2, spawn: 'runner', count: 1 },
    gun: { interval: 3.4, count: 5, spread: 0.9, speed: 165, damage: 1, aimed: false },
  },
];

export const ENEMY_BY_ID: ReadonlyMap<string, EnemyType> = new Map(
  ENEMIES.map((e) => [e.id, e]),
);

/** Types that can roll at this wave. */
export function spawnPool(wave: number): EnemyType[] {
  return ENEMIES.filter((e) => e.weight > 0 && e.minWave <= wave);
}

/**
 * Weight-averaged base HP of the current pool. The difficulty model needs this
 * to convert a damage-per-second budget into an HP multiplier.
 */
export function poolAverageHp(wave: number): number {
  const pool = spawnPool(wave);
  const weight = pool.reduce((sum, e) => sum + e.weight, 0);
  if (weight === 0) return 1;
  return pool.reduce((sum, e) => sum + e.hp * e.weight, 0) / weight;
}

/** Weighted pick from the types unlocked at this wave. Bosses are never rolled. */
export function rollEnemy(wave: number, rng: () => number): EnemyType {
  const pool = spawnPool(wave);
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * total;
  for (const e of pool) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return pool[0] ?? ENEMIES[0];
}
