/**
 * Every tunable number in the game. Balance changes belong here, not in
 * gameplay code.
 */

import { BULLET_BASE } from './data/tiers';

export const VIEW = { width: 540, height: 960 } as const;

/** Bottom strip the squad moves along. */
export const ARENA = {
  /** y of the squad's centre line. */
  laneY: 800,
  /** Horizontal travel limits for the squad centre. */
  minX: 70,
  maxX: VIEW.width - 70,
  /** Enemies crossing this line beside the army charge it as a contact does. */
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
  /**
   * One body. Every army bonus is a share of what you hold, so starting at 1
   * makes the first few picks feel like the largest they will ever be, and
   * gives the rank ladder somewhere to climb from.
   */
  startPower: 1,
  /**
   * OVERFLOW GUARD, not a balance constant. The rank ladder has no last row
   * (see data/tiers.ts), so there is no power at which an army bonus stops
   * buying damage and no design reason to cap power at all. This used to be
   * derived from the top authored row - 2048 x 19 = 38,912 - and past it
   * `clampPower` silently made every ARMY bonus a measured no-op, which is the
   * exact bug the prestige ranks were added to fix at 608. A finite ladder
   * always puts it somewhere.
   *
   * What a guard still buys is arithmetic that stays exact: `unitShares` deals
   * power out with `Math.floor` and `%`, which are only honest below 2^53, and
   * losing the guard entirely would trade a no-op bug for a NaN bug. 1e15 is
   * chosen well under that line and far past any run - at 1e15 the ring wears
   * row 45, four cycles up the palette. `npm run model` checks the ladder is
   * still finite and increasing there.
   */
  maxPower: 1e15,
} as const;

/** Referenced twice inside WEAPON, so they cannot be self-references. */
const BULLET_SPEED = 900;
const SIM_SHOT_CAP = 300;
/** Seconds a bullet takes to cross the screen from the lane line. */
const BULLET_FLIGHT_SECONDS = (ARENA.laneY + 20) / BULLET_SPEED;

export const WEAPON = {
  baseDamage: 1,
  /** Shots per second, per unit, before tier and pickup multipliers. */
  baseFireRate: 2.6,
  bulletSpeed: BULLET_SPEED,
  bulletRadius: 4,
  /**
   * Ceiling on bullets the SIMULATION spawns per second. A design constant,
   * exactly as `RENDER.maxVisibleShotsPerSecond` is one: above it the squad
   * keeps every shot it is owed, but the shots are BUNDLED - one spawned bullet
   * stands for several and carries their damage, and `Bullets.strike` charges
   * a body exactly the shots that would have hit it. Below it every shot is
   * its own bullet and nothing changes.
   *
   * The ceiling used to be an accident: a 900-bullet pool that gave up rather
   * than overwrite a live bullet, so real throughput was the pool's recycle
   * rate, ~988 shots/s, and past that RATE and GUNS were measured no-ops -
   * the late build wanted 16,943 shots/s and delivered 7% of its damage. The
   * pool is now sized FROM this number (`maxBullets`), never the reverse.
   *
   * 300 is the author's first value, not a tuned one: roughly the `hud-mid`
   * state, where nothing was refused and the board reads fine. It puts about
   * 270 bullets in the air at the cap. Raise it and bullets thin out; lower it
   * and they fatten sooner. The tint on every drawn bullet encodes how much it
   * stands for, so the collapse is visible rather than hidden.
   */
  maxSimShotsPerSecond: SIM_SHOT_CAP,
  /**
   * Pool size, DERIVED: a full flight's worth of bullets at the cap, plus a
   * quarter for the jitter of many units firing within one step. `refused` in
   * `npm run hud` should read zero at every state; if it does not, this margin
   * is wrong, not the cap.
   */
  maxBullets: Math.ceil(SIM_SHOT_CAP * BULLET_FLIGHT_SECONDS * 1.25),
  /**
   * The FIRING COLUMN: every shot the squad fires spawns inside a column this
   * wide, centred on the squad, whatever the formation's footprint. It is the
   * Titan's hit width (`radius: 38` in data/enemies.ts; `npm run model` asserts
   * the two agree), so a squad parked under the boss lands every shot on it -
   * which is the assumption the Titan's HP budget is built on, and the only
   * thing that makes that budget a statement about the player rather than
   * about geometry.
   *
   * It used to be that each unit fired from its own x and extra guns spread a
   * further 72px around it. Three hex rings are 96px across, so the column was
   * ~170px wide against a 72px boss and a perfectly placed squad landed about
   * half of its shots; the HP budget assumed all of them, and a player at 1.1
   * of par took the first Titan down to 75% in real play. Extra guns still
   * fire PARALLEL, not fanned - a cone scatters damage at range, so more guns
   * would make a squad worse against a single target, which is backwards.
   *
   * 83 is 72 widened by 15% at the author's request (72 read as too narrow in
   * play). A shot lands when its centre is within `radius + bulletRadius` of
   * the boss, so the Titan grew from 36 to 38 in radius to keep the invariant
   * above: half the column (41.5) still sits inside its hit radius (42).
   *
   * The column is centred on the LEADER'S DRAWN POSITION, not on the squad's
   * logical centre. Units ease toward their slots, so under a moving finger
   * the whole ring trails the centre by ~18px; a column centred on the centre
   * therefore came out of the air ahead of the character, which is the
   * "off-centre" the author saw. Centring on the leader makes the beam leave
   * the body that is visibly firing it; the two coincide the moment the squad
   * stops, so a parked squad under the boss is unchanged.
   */
  columnWidth: 83,
  /**
   * Width a unit's extra guns spread across, inside the column. Units are laid
   * across the rest of it (`columnWidth - gunSpread`), scaled down from their
   * formation slots, so the ring still reads as the source of the stream.
   */
  gunSpread: 24,
  /**
   * What one level of pierce is worth, in bodies: each level adds this much of
   * an extra hit, so pierce P is worth `1 + q * P`. Tuned constant, deliberately
   * not live enemy density - see Progression.pierceMultiplier, which also says
   * why the series stopped compounding. At 0.5, pierce 1/2/3/10 are worth
   * 1.5x / 2x / 2.5x / 6x.
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
  /**
   * What a landing bullet costs: this share of the army you hold, rounded DOWN
   * to whole power, never less than `minCost`, times the gun's `damage`. A
   * flat half-power tax went dead once armies reached the hundreds, so enemy
   * fire stopped being a reason to move exactly when there was the most of it.
   * At 1% a bullet is 1 power until 200, 2 until 300, and 100 at 10,000 - the
   * same proportional bite all run. Half a Basic contact and a sixth of a
   * Large one (`CONTACT`): a body reaching you is a failure to kill, fire is
   * a tax on standing still.
   */
  powerShare: 0.01,
  minCost: 1,
} as const;

/**
 * What an enemy costs when it is not killed - by TOUCHING the army or by
 * crossing `ARENA.breachY` beside it. The two are one event priced by one
 * function (`systems/Contact.ts`): a body that reaches you is a failure to
 * kill whichever line it crossed first, and two prices would drift the way
 * two scorings would.
 *
 * The price is a SHARE of the army you hold, rounded down to whole power and
 * never below `floor`, per tier of body - the rule enemy fire already
 * follows (`ENEMY_FIRE.powerShare`). The flat table this replaces
 * (1/1/3/2/2/5/1/2 per type) went dead the way a flat bullet did: at 640
 * power a Grunt leaking through cost a sixth of a percent, so past the first
 * few minutes nothing an enemy did to the army was a reason to move.
 *
 * At the floors the early game is the old table almost exactly: a Grunt is
 * still 1, a Shielder still 2, a Brute still 3 - only the Bomber (5 -> 3)
 * and the Spitter (1 -> 2) move. The share overtakes the floor at 100 power
 * for a Basic, 75 for a Medium, 67 for a Large; from there a leak costs the
 * same bite of a run at 640 as at 38,912 (12 / 25 / 38 there, 778 / 1556 /
 * 2334 at the old cap). Contact is always at least a bullet (2% vs 1%), and
 * a Large is three bullets.
 *
 * Contact lands EARLIER than a breach did. A full ring's front rank sits at
 * y ~755 and a lone leader at 800, so a Grunt (r 11) is consumed at y ~736
 * or ~781 against 862 for the line: 81-126 px sooner, which is 2.4-3.7 s of
 * a Grunt's descent, 1.5 s of a Runner's, 4.7 s of a Shielder's and 0.8 s
 * of a Bomber's sprint. Bodies that used to die in those seconds are charges
 * now, so the floors do not make the early game identical - `npm run
 * balance` before and after is the record (see CLAUDE.md, "Contact damage").
 *
 * The Titan is 100%: reaching you ends the run, whichever line it crossed.
 *
 * Tiers are by body size, and are the roster's `tier` field:
 *   basic  = Grunt, Runner
 *   medium = Shielder, Spitter, Splitter, Lancer
 *   large  = Brute, Bomber
 *   titan  = Titan
 */
export const CONTACT = {
  basic:  { share: 0.02, floor: 1 },
  medium: { share: 0.04, floor: 2 },
  large:  { share: 0.06, floor: 3 },
  titan:  { share: 1,    floor: 0 },
} as const;

/** A tier is a row of `CONTACT`: a type cannot name a tier that has no price. */
export type EnemyTier = keyof typeof CONTACT;

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
   * enemy pressure is never budgeted above this multiple of what the player can
   * ACTUALLY destroy right now. Without any clamp a missed multiplier gate can
   * ratchet difficulty beyond reach: fewer kills -> more breaches -> less power
   * -> harder enemies.
   *
   * **Softened from 1.35 to 2.5**, which is what `notes.md` asks for - keep
   * only enough to prevent a literally unwinnable state, not enough to rescue a
   * bad run. Losing control should be legible.
   *
   * The clamp governs exactly below `standing = targetFraction /
   * maxOverPlayer`, so this moves the threshold from 0.52 to 0.28. Measured
   * with `npm run mercy` across five seeds at skills 0.3 and 0.5 - the regime
   * the clamp exists for, since competent play sits above the threshold and
   * never touches it:
   *
   * | clamp | threshold | runs below it | died | median survival |
   * | --- | --- | --- | --- | --- |
   * | 1.35 | 0.52 | 4/10 | 9/10 | 112s |
   * | 1.8 | 0.39 | 3/10 | 10/10 | 103.5s |
   * | 2.5 | 0.28 | 0/10 | 10/10 | 99.8s |
   * | none | 0.01 | 0/10 | 10/10 | 99.8s |
   *
   * Three things that reading settles, and one it does not:
   *
   * - **The clamp was doing less than assumed.** At 1.35 nine of ten weak runs
   *   died anyway. It was never what stood between bad play and losing.
   * - **Softening costs about 11% of median survival** for weak play, and buys
   *   the 4/10 runs that lived in the clamped regime a run governed by par
   *   instead.
   * - **2.5 and no clamp at all measured identically**, per-run and not merely
   *   in median. So what the constant still buys is a GUARANTEE - enemies can
   *   never become unkillable - rather than an observed effect. That is
   *   precisely the residue `notes.md` wants kept, which is why this is 2.5
   *   rather than removal.
   * - **The death spiral did not reproduce.** `CLAUDE.md` recorded a reliable
   *   spiral around wave 7 with the clamp removed; at no clamp here the median
   *   is 99.8s and runs reach comparable waves. That earlier reading predates
   *   both the fixed timestep and the root-table fix, so it is not comparable -
   *   it is withdrawn rather than contradicted.
   *
   * The probe bot cannot dodge or position, so all of this is a FLOOR on
   * difficulty rather than a verdict on how losing control feels.
   */
  maxOverPlayer: 2.5,
  /**
   * Guard rails on the derived HP multiplier.
   *
   * `maxHpMult` is NUMERIC, not a balance value, and it was 400 - which made it
   * a balance value by accident, and a decisive one.
   *
   * The budget is linear in par DPS, and par DPS compounds by roughly a quarter
   * per offer, so at 400 the budget pinned after about THIRTY offers - under
   * four minutes of play. Past that point the wave was the same wave forever
   * while the player kept compounding, which is exactly the finding this came
   * out of: ordinary enemies stopped scaling with damage output. It was silent
   * because the probe bot dies around wave 3-6 and has never once crossed it,
   * so every measurement this project has ever taken was below the ceiling.
   *
   * `npm run model` now measures the crossover in OFFERS and fails if it lands
   * inside a run anyone would play. The honest statement about the new value is
   * NOT "it never binds": par grows geometrically, so any constant eventually
   * does. It is that it binds nowhere near a playable run - at 1e12 the pin
   * sits far past the sixty-offer (~7.5 minute) horizon the check uses, where
   * the wanted multiplier is still only ~3.5e6. What it still buys is the thing
   * a guard rail is for: no Infinity, no NaN, no enemy with a non-finite HP.
   */
  minHpMult: 0.6,
  maxHpMult: 1e12,
  /**
   * A boss is sized by the DEADLINE it creates, not by a pressure budget.
   *
   * The Titan ends the run when it crosses the breach line, so its HP is set
   * so a player holding `bossKillPar` of par - measured in SINGLE-TARGET
   * damage, with every shot landing - kills it by the time it has covered
   * `bossKillDistance` of the way down. Everything past that fraction is the
   * slack for dodging, taking gates and missing, which real play spends: at
   * 0.75 a player at 1.1 of par who also had to play the rest of the game got
   * the first Titan to 75% and no further. 0.3 is the author's next value to
   * feel out, and `npm run titan` is the instrument that says what a squad
   * parked under the boss actually achieves.
   *
   * Two multipliers used to hide inside this number and made it wrong by a
   * large factor whatever it was set to: the boss took the wave's `hpMult` on
   * top of its budget, and its 35% armor was budgeted as if it were 0. Both
   * are accounted for now (`Difficulty.titanHp`, `Enemies.advanceWave`), so
   * the constant means what it says.
   *
   * 0.36 is 0.3 with 20% more HP, the author's second value after playing the
   * first. HP is linear in this number, so "20% tougher" is exactly x1.2 here.
   * Rescue cages are sized from the same budget - see `CAGE.hpTitanFraction`.
   */
  bossKillPar: 0.9,
  bossKillDistance: 0.36,
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

/**
 * The simulation clock.
 *
 * Gameplay advances in FIXED increments, never on the real frame delta. Two
 * measured reasons, both of which cost this project a retracted result:
 *
 * - **A seed did not reproduce a run.** Three repeats of one seed gave 40.2s,
 *   41.1s and 40.2s of simulated time. The content was identical every time;
 *   only collision resolution wobbled, because it resolved against a slightly
 *   different dt each frame. Seeds are a product feature here, so "same
 *   offers, different outcome" is a broken feature rather than test noise.
 * - **Simulated and wall-clock time diverged with render load.** Adding screens
 *   to the game changed measured survival by 36% and produced a confident,
 *   entirely false balance conclusion. On a fixed step the amount of game per
 *   simulated second is a constant, whatever the browser is doing.
 */
export const SIM = {
  /** Seconds of simulation per step. 1/60 matches the display's natural rate. */
  step: 1 / 60,
  /**
   * Cap on steps consumed per rendered frame. Without it a frame that took
   * 500ms queues 30 steps, which take longer than a frame to run, which queues
   * more - the spiral of death. At this cap a slow frame simply loses time:
   * the game runs briefly in slow motion rather than freezing, which is the
   * right trade for a game whose clock is a correctness property.
   */
  maxStepsPerFrame: 5,
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
   * GUN and PIERCE are whole numbers, so they cannot draw a root the way the
   * pools do - and a flat `+1` shrinks as you stack them: the fourth gun is
   * +33%, the tenth +11%, and past that the axis is dead. From this many held,
   * a discrete offer draws a root like everything else and presents it as the
   * whole number whose effect matches it, `+N GUNS` or `+N PIERCE`, floor 1 -
   * the same share-of-what-you-hold rule raw ARMY uses. Below it the offer is
   * `+1`, which the rule would round to anyway at one or two held.
   */
  scaleDiscreteFrom: 3,
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
  /**
   * How much of a state's value is JUDGMENT bought by `+SENSE`. Sense carries
   * no damage and no reach; what it buys is a chance (`SENSE.chance`) that an
   * offer arrives with its best option marked, which is a share of every
   * future pick made well. Priced as `1 + senseWeight x chance`, so the first
   * sense is worth +10% of value, the second +6%, the third +4% - a weak-to-
   * middling damage draw, which is the call the design wants: take the hint
   * or take the damage. Difficulty ignores it entirely; see `progressValue`.
   */
  senseWeight: 0.4,
} as const;

/**
 * `+SENSE`: the one bonus about the player rather than the squad. Each level
 * raises the chance that an offer arrives with its BEST option highlighted.
 * The roll is made once per offer, from the seeded generator, when the offer
 * is rolled - so a match code reproduces which offers were sensed too.
 */
export const SENSE = {
  /** Chance an offer is sensed, indexed by sense held. Length sets the cap. */
  chance: [0, 0.25, 0.4, 0.5],
} as const;

export const CAGE = {
  /** Rescue cages: shoot one open to free allies. A way to grow mid-wave. */
  chancePerWave: 0.75,
  speed: 52,
  radius: 18,
  /**
   * The reward is flat until the army passes `shareFrom`, then a share of it,
   * whole: +5 up to 100 power, +5% after, so a cage is worth the same bite of
   * a run at 20 power and at 20,000. It is the one source of army par does
   * NOT collect - a rescue is how a player who has fallen behind catches up,
   * and crediting par with it would move the curve out of reach by exactly
   * what it was meant to give back.
   */
  reward: 5,
  share: 0.05,
  shareFrom: 100,
  /**
   * HP as a fraction of the Titan that would spawn right now (its full budget:
   * `Difficulty.titanHp` at the boss's own descent and armor). A fifth of a
   * Titan is about two seconds of par's single-target fire, so opening one is
   * a real cost against the wave rather than a free pickup, and it scales
   * with par the way the boss does instead of with the wave's `hpMult`.
   */
  hpTitanFraction: 0.2,
} as const;

export const STREAK = {
  /** Every N kills grants power, so aggression compounds. */
  killsPerBonus: 25,
  bonus: 2,
} as const;

/**
 * Pure presentation. Nothing here may reach the simulation.
 *
 * The single rule for this section: a number in RENDER changes what is DRAWN
 * and never what is spawned, moved, or hit. The moment one of these feeds a
 * spawn count or a collision, a legibility fix has silently become a balance
 * change and every measured number on the branch is stale - and `npm run
 * repeat` would not catch it, because a differently-balanced game is still a
 * deterministic one. `npm run sweep` before and after is the check.
 */
export const RENDER = {
  /**
   * Ceiling on bullets DRAWN per second. The squad keeps firing and colliding
   * at its true rate; the renderer draws a stable one-in-N subset of the stream
   * and tints each drawn bullet by how many real shots it stands for (see
   * `bulletTint` in data/tiers.ts).
   *
   * At high GUNS and RATE the true rate runs into the thousands per second and
   * the playfield went solid cream - the player could no longer see which
   * column was being hit or how hard. A bullet lives about 0.9s crossing the
   * screen, so this is roughly the on-screen bullet count.
   *
   * 60 is chosen against the range the SPAWNED stream spans, not the range the
   * build implies. The simulation spawns at most `WEAPON.maxSimShotsPerSecond`
   * bullets a second, so this stride is at most x5 - and the bundle each of
   * those bullets carries is the other factor. The tint encodes the PRODUCT
   * (real shots per drawn bullet), so past the sim ceiling the ladder keeps
   * climbing through the bundle while the drawn count stays flat at ~55.
   *
   * Sized above the full-ring baseline (19 grey units at 2.6 shots/s is ~49/s)
   * so the cap never bites on an unupgraded squad - an early game that already
   * draws every shot should keep drawing every shot.
   */
  maxVisibleShotsPerSecond: 60,
  // --- sprites
  /**
   * Seconds a body is drawn pure white after a hit. The simulation stamps its
   * own clock on the body (`hitFlash` in systems/Enemies.ts); the renderer
   * compares, so nothing here is ever read back by a system.
   */
  hitFlash: 0.07,
  /** How far a body bleaches toward white at zero HP. Never an alpha fade: a
   * half-dead Grunt used to vanish into the background. */
  bleach: 0.35,
  /** Death pop: shards per kill, per Titan kill, and their lifetime. */
  shardsPerKill: 3,
  shardsPerTitan: 12,
  shardLife: 0.28,
  /** Contact pop: a body reaching the army leaves a smaller, duller mark. */
  shardsPerContact: 2,
  contactLife: 0.18,
  /** Fixed shard budget. 50 kills/s x 0.28s x 3 = 42 live; the ring overwrites
   * the oldest past this, so a burst never allocates. */
  shardRing: 96,
  /** Enemy bullets draw a faint copy a few pixels behind them. */
  bulletTrail: true,

  // --- field and feedback
  /**
   * Gate cards. `fill` is the card's alpha at rest, `targetFill` the one the
   * squad is lined up on, `roof` the height of the solid axis-coloured bar
   * along the card's top edge - the part of a card that still reads when a
   * bullet stream is crossing it.
   */
  gate: { fill: 0.16, targetFill: 0.3, roof: 4 },
  /**
   * Durations, in milliseconds of WALL clock, for the feedback moments. They
   * drive tweens on display objects and are read by nothing the simulation
   * touches; a pick wash that lingers longer changes no outcome.
   */
  moments: { pickHold: 240, pickFade: 480, deathBeat: 480, edgeFade: 360 },
  /**
   * Draw, for every enemy bullet still above the lane, a dash on the lane at
   * the x it will cross. Off by default: it tells the player where to stand,
   * which is more than the game means to say. Rendering only either way.
   */
  landingDashes: false,
} as const;

export const COLORS = {
  bg: 0x0a0c14,
  lane: 0x151a2b,
  breach: 0xff4d5e,
  bullet: BULLET_BASE,
  text: '#e8ecf8',
  cage: 0xb9a06a,
  enemyBullet: 0xff2fa6,
  shield: 0xbcd8ff,
} as const;
