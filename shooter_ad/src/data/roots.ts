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
 * Every tier must also have the same MEAN, or the legibility axis is a power
 * axis in disguise - see the note on the first tier below.
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
   * Six round values, SYMMETRIC about the middle of the range.
   *
   * The symmetry is load-bearing, not tidiness. The original table was
   * `[1.05, 1.1, 1.2, 1.3, 1.4, 1.5]`, whose values bunch low: mean 1.2583
   * against 1.2750 for both ladders below, which are symmetric by
   * construction. That is 1.32% less per draw, and draws MULTIPLY - about 48%
   * less power over thirty offers. So escalating legibility was quietly
   * escalating strength, and a hard run, which starts a tier in, was handing
   * out bigger bonuses rather than harder sums. `npm run model` measures the
   * mean of every tier and fails if they drift apart again.
   *
   * Gaps of 0.05 / 0.10 / 0.15 / 0.10 / 0.05 keep every value a multiple of
   * 0.05, which is what makes this tier mentally tractable.
   */
  { minWave: 1,  sigFigs: 2, roots: [1.05, 1.1, 1.2, 1.35, 1.45, 1.5] },
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
