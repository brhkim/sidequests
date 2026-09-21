/**
 * The cue table: every sound the game makes, as a recipe rather than a file.
 *
 * A cue is a handful of PARTS - an oscillator or a noise burst, each with its
 * own envelope, filter and level - mixed under one cue level. `synth.ts` turns
 * a recipe into nodes on ANY BaseAudioContext, so the same table plays live and
 * renders offline in `npm run audio`. Nothing here is loaded at runtime; the
 * palette is code, like the textures.
 *
 * Levels are dB relative to full scale BEFORE the master (-6 dB) and the
 * compressor. Times are milliseconds. Every cue under ~150 Hz carries a
 * partial or noise above 200 Hz so a phone speaker still gets something.
 */
export type Wave = 'sine' | 'square' | 'triangle' | 'sawtooth';
export type Category = 'kill' | 'hit' | 'event' | 'titan' | 'ui';

export interface Filt {
  type: BiquadFilterType;
  freq: number;
  /** Sweep target, reached over the part's `sweepMs` (default: its duration). */
  to?: number;
  q?: number;
}

export interface Part {
  src: Wave | 'noise';
  /** Hz. Ignored by noise. `to` sweeps exponentially over `sweepMs`. */
  freq?: number;
  to?: number;
  sweepMs?: number;
  /** Start offset within the cue and sounding length, ms. */
  at?: number;
  dur: number;
  /** attack ms, decay ms, sustain level, release ms. Default: 2 / 0 / 1 / 20. */
  env?: [number, number, number, number];
  db: number;
  filter?: Filt;
}

export interface Cue {
  parts: Part[];
  db: number;
  category: Category;
  /** Higher wins a voice slot when the budget is full. */
  priority: number;
  /** Concurrent voices this cue may hold. */
  cap: number;
  /** `false` keeps the recipe but never plays it. */
  enabled?: boolean;
  /** Pulls the kill and hit buses down 6 dB for 300 ms. */
  duck?: boolean;
  /** Collapsed by `collapse.ts`: `window` tallies, `gap` says when a lone event plays at once. */
  bundle?: { windowMs: number; gapMs: number };
  /** Bundle size is encoded as pitch and level (kill only). */
  encode?: boolean;
  /** Level rises with the fraction of the army the charge took: `db + range * clamp(share / scale)`, never above `max`. */
  share?: { scale: number; range: number; max: number };
}

const sineSquare = (freq: number, at: number, dur: number): Part[] => [
  { src: 'square', freq, at, dur, db: -14, filter: { type: 'lowpass', freq: 2500 }, env: [4, 0, 1, 40] },
  { src: 'sine', freq, at, dur, db: -10, env: [4, 0, 1, 40] },
];

const TABLE = {
  kill: {
    parts: [{ src: 'sine', freq: 1500, to: 900, sweepMs: 50, dur: 60, env: [2, 40, 0, 20], db: 0, filter: { type: 'highpass', freq: 600 } }],
    db: -18, category: 'kill', priority: 10, cap: 2, bundle: { windowMs: 100, gapMs: 300 }, encode: true,
  },
  contact: {
    parts: [
      { src: 'sine', freq: 140, to: 70, sweepMs: 90, dur: 90, env: [1, 90, 0, 30], db: 0 },
      { src: 'noise', dur: 30, db: -14, filter: { type: 'lowpass', freq: 1500 }, env: [1, 30, 0, 10] },
    ],
    db: -14, category: 'hit', priority: 45, cap: 2, bundle: { windowMs: 80, gapMs: 300 },
    share: { scale: 0.06, range: 6, max: -8 },
  },
  breach: {
    parts: [
      { src: 'square', freq: 110, to: 45, sweepMs: 180, dur: 180, env: [1, 180, 0, 80], db: 0, filter: { type: 'lowpass', freq: 600, to: 200, q: 1 } },
      { src: 'noise', dur: 60, db: -6, filter: { type: 'lowpass', freq: 900 }, env: [1, 60, 0, 20] },
    ],
    db: -9, category: 'hit', priority: 70, cap: 2, bundle: { windowMs: 120, gapMs: 300 }, duck: true,
    share: { scale: 0.1, range: 6, max: -3 },
  },
  fireHit: {
    parts: [{ src: 'triangle', freq: 2400, dur: 18, db: 0, filter: { type: 'highpass', freq: 1500 }, env: [1, 0, 1, 8] }],
    db: -16, category: 'hit', priority: 20, cap: 2, bundle: { windowMs: 60, gapMs: 300 },
  },
  pickPerfect: {
    parts: [523, 659, 784].map((freq, i): Part => ({ src: 'triangle', freq, at: i * 70, dur: 130, env: [4, 60, 0.4, 120], db: 0 })),
    db: -8, category: 'event', priority: 65, cap: 1,
  },
  pickGood: {
    parts: [0, 90].map((at): Part => ({ src: 'triangle', freq: 659, at, dur: 80, env: [4, 0, 1, 30], db: 0 })),
    db: -10, category: 'event', priority: 65, cap: 1,
  },
  /** A RISK pick: a rising tritone, unresolved - neither a reward nor a wrong. */
  pickRisk: {
    parts: [[523, 0], [740, 90]].map(([freq, at]): Part => ({ src: 'triangle', freq, at, dur: 140, env: [4, 40, 0.5, 110], db: 0 })),
    db: -10, category: 'event', priority: 65, cap: 1,
  },
  pickBad: {
    parts: [
      { src: 'square', freq: 659, dur: 100, db: 0, filter: { type: 'lowpass', freq: 1200 }, env: [4, 0, 1, 20] },
      { src: 'square', freq: 622, to: 603, sweepMs: 160, at: 110, dur: 160, db: 0, filter: { type: 'lowpass', freq: 1200 }, env: [4, 0, 1, 40] },
    ],
    db: -12, category: 'event', priority: 65, cap: 1,
  },
  miss: {
    parts: [{ src: 'noise', dur: 160, env: [40, 120, 0, 40], db: 0, filter: { type: 'bandpass', freq: 900, q: 2 } }],
    db: -20, category: 'event', priority: 25, cap: 1, enabled: true,
  },
  rescue: {
    parts: [
      ...[784, 988, 1175, 1568].map((freq, i): Part => ({ src: 'sine', freq, at: i * 60, dur: 140, env: [4, 0, 1, 60], db: 0 })),
      { src: 'sine', freq: 196, dur: 300, db: -18, env: [10, 0, 1, 80] },
    ],
    db: -11, category: 'event', priority: 60, cap: 1,
  },
  wave: {
    parts: [...sineSquare(523, 0, 120), ...sineSquare(784, 90, 120), ...sineSquare(1047, 180, 220)],
    db: -8, category: 'event', priority: 55, cap: 1,
  },
  /** A SHIELD block: a short bright clink, off the fire hit's tick. Bundled like it. */
  block: {
    parts: [
      { src: 'triangle', freq: 1760, dur: 40, db: 0, env: [1, 20, 0.5, 60] },
      { src: 'sine', freq: 3520, dur: 30, db: -8, env: [1, 0, 1, 40] },
    ],
    db: -14, category: 'hit', priority: 32, cap: 2, bundle: { windowMs: 60, gapMs: 250 },
  },
  sense: {
    parts: [[1047, 0], [1319, 120]].map(([freq, at]): Part => ({ src: 'sine', freq, at, dur: 300, env: [30, 100, 0.6, 200], db: 0 })),
    db: -12, category: 'event', priority: 40, cap: 1,
  },
  titanArrive: {
    parts: [
      { src: 'sawtooth', freq: 55, dur: 1500, env: [600, 400, 0.5, 500], db: -10, filter: { type: 'lowpass', freq: 300, q: 1 } },
      { src: 'sine', freq: 55.5, dur: 1500, env: [600, 400, 0.5, 500], db: -10 },
      ...[0, 400, 800].map((at): Part => ({ src: 'square', freq: 220, at, dur: 90, env: [3, 0, 1, 30], db: -14, filter: { type: 'lowpass', freq: 800 } })),
    ],
    db: 0, category: 'titan', priority: 85, cap: 1, duck: true,
  },
  titanPulse: {
    parts: [
      { src: 'sine', freq: 55, dur: 120, env: [5, 100, 0, 40], db: 0 },
      { src: 'square', freq: 110, dur: 120, env: [5, 100, 0, 40], db: -10, filter: { type: 'lowpass', freq: 700 } },
    ],
    db: -16, category: 'titan', priority: 30, cap: 1,
  },
  titanVolley: {
    parts: [{ src: 'square', freq: 330, to: 220, sweepMs: 60, dur: 60, env: [2, 0, 1, 20], db: 0, filter: { type: 'lowpass', freq: 1200 } }],
    db: -14, category: 'titan', priority: 35, cap: 1, enabled: true,
  },
  titanKill: {
    parts: [
      { src: 'noise', dur: 400, env: [2, 0, 1, 60], db: -6, filter: { type: 'lowpass', freq: 1200, to: 150 } },
      { src: 'sawtooth', freq: 160, to: 40, sweepMs: 450, dur: 450, env: [2, 0, 1, 60], db: -9, filter: { type: 'lowpass', freq: 500 } },
      ...[262, 330, 392, 523].map((freq): Part => ({ src: 'sine', freq, at: 350, dur: 700, env: [20, 0, 1, 200], db: -18 })),
    ],
    db: 0, category: 'titan', priority: 90, cap: 1, duck: true,
  },
  titanLand: {
    parts: [
      { src: 'sine', freq: 90, to: 25, sweepMs: 900, dur: 900, env: [5, 0, 1, 100], db: -8 },
      { src: 'noise', dur: 500, env: [2, 0, 1, 80], db: -12, filter: { type: 'lowpass', freq: 900 } },
      { src: 'square', freq: 65, at: 600, dur: 800, env: [10, 0, 1, 200], db: -14, filter: { type: 'lowpass', freq: 400 } },
    ],
    db: 0, category: 'titan', priority: 100, cap: 1, duck: true,
  },
  playerDeath: {
    parts: [
      { src: 'triangle', freq: 440, to: 110, sweepMs: 500, dur: 500, env: [5, 0, 1, 80], db: -6, filter: { type: 'lowpass', freq: 1500, to: 300 } },
      { src: 'noise', dur: 200, env: [2, 0, 1, 60], db: -12, filter: { type: 'bandpass', freq: 600, q: 1 } },
    ],
    db: 0, category: 'event', priority: 95, cap: 1,
  },
  start: {
    parts: [
      { src: 'sine', freq: 660, dur: 180, env: [5, 0, 1, 60], db: -12 },
      { src: 'sine', freq: 1320, dur: 180, env: [5, 0, 1, 60], db: -22 },
    ],
    db: 0, category: 'ui', priority: 5, cap: 1,
  },
  pause: { parts: [{ src: 'sine', freq: 880, dur: 40, env: [2, 0, 1, 15], db: 0 }], db: -16, category: 'ui', priority: 5, cap: 1 },
  resume: { parts: [{ src: 'sine', freq: 1100, dur: 40, env: [2, 0, 1, 15], db: 0 }], db: -16, category: 'ui', priority: 5, cap: 1 },
} satisfies Record<string, Cue>;

export type CueName = keyof typeof TABLE;
export const CUES: Record<CueName, Cue> = TABLE;
export const CUE_NAMES = Object.keys(CUES) as CueName[];

/** Sounding length of a cue including its longest release, ms. */
export function cueDuration(cue: Cue): number {
  let end = 0;
  for (const p of cue.parts) end = Math.max(end, (p.at ?? 0) + p.dur + (p.env?.[3] ?? 20));
  return end;
}
