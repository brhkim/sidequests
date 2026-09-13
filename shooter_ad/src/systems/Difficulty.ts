import { CAGE, DIFFICULTY, SQUAD, STREAK, WAVE } from '../config';
import type { GateType } from '../data/gates';
import {
  applyGate, cloneProgress, freshUpgrades, squadDps, type Progress,
} from './Progression';

/**
 * Closed-loop difficulty.
 *
 * The old model scaled enemies off the wave number alone, so it never knew how
 * strong the player actually was: enemy HP compounded at 19% a wave while
 * multiplier gates compounded far faster, and the two curves diverged within a
 * couple of minutes.
 *
 * Instead this tracks a shadow "par" player who takes the best gate offered
 * every single time and collects every bonus, then budgets enemies against a
 * fraction of that player's damage output. A real player at par feels
 * dominant; one well below it is in genuine trouble; and neither case needs a
 * hand-tuned wave table.
 */
export class Difficulty {
  /** Perfect play: the best possible power level at this moment. */
  private ideal: Progress = { power: SQUAD.startPower, upgrades: freshUpgrades() };
  private idealKills = 0;
  private streakProgress = 0;
  /** Budget actually in force, easing toward the par-derived target. */
  private smoothedTarget = 0;

  get parPower(): number { return this.ideal.power; }
  get parDps(): number { return squadDps(this.ideal); }

  /**
   * Damage per second the curve expects. Par-derived, but never more than
   * `maxOverPlayer` times what the player can actually do - see the config
   * note; this is what stops a missed gate from becoming a death spiral.
   */
  targetDps(playerDps: number): number {
    const fromPar = this.parDps * DIFFICULTY.targetFraction;
    return Math.min(fromPar, playerDps * DIFFICULTY.maxOverPlayer);
  }

  /**
   * Advance the eased budget. Par moves in steps (a x2 gate doubles it at an
   * instant); the budget follows it over `smoothingSeconds` so difficulty
   * never jumps under the player mid-wave.
   */
  update(dt: number, playerDps: number): void {
    const target = this.targetDps(playerDps);
    if (this.smoothedTarget <= 0) { this.smoothedTarget = target; return; }
    const ease = 1 - Math.exp(-dt / DIFFICULTY.smoothingSeconds);
    this.smoothedTarget += (target - this.smoothedTarget) * ease;
  }

  /** How the real player is doing, as a fraction of par. 1.0 = perfect play. */
  standing(power: number): number {
    return this.ideal.power > 0 ? power / this.ideal.power : 1;
  }

  /**
   * A gate set has been offered. Par takes whichever option leaves it
   * strongest, judged by resulting DPS rather than raw power - otherwise a
   * flat `+30` would always beat `DMG+` no matter how many units are already
   * on the field.
   */
  observeGateOffer(gates: readonly GateType[]): void {
    let best: Progress | null = null;
    let bestDps = -1;
    for (const gate of gates) {
      const candidate = cloneProgress(this.ideal);
      applyGate(candidate, gate);
      const dps = squadDps(candidate);
      if (dps > bestDps) { bestDps = dps; best = candidate; }
    }
    if (best) this.ideal = best;
  }

  /** Par clears every wave. */
  awardWaveClear(): void {
    this.ideal.power = Math.min(SQUAD.maxPower, this.ideal.power + WAVE.clearBonus);
  }

  /** Par kills everything that spawns, so streak bonuses accrue on spawn. */
  observeSpawn(): void {
    this.idealKills++;
    if (++this.streakProgress >= STREAK.killsPerBonus) {
      this.streakProgress = 0;
      this.ideal.power = Math.min(SQUAD.maxPower, this.ideal.power + STREAK.bonus);
    }
  }

  /** Par frees every cage. */
  awardCage(): void {
    this.ideal.power = Math.min(SQUAD.maxPower, this.ideal.power + CAGE.reward);
  }

  /**
   * Split the budget across the two knobs that make a wave threatening:
   * how tough each enemy is, and how many arrive.
   *
   * Toughness is spent first, because a thinner wave of solid enemies reads
   * better than a swarm of paper ones. Only when the budget cannot absorb even
   * unmultiplied enemies does the wave get thinned - without that, a weakened
   * player drowned in trivial enemies whose sheer count still cost power on
   * every breach.
   */
  throttle(authoredRate: number, avgBaseHp: number): { hpMult: number; spawnRate: number } {
    if (authoredRate <= 0 || avgBaseHp <= 0) return { hpMult: 1, spawnRate: authoredRate };
    const budget = this.smoothedTarget * DIFFICULTY.pressure;

    const wanted = budget / (authoredRate * avgBaseHp);
    if (wanted >= 1) {
      return {
        hpMult: Math.min(DIFFICULTY.maxHpMult, wanted),
        spawnRate: authoredRate,
      };
    }
    // Budget is below one wave of baseline enemies: keep them at full strength
    // and send fewer instead.
    const thinned = budget / avgBaseHp;
    return {
      hpMult: 1,
      spawnRate: Math.max(authoredRate * DIFFICULTY.minSpawnRateFactor, thinned),
    };
  }

  /** Bosses are budgeted as a burst of several seconds of the same pressure. */
  bossHpScale(baseHp: number): number {
    const budget = this.smoothedTarget * DIFFICULTY.pressure * DIFFICULTY.bossSeconds;
    return Math.max(1, budget / baseHp);
  }

  reset(): void {
    this.ideal = { power: SQUAD.startPower, upgrades: freshUpgrades() };
    this.idealKills = 0;
    this.streakProgress = 0;
    this.smoothedTarget = 0;
  }

  /** Exposed for the HUD and the headless checks. */
  snapshot() {
    return {
      parPower: Math.floor(this.ideal.power),
      parDps: Math.round(this.parDps),
      idealKills: this.idealKills,
    };
  }
}
