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
 * Every tier must also have the same mean - both the arithmetic one and, since
 * bonuses multiply, the GEOMETRIC one - or the legibility axis is a power axis
 * in disguise. See the note on the first tier below.
 */
export const ROOT_RANGE = { min: 1.05, max: 1.5 } as const;

export interface Legibility {
  readonly minWave: number;
  /** Significant figures raw values are rounded to. */
  readonly sigFigs: number;
  readonly roots: readonly number[];
}

/** Every multiple of `step` within the range, inclusive. */
function ladder(step: number): number[] {
  const out: number[] = [];
  const count = Math.round((ROOT_RANGE.max - ROOT_RANGE.min) / step);
  for (let i = 0; i <= count; i++) {
    out.push(Number((ROOT_RANGE.min + i * step).toFixed(2)));
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
   * Six round values, matched to the ladders on the mean that actually
   * governs: the GEOMETRIC one.
   *
   * The original table, `[1.05, 1.1, 1.2, 1.3, 1.4, 1.5]`, bunched low - 1.32%
   * under the ladders on the arithmetic mean, 1.48% on the geometric, about
   * 55% less power over thirty offers. So moving up a legibility tier was a
   * power increase wearing a legibility costume, and a hard run, which starts
   * a tier in, was handing out bigger bonuses rather than harder sums.
   *
   * The first repair matched the ARITHMETIC mean and left 0.26% per draw on
   * the geometric one - still 7.5% over a run, because bonuses MULTIPLY and a
   * table spread toward its extremes has a lower geometric mean at the same
   * average. Matching both leaves 0.05% per draw, 1.6% over a run, which is
   * inside the noise of anything this project can measure.
   *
   * Every value is still a multiple of 0.05, which is what makes this tier
   * mentally tractable; `npm run model` checks both means of every tier and
   * fails if they drift apart again.
   */
  { minWave: 1,  sigFigs: 2, roots: [1.05, 1.15, 1.25, 1.3, 1.4, 1.5] },
  { minWave: 6,  sigFigs: 2, roots: ladder(0.05) },
  { minWave: 11, sigFigs: 3, roots: ladder(0.01) },
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
