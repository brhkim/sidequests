import type { GateType } from '../data/gates';
import { scoreOffer, pickRank, isRiskPick, type ScoredOffer } from './Scoring';
import type { Progress } from './Progression';

export interface LoggedOption {
  readonly label: string;
  readonly axis: GateType['axis'];
  readonly form: GateType['form'];
  /** Fractional DPS change this option would have produced. */
  readonly delta: number;
}

export interface Decision {
  readonly wave: number;
  /** Seconds into the run, for ordering the death-screen rows. */
  readonly time: number;
  readonly options: readonly LoggedOption[];
  /** Index taken, or -1 if the offer was allowed to pass. */
  readonly taken: number;
  readonly best: number;
  /** 0 = took the best available, 1 = took the worst. */
  readonly rank: number;
  /**
   * The pick was a MOVE / TIME / SENSE gate: worth zero DPS, so it ranks
   * last beside any damage option and is told RISK rather than graded. It
   * still counts as no growth in `fractionOfOptimal` - the gamble is real.
   */
  readonly risk: boolean;
  /** The offer arrived with its best option marked (`+SENSE`). */
  readonly sensed: boolean;
}

/**
 * Every offer the player was shown, what they took, and what each option was
 * worth at that moment.
 *
 * This is the record the death screen reads, and it is the whole point of the
 * framing: a loss is only a lesson if you can see which call cost you. It is
 * also what the halo flash colours from, and what the probe bot chooses with -
 * one log, one scoring, so instant feedback and the post-mortem can never
 * disagree about the same pick.
 *
 * Deltas are computed against the state the player was ACTUALLY in when the
 * offer arrived, not against a counterfactual optimal run. "Given where you
 * were, which was best" is a question the player can learn from; "how far are
 * you from a perfect run you can no longer reach" is not.
 */
export class DecisionLog {
  private readonly decisions: Decision[] = [];
  /** Offers shown but not yet resolved, keyed by the gate system's pair id. */
  private readonly open = new Map<number, {
    wave: number; time: number; offer: ScoredOffer; sensed: boolean;
  }>();

  get entries(): readonly Decision[] { return this.decisions; }
  get count(): number { return this.decisions.length; }

  /**
   * An offer has arrived within reach. Scored here rather than at resolution
   * so the grade reflects the state the player was in while deciding, which is
   * the state they were reasoning about.
   */
  open_(
    pair: number, from: Progress, gates: readonly GateType[], wave: number, time: number,
    sensed = false,
  ): void {
    this.open.set(pair, { wave, time, offer: scoreOffer(from, gates, wave), sensed });
  }

  /**
   * Resolves an offer. `taken` is -1 when it was allowed to pass. Returns the
   * decision as logged (its rank, and whether it was a risk pick), or null if
   * there was nothing to resolve, so the wash colours from the same grade the
   * death screen will show.
   */
  resolve(pair: number, taken: number): Decision | null {
    const pending = this.open.get(pair);
    if (!pending) return null;
    this.open.delete(pair);
    const { offer, wave, time, sensed } = pending;
    this.decisions.push({
      wave,
      time,
      sensed,
      options: offer.options.map((o) => ({
        label: o.gate.label, axis: o.gate.axis, form: o.gate.form, delta: o.delta,
      })),
      taken,
      best: offer.best,
      rank: pickRank(offer, taken),
      risk: isRiskPick(offer, taken),
    });
    return this.decisions[this.decisions.length - 1];
  }

  /**
   * The headline: what fraction of the achievable damage growth the player
   * actually captured.
   *
   * Compounded rather than averaged, because bonuses compound. A run that takes
   * the best option every time scores 1; one that misses every offer scores the
   * ratio of no growth to perfect growth. Missed offers count as taken - not
   * deciding is a decision, and a player who drives past three gates should see
   * that in the number.
   */
  get fractionOfOptimal(): number {
    let taken = 0;
    let best = 0;
    for (const d of this.decisions) {
      taken += Math.log(1 + (d.taken >= 0 ? d.options[d.taken].delta : 0));
      best += Math.log(1 + d.options[d.best].delta);
    }
    if (best <= 0) return 1;
    return Math.exp(taken) / Math.exp(best);
  }

  /**
   * Counts for the shareable summary line: PERFECT / GOOD / BAD picks, then
   * RISK picks and missed offers, each in its own column rather than folded
   * into BAD - a gamble and a gate driven past are different lessons from a
   * wrong sum.
   */
  get tally(): { top: number; mid: number; low: number; risk: number; miss: number } {
    let top = 0, mid = 0, low = 0, risk = 0, miss = 0;
    for (const d of this.decisions) {
      if (d.taken < 0) miss++;
      else if (d.risk) risk++;
      else if (d.rank <= 0.001) top++;
      else if (d.rank >= 0.999) low++;
      else mid++;
    }
    return { top, mid, low, risk, miss };
  }

  reset(): void {
    this.decisions.length = 0;
    this.open.clear();
  }
}
