import { matchFromQuery, type MatchMode } from './MatchCode';

/**
 * Difficulty mode: which wave the JUDGMENT axes start at.
 *
 * The game's difficulty has two independent halves. Enemy pressure is
 * closed-loop against par and never keys off the wave number (see
 * `Difficulty.ts`); the judgment axes - how fast an offer descends, and how
 * awkward its numbers are to compare - key off the wave and nothing else. Hard
 * mode moves only the second half, by starting it `waveOffset` waves in.
 *
 * That is the whole mechanism, and the restraint is the design. `notes.md` is
 * explicit that hard mode must not be "more enemy HP": it has to test the same
 * skill harder rather than a different one. A harder sum in less time is the
 * same skill; a tankier enemy is a different game. `DIFFICULTY.targetFraction`
 * is left alone for the same reason - raising it is a claim about how much
 * damage the curve expects, not about how hard the decision is, and it would
 * also move the mercy-clamp threshold, which would confound every reading of
 * hard mode with a regime change.
 *
 * `waveOffset: 5` means a hard run's first offer descends at wave 6 speed
 * (x1.32) and draws from the wave-6 root table - the tenths rather than
 * three round values. The finest legibility tier arrives at real wave 20
 * instead of 25, dead space caps at 25 instead of 30, gate speed at 35
 * instead of 40, and the cards sway from 26 instead of 31 (1.7).
 *
 * ## Why the mode is module state rather than a parameter
 *
 * A match has exactly one mode for its whole life, and the quantity it changes
 * is read from four places that MUST agree: the descending gate, the offer
 * roller, par's valuation of an offer, and the player's. `Progression.ts` is
 * the single definition of squad strength and `Scoring.ts` prices every offer
 * exactly once, both for the same reason - a second copy drifts silently and
 * the death screen starts telling players they made mistakes the curve never
 * charged them for. Threading a mode argument through those four call paths is
 * four chances to pass the wrong one; a single value every one of them reads is
 * none. `GameScene` sets it once per run, and nothing else may.
 */
export interface Mode {
  readonly waveOffset: number;
}

export const MODES: Record<MatchMode, Mode> = {
  normal: { waveOffset: 0 },
  hard: { waveOffset: 5 },
};

let active: MatchMode = 'normal';

/** Set once per run, by `GameScene` and nothing else. */
export function setMode(mode: MatchMode): void {
  active = mode;
}

export function currentMode(): MatchMode {
  return active;
}

/**
 * The wave the judgment axes should behave as. Everything keyed off wave for
 * DECISION difficulty goes through here; nothing keyed off wave for content
 * (which enemies exist, which bonuses have unlocked) does, because unlocking
 * late content early is a different game rather than a harder one.
 */
export function judgmentWave(wave: number): number {
  return wave + MODES[active].waveOffset;
}

/**
 * The mode this page was opened on.
 *
 * `?m=` is the shared form and carries the mode inside the code itself, which
 * is the point of putting it there: a hard run's code is visibly a different
 * match rather than the same one with a hidden flag, so nobody compares scores
 * across two difficulties believing they played the same thing. `?mode=hard` is
 * the raw form beside `?seed=`, for instruments.
 */
export function modeFromQuery(search: string): MatchMode {
  const match = matchFromQuery(search);
  if (match) return match.mode;
  return new URLSearchParams(search).get('mode') === 'hard' ? 'hard' : 'normal';
}
