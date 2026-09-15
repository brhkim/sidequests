/**
 * Every tunable number in the game. Balance changes belong here, not in
 * gameplay code.
 */

import { MAX_PER_UNIT } from './data/tiers';

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

/** Referenced twice inside SQUAD, so it cannot be a self-reference. */
const RING_CAP = 19;

export const SQUAD = {
  /**
   * The fix for the classic failure of this genre: the visible formation never
   * grows past three hex rings (1 + 6 + 12 = 19). Army beyond that is spent on
   * promoting the units you can already see, so positioning stays readable at
   * any power level.
   */
  ringCap: RING_CAP,
  unitSpacing: 24,
  unitRadius: 8,
  /** How fast units ease toward their formation slot (fraction per second). */
  followLerp: 14,
  /**
   * The leader is drawn larger than the rest of the ring. The centre unit is
   * what actually selects a gate, and nothing else on screen says so.
   */
  leaderScale: 1.5,
  /**
   * Cap on how fast the squad centre travels, in px/s. This is a CONSTRAINT,
   * not a convenience: the lane is 400px wide and a gate takes a few seconds to
   * descend, so getting to the option you judged best costs time you are not
   * spending dodging. Set high enough and `x MOVE` buys nothing, the movement
   * economy collapses, and reaching a gate stops being part of the decision -
   * which is why this came DOWN from 620 when the movement bonuses landed.
   *
   * Under a pointer the squad used to teleport to the finger, so travel was
   * free and none of the above was true. `Squad.update` now advances toward the
   * pointer at this speed instead.
   */
  moveSpeed: 260,
  startPower: 6,
  /**
   * Hard ceiling on army power, DERIVED from the ladder rather than picked.
   * A cap above what the ranks cover is a region where power buys no damage at
   * all, which turns every army bonus into a no-op and leaves the difficulty
   * model's reference player unable to tell its options apart.
   */
  maxPower: MAX_PER_UNIT * RING_CAP,
  /** Power lost when an enemy breaches the line, multiplied by enemy damage. */
  breachLoss: 1,
  /**
   * Power lost per enemy bullet that lands, multiplied by the gun's damage.
   * Deliberately well under `breachLoss`: fire is a steady tax that asks you to
   * keep moving, while a breach is the punishment for failing to kill.
   */
  fireLoss: 0.5,
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
   * Chance a piercing bullet meets another body after a hit. Tuned constant,
   * deliberately not live enemy density - see Progression.pierceMultiplier.
   * At 0.5, pierce 1/2/3 are worth 1.5x / 1.75x / 1.875x.
   */
  pierceQ: 0.5,
} as const;

/** Shape of enemy movement that is common to every type; per-type tuning lives
 * in the `motion` field of `data/enemies.ts`. */
export const MOTION = {
  /**
   * Retreating enemies may never rise above this line. Without it a harasser
   * that spawned high could reverse straight back off the top of the screen and
   * park there, unreachable and un-killable.
   */
  ceilingY: 90,
  /**
   * Second bound on retreat: an enemy can never go back above the deepest point
   * it has already reached, minus its own `maxRetreat`. Advance always moves
   * that high-water mark down, so every cycle nets forward progress and no
   * enemy can oscillate on the spot forever.
   */
  minCycleProgress: 8,
} as const;

/** Enemy projectiles. The squad loses power to these, not only to breaches. */
export const ENEMY_FIRE = {
  maxBullets: 240,
  radius: 5,
  /** Nothing shoots from off-screen; a gun only opens up below this line. */
  minFireY: 40,
  /**
   * Hard cap on how far a bullet may travel in one frame. Collision is swept
   * (segment vs unit circle) so this is belt-and-braces rather than the only
   * guard, but it also keeps the sweep segment short enough to stay accurate.
   */
  maxStep: 16,
  /** Grace after a spawn before its gun can fire, so volleys are staggered. */
  armDelay: 0.7,
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
  /** Seconds between offers descending. */
  interval: 7.5,
  /** Approach speed at wave 1. Rises with the wave - see `speedPerWave`. */
  speed: 108,
  /**
   * Fractional rise in approach speed per wave past the first.
   *
   * THE primary difficulty lever on the judgment axis, and deliberately
   * separate from enemy pressure: later waves do not give you a harder sum,
   * they give you less time to do it in. Enemy HP is closed-loop against par
   * (see systems/Difficulty.ts) and never keys off the wave number; this does,
   * because thinking time is not something a shadow player can be budgeted
   * against.
   */
  speedPerWave: 0.075,
  /**
   * Ceiling on that rise. At 2.5 a late offer descends in ~3.2s rather than 8s,
   * which is about as short as three labels can be read in at all. Past that
   * the game stops testing judgment and starts testing reflexes.
   */
  maxSpeedMult: 2.5,
  height: 64,
  /** Options per offer. The choice between them IS the gameplay. */
  perOffer: 3,
  gap: 8,
  /**
   * Label size. Three lanes across 540px leaves ~175px each, so this is sized
   * to fit the longest label the generator can produce (`+180% DMG` at a high
   * pool, `×1.05 ARMY`) without truncation.
   */
  labelSize: 21,
} as const;

/**
 * How a decision is PRICED, as distinct from what it kills.
 *
 * `x MOVE` and `+TIME` change no damage number at all, so scored by resulting
 * DPS they are worth exactly zero - the halo would flash them red, the death
 * screen would call them mistakes, and par would never take one. That is not a
 * judgement about them, it is the scoring failing to see what the game already
 * charges for: you only get the bonus you can reach.
 *
 * So scoring values a state as `squadDps * accessFactor(reach)` - see
 * Progression.progressValue. Difficulty keeps budgeting against raw `squadDps`,
 * because access does not kill anything.
 */
export const SCORING = {
  /**
   * Share of a gate's descent the squad can actually spend repositioning.
   *
   * The rest goes on dodging fire and staying over the column it is killing, so
   * the full descent is not a travel budget. A tuned constant, for exactly the
   * reason `WEAPON.pierceQ` is one: the true figure swings second to second
   * with the board, and a value measured at the instant of a decision scores
   * the pick against a truth that lasted one second. Stable and identical for
   * par and player beats precise and unrepeatable.
   */
  reachShare: 0.15,
  /**
   * How much of a state's value is access rather than raw damage. At 0.8 a
   * squad that can reach nothing is priced at a fifth of one that can reach
   * everything, which is roughly the difference between a run that keeps
   * compounding and one that stops.
   */
  accessWeight: 0.8,
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

export const COLORS = {
  bg: 0x0a0c14,
  lane: 0x151a2b,
  breach: 0xff4d5e,
  bullet: 0xfff3b0,
  text: '#e8ecf8',
  cage: 0xb9a06a,
  enemyBullet: 0xff8a5c,
  shield: 0xbcd8ff,
} as const;
