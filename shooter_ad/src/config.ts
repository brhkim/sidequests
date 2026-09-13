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
  /**
   * Enemies and cages only appear within the band the squad's CENTRE can
   * reach. Spawning to the full view width put targets in columns the central
   * mass could never line up on, so they walked past untouched.
   */
  spawnInset: 14,
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
  /** Hard ceiling on army power, and the top of the rank ladder. */
  maxPower: 40000,
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
  /**
   * Each repeat of a stacking weapon upgrade is worth this fraction of the
   * last. Unbounded additive stacking is what let four DMG+ gates outscale
   * every enemy curve in the game.
   */
  upgradeDiminish: 0.72,
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

/**
 * Closed-loop difficulty. See systems/Difficulty.ts - enemies are budgeted
 * against a fraction of what a perfect player could be doing right now, rather
 * than against the wave number.
 */
export const DIFFICULTY = {
  /**
   * The strength the curve expects of you, as a fraction of perfect play.
   * Below 1 on purpose: a player who plays well rises ABOVE the curve and gets
   * to feel it. Raise toward 1 to make the game meaner.
   */
  targetFraction: 0.7,
  /**
   * Share of the target player's damage output that arriving enemies consume.
   * Under 1 leaves headroom so a competent player is never simply swamped.
   */
  pressure: 0.82,
  /**
   * Mercy clamp. Par grows on perfect play whether or not you kept up, so
   * without this a single missed multiplier gate ratchets difficulty beyond
   * reach and the run spirals: fewer kills -> more breaches -> less power ->
   * harder enemies. Enemy pressure is therefore never budgeted above this
   * multiple of what the player can ACTUALLY destroy right now, which leaves a
   * losing run recoverable while a leading run still gets the full curve.
   */
  maxOverPlayer: 1.35,
  /** Guard rails, so a pathological run cannot produce absurd enemies. */
  minHpMult: 0.6,
  maxHpMult: 400,
  /** A boss is budgeted as this many seconds of ordinary pressure, at once. */
  bossSeconds: 9,
  /**
   * Seconds for the budget to catch up to a change in par. Multiplier gates
   * double par in a single instant, which used to halve your standing with no
   * warning; easing the budget gives you time to reach your own next gate.
   */
  smoothingSeconds: 6,
  /**
   * Floor on spawn rate when the budget is being met by thinning the wave
   * rather than weakening it, as a fraction of the authored rate.
   */
  minSpawnRateFactor: 0.35,
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
