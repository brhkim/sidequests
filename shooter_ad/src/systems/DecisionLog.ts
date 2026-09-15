import type { GateType } from '../data/gates';
import { scoreOffer, pickRank, type ScoredOffer } from './Scoring';
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
  private readonly open = new Map<number, { wave: number; time: number; offer: ScoredOffer }>();

  get entries(): readonly Decision[] { return this.decisions; }
  get count(): number { return this.decisions.length; }

  /**
   * An offer has arrived within reach. Scored here rather than at resolution
   * so the grade reflects the state the player was in while deciding, which is
   * the state they were reasoning about.
   */
  open_(pair: number, from: Progress, gates: readonly GateType[], wave: number, time: number): void {
    this.open.set(pair, { wave, time, offer: scoreOffer(from, gates) });
  }

  /** Resolves an offer. `taken` is -1 when it was allowed to pass. */
  resolve(pair: number, taken: number): void {
    const pending = this.open.get(pair);
    if (!pending) return;
    this.open.delete(pair);
    const { offer, wave, time } = pending;
    this.decisions.push({
      wave,
      time,
      options: offer.options.map((o) => ({
        label: o.gate.label, axis: o.gate.axis, form: o.gate.form, delta: o.delta,
      })),
      taken,
      best: offer.best,
      rank: pickRank(offer, taken),
    });
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

  /** Counts of top / middle / bottom picks, for the shareable summary line. */
  get tally(): { top: number; mid: number; low: number } {
    let top = 0, mid = 0, low = 0;
    for (const d of this.decisions) {
      if (d.rank <= 0.001) top++;
      else if (d.rank >= 0.999) low++;
      else mid++;
    }
    return { top, mid, low };
  }

  reset(): void {
    this.decisions.length = 0;
    this.open.clear();
  }
}
