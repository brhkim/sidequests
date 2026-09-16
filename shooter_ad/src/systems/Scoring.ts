import type { GateType } from '../data/gates';
import {
  applyGate, cloneProgress, progressValue, squadDps, type Progress,
} from './Progression';

/** Two options within this relative distance in DPS count as tied. */
const TIE_EPSILON = 1e-9;

export interface ScoredOption {
  readonly gate: GateType;
  /** Damage output this option would leave the squad with. */
  readonly dps: number;
  /**
   * Fractional change in the option's VALUE: 0.2 means a fifth better off.
   *
   * For every damage-bearing bonus this is the change in DPS. For `x MOVE` and
   * `+TIME` it is the change in access, which is worth nothing in DPS and
   * everything in what you get to pick next - see `progressValue`.
   */
  readonly delta: number;
  /** Army power this option would leave, used only to break ties. */
  readonly power: number;
}

export interface ScoredOffer {
  readonly options: readonly ScoredOption[];
  /** Index of the option that leaves the squad strongest. */
  readonly best: number;
}

/**
 * Prices a whole offer against one progress state.
 *
 * This is the ONE implementation. Par takes the best option from it, the
 * decision log grades the player's pick with it, the halo flash colours the
 * gate from it, and the probe bot chooses with it. Two copies would drift, and
 * the failure mode is nasty and silent: the death screen would tell a player
 * they made a mistake that the difficulty curve never charged them for, or
 * charge them for one it refuses to name.
 *
 * Scored by resulting VALUE rather than raw power, because a flat `+30 ARMY`
 * would otherwise always beat a damage bonus no matter how many units are
 * already on the field.
 *
 * Value is `squadDps x accessFactor(reach)`, not DPS alone, and the difference
 * is the whole reason this function takes a `wave`. Priced by DPS, `x MOVE` and
 * `+TIME` move nothing: they would score a flat zero, be marked the worst
 * option in every offer that contained one, flash red on pickup, be called a
 * mistake by the death screen, and never once be taken by par. That would not
 * be the game judging them harshly, it would be the scoring failing to see a
 * cost the game already charges - you only get the bonus you can reach, and at
 * PROBE_SKILL 1.0 the bot reaching for the best option every time still lands
 * a median 88% of optimal, the gap being gates it chose and could not get to.
 *
 * The difficulty model deliberately does NOT use this. It budgets enemies
 * against raw `squadDps`, because access kills nothing; see Progression.
 */
export function scoreOffer(
  from: Progress, gates: readonly GateType[], wave: number,
): ScoredOffer {
  const before = progressValue(from, wave);
  const options: ScoredOption[] = gates.map((gate) => {
    const after = cloneProgress(from);
    applyGate(after, gate);
    return {
      gate,
      dps: squadDps(after),
      delta: before > 0 ? progressValue(after, wave) / before - 1 : 0,
      power: after.power,
    };
  });
  return { options, best: bestIndex(options) };
}

/**
 * Ties break toward the option leaving the most power, then toward the first
 * offered, and the comparison is RELATIVE rather than exact.
 *
 * This is load-bearing rather than fussy. On a strict `>` against a flat DPS
 * curve, par kept whatever it happened to score first and two seeds showed it
 * halving its own army - it was not playing badly, it could not tell its
 * options apart. Anything the difficulty model and the death screen both depend
 * on must never be decided by float noise or evaluation order.
 */
function bestIndex(options: readonly ScoredOption[]): number {
  let best = 0;
  for (let i = 1; i < options.length; i++) {
    const o = options[i];
    const b = options[best];
    const tied = Math.abs(o.delta - b.delta) <= Math.abs(1 + b.delta) * TIE_EPSILON;
    if (tied ? o.power > b.power : o.delta > b.delta) best = i;
  }
  return best;
}

/**
 * Where a pick lands among the options offered: 0 is the best available, 1 the
 * worst. Used for the halo flash and the death screen's per-row marker.
 *
 * Measured against the SPREAD of the offer rather than against the best option
 * alone, so taking the second of three near-identical bonuses does not read as
 * a blunder. When every option is worth the same, any pick is a top pick.
 */
export function pickRank(offer: ScoredOffer, taken: number): number {
  if (taken < 0) return 1;
  const deltas = offer.options.map((o) => o.delta);
  const best = Math.max(...deltas);
  const worst = Math.min(...deltas);
  if (best - worst <= TIE_EPSILON) return 0;
  return (best - deltas[taken]) / (best - worst);
}
