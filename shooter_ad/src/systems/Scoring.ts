import type { GateType } from '../data/gates';
import { RISK_AXES } from '../config';
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
   * Fractional change in the option's DPS: 0.2 means a fifth better off. For
   * `x MOVE`, `+TIME` and `+SENSE` it is exactly zero - see `RISK_AXES`.
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
 * Value IS DPS. `x MOVE`, `+TIME` and `+SENSE` move no damage number, so
 * they score a flat zero, are never taken by par, and a player who takes one
 * is told RISK rather than graded - see `RISK_AXES` in config and
 * `isRiskPick` below. For a while they were priced through an access factor
 * so par would sometimes take them; the author's call is that they are the
 * player's gamble and never par's.
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

/** Whether a taken option is one of the zero-DPS axes the player gambles on. */
export function isRiskPick(offer: ScoredOffer, taken: number): boolean {
  if (taken < 0) return false;
  return (RISK_AXES as readonly string[]).includes(offer.options[taken].gate.axis);
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
