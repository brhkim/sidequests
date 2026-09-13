/**
 * Enemy roster. Adding a type means appending one entry here plus, if it needs
 * new movement, one case in Enemies.ts `applyBehaviour`. Nothing else changes.
 */
export type Behaviour =
  | 'straight'   // walks down
  | 'zigzag'     // weaves while advancing
  | 'charger'    // slow, then sprints once close
  | 'splitter'   // spawns smaller copies on death
  | 'bomber'     // fast, costs extra power on breach
  | 'shielder'   // frontal armour, resists damage
  | 'healer'     // regenerates nearby enemies
  | 'boss';      // large, spawns escorts

export interface EnemyType {
  readonly id: string;
  readonly name: string;
  readonly behaviour: Behaviour;
  readonly color: number;
  readonly accent: number;
  readonly radius: number;
  readonly hp: number;
  readonly speed: number;
  /** Power destroyed when this enemy reaches the line. */
  readonly damage: number;
  /** 0 = no armour, 0.6 = takes 40% damage. */
  readonly armor: number;
  /** Relative spawn weight once unlocked. */
  readonly weight: number;
  /** First wave this type can appear on. */
  readonly minWave: number;
  readonly splitInto?: string;
  readonly splitCount?: number;
}

export const ENEMIES: readonly EnemyType[] = [
  {
    id: 'grunt', name: 'Grunt', behaviour: 'straight',
    color: 0x7f8a63, accent: 0x4d5540,
    radius: 11, hp: 6, speed: 34, damage: 1, armor: 0, weight: 100, minWave: 1,
  },
  {
    id: 'runner', name: 'Runner', behaviour: 'zigzag',
    color: 0xe8d44d, accent: 0xa08f1d,
    radius: 9, hp: 4, speed: 82, damage: 1, armor: 0, weight: 55, minWave: 2,
  },
  {
    id: 'brute', name: 'Brute', behaviour: 'straight',
    color: 0x8e3b3b, accent: 0x5c2222,
    radius: 19, hp: 46, speed: 21, damage: 3, armor: 0.15, weight: 40, minWave: 3,
  },
  {
    id: 'shielder', name: 'Shielder', behaviour: 'shielder',
    color: 0x5b7fa8, accent: 0x2f4a66,
    radius: 14, hp: 26, speed: 27, damage: 2, armor: 0.55, weight: 35, minWave: 4,
  },
  {
    id: 'splitter', name: 'Splitter', behaviour: 'splitter',
    color: 0x63c76a, accent: 0x2f7a38,
    radius: 15, hp: 20, speed: 31, damage: 2, armor: 0, weight: 32, minWave: 5,
    splitInto: 'grunt', splitCount: 3,
  },
  {
    id: 'bomber', name: 'Bomber', behaviour: 'bomber',
    color: 0xff7a2f, accent: 0xb04c12,
    radius: 12, hp: 11, speed: 68, damage: 5, armor: 0, weight: 28, minWave: 6,
  },
  {
    id: 'healer', name: 'Medic', behaviour: 'healer',
    color: 0xd45fd4, accent: 0x8a2f8a,
    radius: 12, hp: 24, speed: 25, damage: 1, armor: 0.2, weight: 22, minWave: 8,
  },
  {
    id: 'titan', name: 'Titan', behaviour: 'boss',
    color: 0x6b2b8c, accent: 0x3a1550,
    radius: 36, hp: 420, speed: 15, damage: 12, armor: 0.35, weight: 0, minWave: 5,
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
