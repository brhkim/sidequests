/**
 * The cue table: every sound the game makes, as a recipe rather than a file.
 *
 * A cue is a handful of PARTS - an oscillator (plain, FM, or a detuned
 * unison stack) or a noise burst, each with its own envelope, filter, drive
 * and level - mixed under one cue level, then sent to the room
 * (`space.ts`) by `send`. `synth.ts` turns a recipe into nodes on ANY
 * BaseAudioContext, so the same table plays live and renders offline in
 * `npm run audio`. Nothing here is loaded at runtime; the palette is code,
 * like the textures.
 *
 * The 2026-09-24 audit rebuilt it on three rules from game sound practice:
 * - **Transient, body, tail.** Every impact has a short click or noise
 *   transient for attack (it is also what a phone speaker reproduces of a
 *   low thud - the missing-fundamental trick), a body that names the event,
 *   and a tail that is the room's reverb, not the recipe's.
 * - **Rewards are in the music's key.** Pitched positive cues name a
 *   `tone` - a chord tone, a scale step, or a step of the key - resolved
 *   against the live harmony when they play (`harmony.ts`), so a PERFECT is
 *   the chord under it and a run of kills climbs it. Damage and failure are
 *   deliberately noisy, detuned or a flat second: they should sound wrong.
 * - **Nothing below 150 Hz alone.** A phone speaker drops it; every low
 *   body carries a partial, a drive or a noise layer above 200 Hz.
 *
 * Levels are dB relative to full scale BEFORE the master (-4 dB), the glue
 * compressor and the limiter. Times are milliseconds.
 */
export type Wave = 'sine' | 'square' | 'triangle' | 'sawtooth';
export type Category = 'kill' | 'hit' | 'event' | 'titan' | 'ui';

export interface Filt {
  type: BiquadFilterType;
  freq: number;
  /** Sweep target, reached over `ms` (default: the part's `sweepMs`, else its duration). */
  to?: number;
  ms?: number;
  q?: number;
  /** Scale the cutoff with the note's pitch (relative to 440 Hz), for music notes. */
  track?: boolean;
}

/**
 * A pitch named musically, resolved at play time: `chord` is a tone index
 * of the current chord (0 root, 1 third, 2 fifth, 3 the root an octave up;
 * a streak's `climb` adds to it), `deg` a scale step above the chord's root,
 * `step` a scale step above the tonic, `key` semitones above the tonic. One
 * of the four; `oct` is the octave (4 holds A440), `semis` a final offset.
 */
export interface ToneRef { chord?: number; deg?: number; step?: number; key?: number; oct: number; semis?: number }

export interface Part {
  src: Wave | 'noise';
  /** Hz, when there is no `tone`. Ignored by noise. `to` sweeps exponentially over `sweepMs`. */
  freq?: number;
  tone?: ToneRef;
  to?: number;
  /** Sweep by semitones instead of to a frequency (works with `tone`). */
  bend?: number;
  sweepMs?: number;
  /** Frequency modulation: a modulator at `ratio` x the carrier, `index` x carrier Hz deep, decaying to `floor` of that. */
  fm?: { ratio: number; index: number; decayMs?: number; floor?: number };
  /** Vibrato: `cents` deep at `rate` Hz, faded in after `delayMs`. */
  vib?: { rate: number; cents: number; delayMs?: number };
  /** A detuned stack: `voices` oscillators spread over +-`cents`. */
  unison?: { voices: number; cents: number };
  /** Soft clip, 0-1: grit and harmonics a small speaker can play. */
  drive?: number;
  /** Stereo position inside the cue, -1 to 1. */
  pan?: number;
  /** Start offset within the cue and sounding length, ms. */
  at?: number;
  dur: number;
  /** `false` keeps `dur` when a music note asks for a longer `hold` (a pluck's click). */
  sustain?: boolean;
  /** attack ms, decay ms (exponential), sustain level, release ms. Default: 2 / 0 / 1 / 20. */
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
  /** Pulls the kill and hit buses down 6 dB and the music 5 dB, for 300 ms. */
  duck?: boolean;
  /** Reverb send, linear. */
  send?: number;
  /** Collapsed by `collapse.ts`: `window` tallies, `gap` says when a lone event plays at once. */
  bundle?: { windowMs: number; gapMs: number };
  /** Bundle size is encoded as weight - a sub-partial and a little less level (kill only). */
  encode?: boolean;
  /** Level rises with the fraction of the army the charge took: `db + range * clamp(share / scale)`, never above `max`. */
  share?: { scale: number; range: number; max: number };
}

/** A pluck-bell: a sine carrier FM'd at 2:1, the index falling fast - the body of every reward. */
const bell = (tone: ToneRef, at: number, dur: number, db: number, pan = 0, index = 0.9): Part => ({
  src: 'sine', tone, at, dur, db, pan, fm: { ratio: 2, index, decayMs: dur * 0.6, floor: 0.05 }, env: [2, dur, 0.15, dur * 0.8],
});
/** A short noise tick: the transient that makes a cue land. */
const tick = (at: number, db: number, hp = 4000, ms = 5): Part => ({
  src: 'noise', at, dur: ms, db, filter: { type: 'highpass', freq: hp }, env: [0.5, ms, 0, 4],
});
/** A detuned-saw chord tone, filtered: pads, stabs and blooms. */
const saws = (tone: ToneRef, at: number, dur: number, db: number, env: Part['env'], cut: number, to?: number): Part => ({
  src: 'sawtooth', tone, at, dur, db, env, unison: { voices: 3, cents: 12 }, filter: { type: 'lowpass', freq: cut, to, q: 0.8 },
});

const TABLE = {
  /** One kill: a noise click and a small bell on a chord tone; successive kills climb the chord. */
  kill: {
    parts: [
      tick(0, -9, 3500, 4),
      { src: 'sine', tone: { chord: 0, oct: 5 }, dur: 70, db: 0, fm: { ratio: 2, index: 1.1, decayMs: 35, floor: 0.1 }, env: [1, 70, 0, 25] },
      { src: 'sine', freq: 190, to: 95, sweepMs: 40, dur: 40, db: -13, env: [1, 35, 0, 15] },
    ],
    db: -17, category: 'kill', priority: 10, cap: 2, send: 0.12, bundle: { windowMs: 100, gapMs: 300 }, encode: true,
  },
  /** A body walking into the ring: click, a driven thud, a crunch. */
  contact: {
    parts: [
      tick(0, -8, 2500, 6),
      { src: 'sine', freq: 160, to: 55, sweepMs: 110, dur: 120, db: 0, drive: 0.35, env: [1, 110, 0, 40] },
      { src: 'triangle', freq: 330, to: 140, sweepMs: 60, dur: 60, db: -11, env: [1, 55, 0, 20] },
      { src: 'noise', dur: 60, db: -10, filter: { type: 'lowpass', freq: 1600, to: 400 }, env: [1, 50, 0, 20] },
    ],
    db: -13, category: 'hit', priority: 45, cap: 2, send: 0.08, bundle: { windowMs: 80, gapMs: 300 },
    share: { scale: 0.06, range: 6, max: -7 },
  },
  /** A body past the line: a heavy driven drop, a buzz, and a flat second against the root - wrong on purpose. */
  breach: {
    parts: [
      { src: 'sine', freq: 110, to: 38, sweepMs: 260, dur: 280, db: 0, drive: 0.45, env: [1, 260, 0, 80] },
      { src: 'sawtooth', freq: 82, dur: 220, db: -8, drive: 0.6, filter: { type: 'lowpass', freq: 900, to: 200 }, env: [2, 200, 0, 60] },
      { src: 'noise', dur: 90, db: -8, filter: { type: 'lowpass', freq: 1200 }, env: [1, 80, 0, 30] },
      { src: 'square', tone: { key: 1, oct: 4 }, dur: 120, db: -15, filter: { type: 'lowpass', freq: 1500 }, env: [2, 0, 1, 60] },
    ],
    db: -9, category: 'hit', priority: 70, cap: 2, send: 0.1, bundle: { windowMs: 120, gapMs: 300 }, duck: true,
    share: { scale: 0.1, range: 6, max: -3 },
  },
  /** An enemy bullet landing: a band of noise and a driven drop. Damage, so not in key. */
  fireHit: {
    parts: [
      { src: 'noise', dur: 25, db: -2, filter: { type: 'bandpass', freq: 1800, q: 1.2 }, env: [0.5, 20, 0, 10] },
      { src: 'square', freq: 420, to: 140, sweepMs: 50, dur: 50, db: -9, drive: 0.5, filter: { type: 'lowpass', freq: 2000 }, env: [1, 40, 0, 15] },
    ],
    db: -13, category: 'hit', priority: 20, cap: 2, send: 0.05, bundle: { windowMs: 60, gapMs: 300 },
  },
  /**
   * The signature moment. A swish, the chord under it arpeggiated as bells
   * across the stereo field, a sparkle on top, a bloom of saws and a soft
   * sub. A PERFECT streak climbs the arpeggio a chord tone per pick.
   */
  pickPerfect: {
    parts: [
      { src: 'noise', dur: 60, db: -15, filter: { type: 'bandpass', freq: 7000, q: 0.8 }, env: [10, 50, 0, 20] },
      bell({ chord: 0, oct: 5 }, 0, 220, 0, -0.25),
      bell({ chord: 1, oct: 5 }, 40, 220, -1, -0.08),
      bell({ chord: 2, oct: 5 }, 80, 220, -2, 0.08),
      bell({ chord: 3, oct: 5 }, 120, 320, -2, 0.25),
      { src: 'sine', tone: { chord: 4, oct: 5 }, at: 150, dur: 300, db: -10, fm: { ratio: 4, index: 0.5, decayMs: 200 }, env: [2, 300, 0, 200] },
      saws({ chord: 0, oct: 4 }, 60, 260, -20, [40, 0, 1, 300], 1800, 3200),
      saws({ chord: 2, oct: 4 }, 60, 260, -21, [40, 0, 1, 300], 1800, 3200),
      { src: 'sine', freq: 160, to: 70, sweepMs: 160, dur: 180, db: -9, env: [2, 170, 0, 40] },
    ],
    db: -9, category: 'event', priority: 65, cap: 1, send: 0.35,
  },
  /** Two chord tones, the fifth rising to the root: pleased, not thrilled. */
  pickGood: {
    parts: [
      { src: 'noise', dur: 40, db: -19, filter: { type: 'bandpass', freq: 6000, q: 0.8 }, env: [6, 30, 0, 15] },
      bell({ chord: 2, oct: 4 }, 0, 160, 0, -0.12, 0.6),
      bell({ chord: 3, oct: 4 }, 70, 220, 0, 0.12, 0.6),
      { src: 'sine', freq: 150, to: 75, sweepMs: 120, dur: 130, db: -12, env: [2, 120, 0, 30] },
    ],
    db: -11, category: 'event', priority: 65, cap: 1, send: 0.25,
  },
  /** A flat second above the root, then the root bending flat: deflated, never harsh. */
  pickBad: {
    parts: [
      { src: 'square', tone: { chord: 0, oct: 4, semis: 1 }, dur: 110, db: -2, drive: 0.2, filter: { type: 'lowpass', freq: 1100 }, env: [3, 0, 1, 30] },
      { src: 'square', tone: { chord: 0, oct: 4 }, bend: -1.5, sweepMs: 220, at: 120, dur: 220, db: 0, drive: 0.2, filter: { type: 'lowpass', freq: 1100, to: 500 }, env: [3, 0, 1, 60] },
    ],
    db: -13, category: 'event', priority: 65, cap: 1, send: 0.08,
  },
  /** INVEST: root, fourth, fifth - a sus4 that does not resolve. Neither a reward nor a wrong. */
  pickRisk: {
    parts: [
      { src: 'sine', tone: { deg: 0, oct: 5 }, dur: 380, db: 0, pan: -0.15, fm: { ratio: 3, index: 1, decayMs: 250 }, env: [3, 350, 0.1, 250] },
      { src: 'sine', tone: { deg: 3, oct: 5 }, at: 90, dur: 380, db: -1, fm: { ratio: 3, index: 1, decayMs: 250 }, env: [3, 350, 0.1, 250] },
      { src: 'sine', tone: { deg: 4, oct: 5 }, at: 180, dur: 420, db: -2, pan: 0.15, fm: { ratio: 3, index: 1, decayMs: 250 }, env: [3, 380, 0.1, 280] },
      { src: 'triangle', tone: { deg: 0, oct: 3 }, dur: 500, db: -14, env: [60, 0, 1, 300] },
    ],
    db: -12, category: 'event', priority: 65, cap: 1, send: 0.4,
  },
  /** A passed offer: a falling whoosh and a low dud. */
  miss: {
    parts: [
      { src: 'noise', dur: 220, db: 0, filter: { type: 'bandpass', freq: 2400, to: 500, q: 1.5 }, env: [60, 160, 0, 40] },
      { src: 'sine', tone: { chord: 0, oct: 3 }, bend: -2, dur: 90, db: -12, env: [4, 80, 0, 30] },
    ],
    db: -19, category: 'event', priority: 25, cap: 1, send: 0.15,
  },
  /** An opened cage: a run up the chord, then a bloom of the chord and air. */
  rescue: {
    parts: [
      ...[0, 1, 2, 3, 4].map((c, i): Part => bell({ chord: c, oct: 5 }, i * 45, 130, -i * 0.5, -0.3 + i * 0.15, 0.6)),
      saws({ chord: 0, oct: 4 }, 180, 350, -15, [40, 0, 1, 300], 1800, 3000),
      saws({ chord: 1, oct: 4 }, 180, 350, -16, [40, 0, 1, 300], 1800, 3000),
      saws({ chord: 2, oct: 4 }, 180, 350, -16, [40, 0, 1, 300], 1800, 3000),
      { src: 'noise', at: 180, dur: 250, db: -22, filter: { type: 'highpass', freq: 8000 }, env: [20, 200, 0, 100] },
    ],
    db: -11, category: 'event', priority: 60, cap: 1, send: 0.35,
  },
  /** A new wave: an impact, a crash of filtered noise, and a chord stab opening up. */
  wave: {
    parts: [
      { src: 'sine', freq: 140, to: 50, sweepMs: 200, dur: 220, db: -4, env: [1, 200, 0, 60] },
      { src: 'noise', dur: 300, db: -13, filter: { type: 'lowpass', freq: 6000, to: 900 }, env: [2, 250, 0, 80] },
      saws({ chord: 0, oct: 4 }, 0, 320, -10, [3, 300, 0.3, 200], 800, 3500),
      saws({ chord: 2, oct: 4 }, 0, 320, -11, [3, 300, 0.3, 200], 800, 3500),
      saws({ chord: 3, oct: 4 }, 0, 320, -12, [3, 300, 0.3, 200], 800, 3500),
    ],
    db: -10, category: 'event', priority: 55, cap: 1, send: 0.3,
  },
  /** A SHIELD block: a bright metallic tink on the chord's fifth. Bundled like the fire hit. */
  block: {
    parts: [
      tick(0, -12, 6000, 6),
      { src: 'sine', tone: { chord: 2, oct: 6 }, dur: 140, db: 0, fm: { ratio: 3.5, index: 2.5, decayMs: 60, floor: 0.1 }, env: [0.5, 140, 0, 40] },
      { src: 'sine', tone: { chord: 0, oct: 7 }, dur: 40, db: -10, env: [0.5, 40, 0, 20] },
    ],
    db: -16, category: 'hit', priority: 32, cap: 2, send: 0.25, bundle: { windowMs: 60, gapMs: 250 },
  },
  /** A sensed offer: two glassy bells, fifth to octave, wet. */
  sense: {
    parts: [
      { src: 'sine', tone: { chord: 2, oct: 6 }, dur: 500, db: 0, pan: -0.2, fm: { ratio: 3.5, index: 1.2, decayMs: 300 }, env: [5, 500, 0, 300] },
      { src: 'sine', tone: { chord: 3, oct: 6 }, at: 110, dur: 500, db: -2, pan: 0.2, fm: { ratio: 3.5, index: 1.2, decayMs: 300 }, env: [5, 500, 0, 300] },
    ],
    db: -16, category: 'event', priority: 40, cap: 1, send: 0.5,
  },
  /** The Titan: an impact, a driven drone on the tonic swelling under a horn fifth, three alarms. */
  titanArrive: {
    parts: [
      { src: 'noise', dur: 400, db: -10, filter: { type: 'lowpass', freq: 2000, to: 200 }, env: [1, 380, 0, 60] },
      { src: 'sawtooth', tone: { key: 0, oct: 1 }, dur: 1600, db: -6, drive: 0.5, unison: { voices: 3, cents: 18 }, filter: { type: 'lowpass', freq: 200, to: 900, ms: 1400, q: 1 }, env: [700, 300, 0.6, 600] },
      { src: 'sine', tone: { key: 0, oct: 1 }, dur: 1600, db: -6, env: [600, 400, 0.6, 600] },
      saws({ key: 0, oct: 3 }, 300, 1000, -13, [400, 0, 1, 500], 600, 1400),
      saws({ key: 7, oct: 3 }, 300, 1000, -14, [400, 0, 1, 500], 600, 1400),
      ...[0, 400, 800].map((at): Part => ({ src: 'square', tone: { key: 0, oct: 4 }, at, dur: 100, db: -15, filter: { type: 'lowpass', freq: 1200 }, env: [3, 0, 1, 30] })),
    ],
    db: -6, category: 'titan', priority: 85, cap: 1, duck: true, send: 0.3,
  },
  /** Its heart: lub-dub on the tonic, with a square an octave up so a phone can hear it. */
  titanPulse: {
    parts: [
      { src: 'sine', tone: { key: 0, oct: 1 }, dur: 90, db: 0, env: [2, 90, 0, 30] },
      { src: 'square', tone: { key: 0, oct: 2 }, dur: 90, db: -13, filter: { type: 'lowpass', freq: 500 }, env: [2, 80, 0, 30] },
      { src: 'noise', dur: 8, db: -15, filter: { type: 'lowpass', freq: 800 }, env: [0.5, 8, 0, 4] },
      { src: 'sine', tone: { key: 0, oct: 1 }, at: 170, dur: 80, db: -4, env: [2, 80, 0, 30] },
      { src: 'square', tone: { key: 0, oct: 2 }, at: 170, dur: 80, db: -16, filter: { type: 'lowpass', freq: 500 }, env: [2, 70, 0, 30] },
    ],
    db: -14, category: 'titan', priority: 30, cap: 1,
  },
  /** A Titan volley: a quiet thoom. */
  titanVolley: {
    parts: [
      { src: 'square', freq: 260, to: 130, sweepMs: 70, dur: 70, db: 0, drive: 0.3, filter: { type: 'lowpass', freq: 1100 }, env: [2, 60, 0, 20] },
      { src: 'noise', dur: 50, db: -10, filter: { type: 'bandpass', freq: 900 }, env: [1, 45, 0, 15] },
    ],
    db: -16, category: 'titan', priority: 35, cap: 1, send: 0.1,
  },
  /** The Titan falls: an explosion, a sub drop, then the tonic MAJOR (a Picardy third) and a sparkle. */
  titanKill: {
    parts: [
      { src: 'noise', dur: 700, db: -3, drive: 0.4, filter: { type: 'lowpass', freq: 3000, to: 120 }, env: [1, 600, 0, 200] },
      { src: 'sine', freq: 120, to: 30, sweepMs: 700, dur: 700, db: -3, env: [1, 650, 0, 100] },
      { src: 'sawtooth', freq: 160, to: 40, sweepMs: 450, dur: 450, db: -11, drive: 0.6, filter: { type: 'lowpass', freq: 700 }, env: [2, 420, 0, 60] },
      ...[0, 4, 7, 12].map((k): Part => saws({ key: k, oct: 4 }, 350, 900, -15, [30, 0, 1, 700], 1200, 3500)),
      ...[12, 16, 19, 24].map((k, i): Part => bell({ key: k, oct: 5 }, 400 + i * 55, 260, -8, -0.3 + i * 0.2, 0.7)),
    ],
    db: 0, category: 'titan', priority: 90, cap: 1, duck: true, send: 0.35,
  },
  /** The Titan lands: a drop, a rumble, a flat-second cluster low down, a door closing. */
  titanLand: {
    parts: [
      { src: 'sine', freq: 90, to: 25, sweepMs: 900, dur: 900, db: -6, drive: 0.3, env: [5, 850, 0, 100] },
      { src: 'noise', dur: 600, db: -8, filter: { type: 'lowpass', freq: 1500, to: 100 }, env: [2, 550, 0, 100] },
      saws({ key: 0, oct: 2 }, 200, 900, -14, [20, 0, 1, 600], 500),
      saws({ key: 1, oct: 2 }, 200, 900, -14, [20, 0, 1, 600], 500),
      { src: 'noise', at: 700, dur: 80, db: -6, filter: { type: 'lowpass', freq: 800 }, env: [1, 70, 0, 30] },
      { src: 'sine', freq: 70, to: 40, sweepMs: 150, at: 700, dur: 160, db: -4, env: [1, 150, 0, 60] },
    ],
    db: -1, category: 'titan', priority: 100, cap: 1, duck: true, send: 0.3,
  },
  /** Overrun: a power-down - a saw falling like a tape stopping, the filter closing on it. */
  playerDeath: {
    parts: [
      { src: 'sawtooth', freq: 440, to: 40, sweepMs: 700, dur: 700, db: -6, drive: 0.3, filter: { type: 'lowpass', freq: 3000, to: 200 }, env: [5, 0, 1, 120] },
      { src: 'square', freq: 220, to: 20, sweepMs: 700, dur: 700, db: -12, filter: { type: 'lowpass', freq: 800 }, env: [5, 0, 1, 120] },
      { src: 'noise', dur: 250, db: -12, filter: { type: 'bandpass', freq: 700, q: 1 }, env: [2, 230, 0, 60] },
      { src: 'sine', freq: 100, to: 40, sweepMs: 200, dur: 220, db: -6, env: [1, 200, 0, 60] },
    ],
    db: -6, category: 'event', priority: 95, cap: 1, send: 0.25,
  },
  /** Go: a rising whoosh into a chord stab and a thump. Also the proof the browser unlocked. */
  start: {
    parts: [
      { src: 'noise', dur: 250, db: -10, filter: { type: 'bandpass', freq: 400, to: 5000, q: 1.2 }, env: [150, 0, 1, 60] },
      saws({ chord: 0, oct: 4 }, 220, 280, -10, [2, 250, 0.2, 200], 2200),
      saws({ chord: 2, oct: 4 }, 220, 280, -11, [2, 250, 0.2, 200], 2200),
      saws({ chord: 3, oct: 4 }, 220, 280, -12, [2, 250, 0.2, 200], 2200),
      { src: 'sine', freq: 150, to: 55, sweepMs: 150, at: 220, dur: 170, db: -4, env: [1, 150, 0, 40] },
    ],
    db: -7, category: 'ui', priority: 5, cap: 1, send: 0.3,
  },
  pause: {
    parts: [bell({ chord: 3, oct: 5 }, 0, 90, 0, 0, 0.4), bell({ chord: 2, oct: 5 }, 60, 120, -1, 0, 0.4)],
    db: -19, category: 'ui', priority: 5, cap: 1, send: 0.2,
  },
  resume: {
    parts: [bell({ chord: 2, oct: 5 }, 0, 90, 0, 0, 0.4), bell({ chord: 3, oct: 5 }, 60, 120, -1, 0, 0.4)],
    db: -19, category: 'ui', priority: 5, cap: 1, send: 0.2,
  },
  /** Any button: the smallest tick there is, on the root. */
  uitap: {
    parts: [tick(0, -6, 3000, 4), { src: 'sine', tone: { chord: 0, oct: 6 }, dur: 25, db: 0, env: [0.5, 25, 0, 15] }],
    db: -19, category: 'ui', priority: 4, cap: 2, send: 0.08,
  },
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
