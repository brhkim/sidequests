/**
 * Every tunable number in the game. Balance changes belong here, not in
 * gameplay code.
 */

export const VIEW = { width: 540, height: 960 } as const;

/** Bottom strip the squad moves along. */
export const ARENA = {
  /** y of the squad's centre line. */
  laneY: 800,
  /** Horizontal travel limits for the squad centre. */
  minX: 70,
  maxX: VIEW.width - 70,
  /** Enemies crossing this line damage the squad. */
  breachY: 862,
  /** Enemies spawn above the top edge. */
  spawnY: -40,
} as const;

export const SQUAD = {
  /**
   * The fix for the classic failure of this genre: the visible formation never
   * grows past three hex rings (1 + 6 + 12 = 19). Army beyond that is spent on
   * promoting the units you can already see, so positioning stays readable at
   * any power level.
   */
  ringCap: 19,
  unitSpacing: 24,
  unitRadius: 8,
  /** How fast units ease toward their formation slot (fraction per second). */
  followLerp: 14,
  moveSpeed: 620,
  startPower: 6,
  /** Power lost when an enemy breaches the line, multiplied by enemy damage. */
  breachLoss: 1,
} as const;

export const WEAPON = {
  baseDamage: 1,
  /** Shots per second, per unit, before tier and pickup multipliers. */
  baseFireRate: 2.6,
  bulletSpeed: 900,
  bulletRadius: 4,
  /** Firing is staggered across the ring so shots stream rather than pulse. */
  volleySpread: 0.55,
  maxBullets: 900,
} as const;

export const WAVE = {
  /** Seconds of the first wave; each wave is slightly shorter. */
  baseDuration: 16,
  durationFalloff: 0.97,
  minDuration: 9,
  /** Enemies per second at wave 1, growing per wave. */
  baseSpawnRate: 1.1,
  spawnRateGrowth: 0.16,
  maxSpawnRate: 7,
  /** Enemy hp multiplier growth per wave. */
  hpGrowth: 0.19,
  /** A boss arrives on every Nth wave. */
  bossEvery: 5,
  /** Power awarded for surviving a wave. */
  clearBonus: 4,
} as const;

export const GATES = {
  /** Seconds between gate pairs descending. */
  interval: 7.5,
  speed: 108,
  height: 64,
  /** Gates are always offered in pairs so the choice is the gameplay. */
  pairGap: 8,
} as const;

export const CAGE = {
  /** Rescue cages: shoot one open to free allies. A way to grow mid-wave. */
  chancePerWave: 0.75,
  hp: 22,
  speed: 52,
  radius: 18,
  reward: 6,
} as const;

export const STREAK = {
  /** Every N kills grants power, so aggression compounds. */
  killsPerBonus: 25,
  bonus: 2,
} as const;

/** Temporary buff durations, in seconds. */
export const BUFF = {
  shield: 6,
  slowmo: 5,
  slowmoFactor: 0.35,
  frenzy: 6,
  frenzyFireRate: 3.2,
} as const;

export const COLORS = {
  bg: 0x0a0c14,
  lane: 0x151a2b,
  breach: 0xff4d5e,
  bullet: 0xfff3b0,
  text: '#e8ecf8',
  cage: 0xb9a06a,
} as const;
