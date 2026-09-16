import { matchFromQuery } from './MatchCode';
/**
 * Seedable RNG. Balance work is comparison work - "is this change better?" -
 * and that is unanswerable while every run draws a different sequence of gates.
 * With a seed, two runs differ only by the change under test.
 *
 * Pass `?seed=123` to fix the sequence; omit it for a normal random game.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seed from the URL when present, otherwise a random one.
 *
 * Two forms are accepted. `?m=2TNBBGSH` is a match code, which is what gets
 * shared and which also carries the mode. `?seed=123` is the raw form, kept
 * because every instrument in this project passes it and a share code would be
 * a needless indirection there.
 */
export function createRng(seed?: number): { rng: () => number; seed: number } {
  if (seed !== undefined) return { rng: mulberry32(seed), seed };
  const match = matchFromQuery(location.search);
  if (match) return { rng: mulberry32(match.seed), seed: match.seed };
  const param = new URLSearchParams(location.search).get('seed');
  const chosen = param !== null && Number.isFinite(Number(param))
    ? Number(param)
    : Math.floor(Math.random() * 0xffffffff);
  return { rng: mulberry32(chosen), seed: chosen };
}

/**
 * Stateless hash in [0, 1). Long-lived entities (waypoint pickers, dash
 * directions) draw from this against a per-entity seed and a step index rather
 * than from the shared generator: a live entity that consumed the stream would
 * make the whole sequence depend on how many frames it happened to survive,
 * which is exactly the reproducibility a shareable seed promises.
 */
export function hash01(seed: number, step: number): number {
  let t = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  t = Math.imul(t ^ (step + 0x165667b1), 0xc2b2ae35);
  t ^= t >>> 13;
  t = Math.imul(t, 0x27d4eb2f);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}
