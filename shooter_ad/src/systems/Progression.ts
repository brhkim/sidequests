import { ARENA, GATES, SENSE, SQUAD, WEAPON } from '../config';
import { unitStats } from '../data/tiers';
import type { GateType } from '../data/gates';
import { judgmentWave } from './Mode';

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
  /**
   * `+SENSE` held, 0 to `SENSE.chance.length - 1`. Touches no damage number:
   * it is the chance an offer arrives with its best option marked, and it is
   * priced as judgment the way MOVE and TIME are priced as access.
   */
  sense: number;
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
    moveMult: 1, gateSpeedMult: 1, sense: 0,
  };
}

/** Highest sense a squad can hold; the chance table's last row. */
export const MAX_SENSE = SENSE.chance.length - 1;

/** Chance an offer arrives sensed, for this much sense held. */
export function senseChance(sense: number): number {
  return SENSE.chance[Math.max(0, Math.min(MAX_SENSE, Math.floor(sense)))];
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
 * What a piercing bullet is actually worth: `1 + q * P`, where `q` is the share
 * of an extra body each pierce level is expected to find.
 *
 * `q` is a tuned constant, NOT live enemy density. Density swings wildly across
 * a wave, so a value measured at the instant of a decision scores the pick
 * against a truth that lasted one second. A stable approximation the death
 * screen can still stand behind a minute later is worth more than a precise one
 * it cannot - and par and the player must price it identically either way.
 *
 * It used to be the geometric series `1 + q + q^2 + ... + q^P`, which is the
 * sparse-field model: to meet a third body you must first have met a second.
 * At q = 0.5 that saturates at 2x, so pierce 3 was worth 1.875x and no amount
 * of pierce could ever be worth more than one extra hit - the axis was dead by
 * the third pick and `+N PIERCE` could not be made to scale like the other
 * axes however N was drawn. The author's read of the late game is the
 * opposite regime: seven bodies a second across a 400px lane is a dense
 * column, where nearly every pierce level finds a body and the series is
 * close to linear anyway. So each level now adds a fixed `q` of a hit, which
 * keeps pierce 1 at exactly the 1.5x it always was and lets the axis scale
 * with what you hold the way GUNS does. Whether a real bullet meets that many
 * bodies is what `hitsPerShot` in the stats exists to measure.
 */
export function pierceMultiplier(pierce: number): number {
  return 1 + WEAPON.pierceQ * pierce;
}

/**
 * Whole-number offer sizes for the discrete axes, effect-matched to a root the
 * way raw ARMY is: `+N GUNS` from `guns` held is worth `1 + N / guns`, and
 * `+N PIERCE` from `pierce` held is worth `pierceMultiplier(P + N) /
 * pierceMultiplier(P)`, so the N whose effect is nearest `root` is offered,
 * floor 1. Below `GATES.scaleDiscreteFrom` held the offer is always `+1`.
 */
export function discreteAmount(axis: 'guns' | 'pierce', held: number, root: number): number {
  if (held < GATES.scaleDiscreteFrom) return 1;
  const exact = axis === 'guns'
    ? (root - 1) * held
    : (root - 1) * pierceMultiplier(held) / WEAPON.pierceQ;
  return Math.max(1, Math.round(exact));
}

/**
 * The movement economy, in one place so par and the player cannot drift.
 *
 * Gate approach speed rises with the wave and is pulled back down by `+TIME`;
 * squad speed is pushed up by `x MOVE`. Both end up in the same quantity -
 * how far the squad can travel while an offer descends.
 */
export function waveGateSpeedMult(wave: number): number {
  // `judgmentWave` is where hard mode enters: it starts this curve several
  // waves in, so a hard run's first offer already descends at a later wave's
  // speed. Par reads it through the same call, so the two cannot disagree
  // about how long a decision was available for.
  const w = judgmentWave(wave);
  return Math.min(GATES.maxSpeedMult, 1 + Math.max(0, w - 1) * GATES.speedPerWave);
}

/**
 * Dead space between gates at this wave: px of each lane no option covers, so
 * the leader has to be placed rather than merely on the right third of the
 * screen. The fourth judgment lever - see `GATES.deadSpace` for the numbers -
 * and, like the other three, it reads `judgmentWave` so hard mode starts it
 * five waves in. Zero through wave 4 (normal), 6px at wave 5; capped at `max`.
 *
 * NOT priced by `reach`. Reach measures how far the squad can travel while an
 * offer descends, in lane widths; dead space narrows the target inside the
 * lane rather than moving it further away, and pricing the precision cost of
 * a pick would mean pricing the player's hand, which `scoreOffer` cannot see.
 * Par is therefore a little generous late, in the same way it is about the
 * bullets a player has to dodge to get there.
 */
export function gateDeadSpace(wave: number): number {
  const { fromWave, perWave, max, latePerWave, lateMax } = GATES.deadSpace;
  const w = judgmentWave(wave);
  const first = Math.min(max, Math.max(0, w - fromWave) * perWave);
  // The second stage starts the wave the first reaches its cap.
  const capWave = fromWave + max / perWave;
  const late = Math.min(lateMax - max, Math.max(0, w - capWave) * latePerWave);
  return first + late;
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
 * What a progress state is WORTH to a decision: its damage output, exactly.
 *
 * Access (`x MOVE`, `+TIME`) and judgment (`+SENSE`) used to be folded in as
 * factors here so that par would sometimes take them. They are not any more -
 * see `RISK_AXES` in config. A state is worth what it kills, so those three
 * axes price at zero, par never takes them, and a player who does is told
 * RISK rather than graded. The `wave` argument stays because the descent
 * curve is still the difficulty axis and the signature is shared by every
 * caller that reasons about an offer at a wave.
 *
 * Nothing is subtracted for delivery, and that is deliberate. For a while
 * this priced on a `deliverableDps` that modelled the bullet pool's
 * throughput ceiling. The ceiling is gone - past
 * `WEAPON.maxSimShotsPerSecond` the simulation bundles shots into heavier
 * bullets rather than dropping them - so `squadDps` is true again and is the
 * right price. If a delivery gap ever reappears, it belongs here as well as
 * in the budget, or par will recommend bonuses that do nothing.
 */
export function progressValue(p: Progress, _wave: number): number {
  return squadDps(p);
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

/**
 * Damage per second against ONE body, which is `squadDps` without the pierce
 * multiplier.
 *
 * Pierce is worth `1 + q + q^2 + ...` because a bullet may meet another enemy
 * after a hit. Against a single target there is no other enemy, so it is worth
 * exactly nothing - and at pierce 3 that is a 1.875x gap between what
 * `squadDps` reports and what the squad can actually do to a boss.
 *
 * The Titan's HP is derived from this rather than from `squadDps`, or a
 * pierce-heavy build would face a boss almost twice as tough as intended for
 * damage it cannot deliver.
 */
export function singleTargetDps(p: Progress): number {
  return squadDps(p) / pierceMultiplier(p.upgrades.pierce);
}

/**
 * Shots per second the build fires, guns included. Analytic, and the same
 * arithmetic `squadDps` does - split out because the simulation reads it to
 * decide how many of those shots ride in each spawned bullet (`bundleFactor`).
 */
export function shotsPerSecond(p: Progress): number {
  const rate = rateFactor(p.upgrades);
  let shots = 0;
  for (const share of unitShares(p.power)) {
    shots += WEAPON.baseFireRate * unitStats(share).fireRate * rate;
  }
  return shots * p.upgrades.guns;
}

/**
 * How many real shots one SPAWNED bullet stands for: 1 up to
 * `WEAPON.maxSimShotsPerSecond`, and the ratio above it.
 *
 * This is the SIMULATION's collapse of the stream, and it must stay
 * distinguishable from the renderer's. The renderer draws a bounded subset of
 * spawned bullets and changes nothing about what is hit; this changes what is
 * spawned, and keeps the total honest by making each bullet carry the shots it
 * replaces (`Bullets.strike`). Both are read in `GameScene.fire`, and the tint
 * encodes their product.
 *
 * It replaces a ceiling that was an accident of two unrelated numbers - the
 * pool size and the bullet speed - and that made `squadDps` a lie past ~988
 * shots/s: the difficulty budget was asking for damage nobody could do, and
 * RATE and GUNS were no-ops that par kept recommending. For a while
 * `deliverableDps` modelled that ceiling so the budget and the scoring would at
 * least stop believing it; bundling removes it instead, so there is one DPS
 * again and it is true.
 */
export function bundleFactor(p: Progress): number {
  return Math.max(1, shotsPerSecond(p) / WEAPON.maxSimShotsPerSecond);
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
    case 'sense':
      u.sense = Math.min(MAX_SENSE, u.sense + gate.value);
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
