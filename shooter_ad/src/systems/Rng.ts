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

/** Seed from the URL when present, otherwise a random one. */
export function createRng(): { rng: () => number; seed: number } {
  const param = new URLSearchParams(location.search).get('seed');
  const seed = param !== null && Number.isFinite(Number(param))
    ? Number(param)
    : Math.floor(Math.random() * 0xffffffff);
  return { rng: mulberry32(seed), seed };
}
