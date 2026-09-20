/**
 * The root multiplier table: the single generator behind every bonus magnitude
 * in the game.
 *
 * Each legibility tier owns a table of multipliers. Every bonus draws from it
 * INDEPENDENTLY, then presents the draw according to its form - multiplicative
 * shows the number itself, raw converts it to an absolute or a percentage. Two
 * properties fall out, and both are the design:
 *
 * - A raw bonus stays proportionally relevant at any scale, because it is a
 *   share of what you already have rather than a flat number that goes dead.
 * - The draws are independent, so the two forms in one offer are usually NOT
 *   the same underlying value. The player cannot assume `+120` and `x1.2`
 *   match; they have to divide. That conversion is the test.
 */

/**
 * The range is deliberately FIXED across every tier. Only granularity and
 * rounding escalate with difficulty: widening the range would make picks
 * swingier, and this game is about precision rather than luck.
 *
 * The tiers do NOT share a mean, and that is now a decision rather than an
 * accident. Inside a fixed [1.05, 1.5] a table of round tenths cannot have
 * the geometric mean of the hundredths ladder: the author chose the round
 * early tables anyway, for their readability, and accepted the drift.
 * `npm run model` prints the drift per tier and fails past `MEAN_DRIFT`
 * (in scripts/model.mjs) so it cannot grow unnoticed. See the tier notes.
 */
export const ROOT_RANGE = { min: 1.05, max: 1.5 } as const;

export interface Legibility {
  readonly minWave: number;
  /** Significant figures raw values are rounded to. */
  readonly sigFigs: number;
  readonly roots: readonly number[];
}

/** Every multiple of `step` from `from` to the top of the range, inclusive. */
function ladder(step: number, from: number = ROOT_RANGE.min): number[] {
  const out: number[] = [];
  const count = Math.round((ROOT_RANGE.max - from) / step);
  for (let i = 0; i <= count; i++) {
    out.push(Number((from + i * step).toFixed(2)));
  }
  return out;
}

/**
 * The difficulty axis that scales furthest: no mechanic changes, only how hard
 * the arithmetic is. Early offers are six round values a player can compare in
 * their head; late ones are any hundredth, rounded to a figure count that
 * defeats eyeballing.
 */
export const LEGIBILITY: readonly Legibility[] = [
  /**
   * The author's schedule, four tiers of five waves:
   *
   *   1-5    three round values a player can hold in their head
   *   6-10   the tenths
   *   11-15  every twentieth
   *   16+    every hundredth, rounded to three figures
   *
   * The two round tables sit ABOVE the ladders on the mean: about +2.0% per
   * draw for the tenths and +0.4% for the first tier on the geometric mean,
   * against the hundredths. Over a run that is real power - the tenths tier
   * compounds to roughly +20% over ten offers - and it was once the reason
   * this file matched every tier's mean exactly (the previous first tier was
   * `[1.05, 1.15, 1.25, 1.3, 1.4, 1.5]`, which matched to 0.05%). The author
   * read the drift and chose the round tables anyway; the model prints it and
   * caps it, so it stays a decision on the record rather than a surprise.
   * The direction is at least the kind one: the tiers a player sees while
   * learning pay a little more, and the drift ends as the ladders begin.
   */
  { minWave: 1,  sigFigs: 2, roots: [1.1, 1.25, 1.5] },
  { minWave: 6,  sigFigs: 2, roots: ladder(0.1, 1.1) },
  { minWave: 11, sigFigs: 2, roots: ladder(0.05) },
  { minWave: 16, sigFigs: 3, roots: ladder(0.01) },
];

export function legibilityFor(wave: number): Legibility {
  let tier = LEGIBILITY[0];
  for (const t of LEGIBILITY) if (wave >= t.minWave) tier = t;
  return tier;
}

export function drawRoot(tier: Legibility, rng: () => number): number {
  return tier.roots[Math.min(tier.roots.length - 1, Math.floor(rng() * tier.roots.length))];
}

/**
 * Round to significant figures, not to a fixed step. Nearest-5 stops reading as
 * an authored number once armies reach the thousands; two significant figures
 * gives +50, +120, +1300 - recognisably authored at any scale.
 */
export function roundSf(value: number, sigFigs: number): number {
  if (!(value > 0)) return 0;
  const scale = Math.pow(10, sigFigs - 1 - Math.floor(Math.log10(value)));
  return Math.round(value * scale) / scale;
}

/** `1.2` reads as `1.2`, not `1.2000000000000002`, and `1.5` not `1.50`. */
export function formatRoot(root: number): string {
  return root.toFixed(2).replace(/0$/, '');
}
