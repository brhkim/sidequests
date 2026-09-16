import { CAGE, DIFFICULTY, SQUAD, STREAK, WAVE } from '../config';
import type { GateType } from '../data/gates';
import {
  applyGate, cloneProgress, deliverableDps, freshUpgrades, singleTargetDps, type Progress,
} from './Progression';
import { scoreOffer } from './Scoring';

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
/**
 * The mercy clamp in force, with an instrument seam.
 *
 * `maxOverPlayer` is a build-time constant, and answering "how much mercy
 * should there be" means comparing several values across several seeds and
 * skill levels - dozens of runs. Rebuilding between each would mean every
 * value was measured against a slightly different `dist/`, which is the kind of
 * uncontrolled comparison this project keeps being burned by.
 *
 * So `npm run mercy` injects the value per page, the same way the probe bot is
 * injected. Deliberately NOT a URL parameter: a knob that silently rebalances
 * the game does not belong on a link somebody might share, and a match code
 * does not carry it, so a run played with one is not a shareable match.
 */
function mercyClamp(): number {
  const override = (globalThis as { __mercyOverride?: number }).__mercyOverride;
  return typeof override === 'number' && override > 0 ? override : DIFFICULTY.maxOverPlayer;
}

/**
 * The same seam for the two knobs that decide how hard ordinary enemies are.
 *
 * `npm run pressure` sweeps them. They are separated here rather than folded
 * into one number because they behave differently under measurement, and that
 * difference is the whole reason the sweep is worth running:
 *
 * - **`pressure` scales the budget and nothing else.** The mercy clamp is
 *   applied to `targetDps` BEFORE pressure multiplies it in `throttle`, so
 *   moving pressure leaves the clamp threshold exactly where it was and every
 *   run stays in the regime it was already in.
 * - **`targetFraction` moves the threshold with it** (`targetFraction /
 *   maxOverPlayer`), so raising it makes the game meaner AND hands some runs to
 *   a different regime. A reading that does not report the threshold alongside
 *   it is confounded, which is why `pressure.mjs` prints both.
 */
function targetFraction(): number {
  const o = (globalThis as { __targetFractionOverride?: number }).__targetFractionOverride;
  return typeof o === 'number' && o > 0 ? o : DIFFICULTY.targetFraction;
}

function pressure(): number {
  const o = (globalThis as { __pressureOverride?: number }).__pressureOverride;
  return typeof o === 'number' && o > 0 ? o : DIFFICULTY.pressure;
}

/**
 * Standing below which the mercy clamp, rather than par, decides the budget.
 *
 * Derived and published in the stats payload so no instrument has to hardcode
 * it. Two scripts did, against constants that had since moved, and reported a
 * threshold of 0.52 for a game whose real threshold was 0.28 - a stale reading
 * printed in the footer of every balance run.
 */
export function clampThreshold(): number {
  return targetFraction() / mercyClamp();
}

export class Difficulty {
  /** Perfect play: the best possible power level at this moment. */
  private ideal: Progress = { power: SQUAD.startPower, upgrades: freshUpgrades() };
  private idealKills = 0;
  private streakProgress = 0;
  /** Budget actually in force, easing toward the par-derived target. */
  private smoothedTarget = 0;

  get parPower(): number { return this.ideal.power; }
  /**
   * Par's DELIVERABLE damage, not its analytic damage.
   *
   * The budget is denominated in DPS, so it has to be denominated in DPS
   * somebody can actually do. Past the bullet pool's throughput ceiling the two
   * diverge by more than an order of magnitude - see `deliverableDps`, which
   * carries the measurement and the reason.
   *
   * `Scoring` deliberately still reads plain `squadDps`: par CHOOSES on what a
   * pick is worth and the curve is budgeted on what the squad can DO, exactly
   * as par chooses on access-weighted value while the budget ignores access.
   */
  get parDps(): number { return deliverableDps(this.ideal); }

  /**
   * Damage per second the curve expects. Par-derived, but never more than
   * `maxOverPlayer` times what the player can actually do - see the config
   * note; this is what stops a missed gate from becoming a death spiral.
   */
  targetDps(playerDps: number): number {
    const fromPar = this.parDps * targetFraction();
    return Math.min(fromPar, playerDps * mercyClamp());
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

  /**
   * How the real player is doing, as a fraction of par. 1.0 = perfect play.
   *
   * Measured in DAMAGE OUTPUT, not power. Par optimises for DPS, so it will
   * happily take DMG+ over +30 and sit on a small, potent squad; comparing its
   * power against a player who stacked multiplier gates compares two different
   * quantities and produced standings above 20. DPS is also exactly what the
   * difficulty budget is denominated in, so this is the ratio that matters.
   */
  standing(playerDps: number): number {
    const par = this.parDps;
    return par > 0 ? playerDps / par : 1;
  }

  /**
   * A gate set has been offered. Par takes whichever option leaves it
   * strongest, judged by the shared `scoreOffer` - the SAME function the death
   * screen grades the player with, so the two can never disagree about which
   * option was best.
   *
   * Note the asymmetry, which is deliberate: par CHOOSES on access-weighted
   * value, because that is the decision, but every number this class hands the
   * enemy budget (`parDps`, `targetDps`) is raw `squadDps`. Folding access into
   * the budget would tell the curve a squad that merely moves well is killing
   * more than it is.
   *
   * Ties break toward the option that leaves the most power, then toward the
   * first offered, and the comparison is RELATIVE rather than exact. Par is the
   * reference the difficulty model and the death screen's scoring both depend
   * on, so it must never be decided by float noise or by evaluation order: on a
   * strict `>` against a flat DPS curve, par kept whatever it happened to score
   * first and two seeds showed it halving its own army.
   */
  observeGateOffer(gates: readonly GateType[], wave: number): void {
    if (gates.length === 0) return;
    const chosen = gates[scoreOffer(this.ideal, gates, wave).best];
    const next = cloneProgress(this.ideal);
    applyGate(next, chosen);
    this.ideal = next;
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
    const budget = this.smoothedTarget * pressure();

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
  /**
   * Titan HP, derived from the deadline it creates rather than from a pressure
   * budget.
   *
   * The Titan ends the run when it reaches the squad, so the only question that
   * matters is whether a competent player can kill it in the distance it has to
   * cover. HP is therefore `bossKillPar` of par's SINGLE-TARGET damage, times
   * the seconds it takes to cover `bossKillDistance` of the way down.
   *
   * Single-target, not `squadDps`, because pierce is worth nothing against one
   * body - see `singleTargetDps`. Sizing the boss off a pierce-inflated par
   * would hand a pierce build a boss it cannot hurt fast enough.
   */
  titanHp(travelSeconds: number): number {
    const parSingle = singleTargetDps(this.ideal);
    const killSeconds = travelSeconds * DIFFICULTY.bossKillDistance;
    return Math.max(1, parSingle * DIFFICULTY.bossKillPar * killSeconds);
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
      // The knobs actually in force, overrides included. Published rather than
      // recomputed by each script: `balance` and `mercy` both carried their own
      // copies of these numbers and both had gone stale.
      targetFraction: targetFraction(),
      pressure: pressure(),
      clampThreshold: Number(clampThreshold().toFixed(3)),
    };
  }
}
