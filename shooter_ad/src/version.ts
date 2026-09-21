/**
 * Bump on any change that alters outcomes for a given seed - balance numbers,
 * the bonus table, enemy stats, the difficulty model.
 *
 * A seed only reproduces a run within one version, so this travels beside the
 * match code on the end screen. Without it people compare scores from two
 * different games and conclude the leaderboard is broken.
 */
export const VERSION = '1.1';
