/**
 * The music's instruments, as the same `Cue` recipes the effects use, so one
 * builder (`synth.ts`) plays both. Tonal recipes are written at 440 Hz and
 * played at `pitch = note / 440`; a note's length arrives as `hold`, and a
 * part marked `sustain: false` (a click, a pluck's attack) keeps its own.
 *
 * Every low instrument carries harmonics a phone speaker can play: the kick
 * has a click and a 300 Hz knock over its 50 Hz body, the basses are saws or
 * squares through a filter rather than bare sines.
 */
import type { Cue, Part } from '../cues';

const cue = (parts: Part[], db = 0): Cue => ({ parts, db, category: 'event', priority: 0, cap: 99 });
const click = (db: number, hp = 3000, ms = 3): Part => ({ src: 'noise', dur: ms, db, sustain: false, filter: { type: 'highpass', freq: hp }, env: [0.3, ms, 0, 3] });

/** Kits: a punchy electronic one and a chip one built from squares and noise. */
export const KITS = {
  punch: {
    kick: cue([
      click(-8),
      { src: 'sine', freq: 160, to: 48, sweepMs: 80, dur: 280, db: 0, drive: 0.25, env: [0.5, 260, 0, 40] },
      { src: 'triangle', freq: 320, to: 110, sweepMs: 35, dur: 45, db: -10, env: [0.5, 40, 0, 10] },
    ]),
    snare: cue([
      { src: 'noise', dur: 190, db: -2, filter: { type: 'bandpass', freq: 1900, q: 0.7 }, env: [0.5, 170, 0, 60] },
      { src: 'triangle', freq: 200, to: 165, sweepMs: 60, dur: 90, db: -5, env: [0.5, 80, 0, 20] },
      { src: 'noise', dur: 70, db: -10, filter: { type: 'highpass', freq: 5500 }, env: [0.5, 60, 0, 20] },
    ]),
    hat: cue([{ src: 'noise', dur: 32, db: 0, filter: { type: 'highpass', freq: 8500 }, env: [0.3, 30, 0, 10] }]),
    open: cue([{ src: 'noise', dur: 220, db: -2, filter: { type: 'highpass', freq: 7200 }, env: [1, 200, 0, 60] }]),
    perc: cue([
      { src: 'sine', freq: 420, to: 260, sweepMs: 50, dur: 70, db: 0, env: [0.5, 65, 0, 20] },
      click(-10, 2500, 4),
    ]),
    crash: cue([
      { src: 'noise', dur: 1400, db: 0, filter: { type: 'highpass', freq: 4500 }, env: [1, 1300, 0, 300] },
      { src: 'noise', dur: 900, db: -8, filter: { type: 'bandpass', freq: 8000, q: 0.6 }, env: [1, 850, 0, 200] },
    ]),
    riser: cue([
      { src: 'noise', dur: 2000, db: 0, filter: { type: 'bandpass', freq: 300, to: 7000, q: 1.4 }, env: [4000, 0, 1, 80] },
    ]),
  },
  chip: {
    kick: cue([
      { src: 'square', freq: 220, to: 40, sweepMs: 60, dur: 90, db: -2, filter: { type: 'lowpass', freq: 2200 }, env: [0.5, 85, 0, 15] },
      { src: 'sine', freq: 130, to: 45, sweepMs: 70, dur: 140, db: 0, env: [0.5, 130, 0, 20] },
    ]),
    snare: cue([
      { src: 'noise', dur: 110, db: 0, filter: { type: 'lowpass', freq: 7000 }, env: [0.5, 100, 0, 20] },
      { src: 'square', freq: 240, to: 120, sweepMs: 40, dur: 45, db: -9, env: [0.5, 40, 0, 10] },
    ]),
    hat: cue([{ src: 'noise', dur: 18, db: -1, filter: { type: 'highpass', freq: 9500 }, env: [0.3, 16, 0, 6] }]),
    open: cue([{ src: 'noise', dur: 120, db: -3, filter: { type: 'highpass', freq: 8000 }, env: [0.5, 110, 0, 30] }]),
    perc: cue([{ src: 'square', freq: 880, to: 440, sweepMs: 30, dur: 40, db: -6, env: [0.5, 35, 0, 10] }]),
    crash: cue([{ src: 'noise', dur: 900, db: -2, filter: { type: 'highpass', freq: 5000 }, env: [1, 850, 0, 200] }]),
    riser: cue([{ src: 'square', freq: 110, to: 880, sweepMs: 2000, dur: 2000, db: -8, filter: { type: 'lowpass', freq: 3000 }, env: [3000, 0, 1, 60] }]),
  },
} as const satisfies Record<string, Record<string, Cue>>;

/** A plucked, filtered saw bass with a sine under it: the synthwave / house bass. */
export const bassPluck = (cut = 1300, to = 320, drive = 0.2): Cue => cue([
  { src: 'sawtooth', freq: 440, dur: 200, db: -2, drive, filter: { type: 'lowpass', freq: cut, to, ms: 180, q: 3 }, env: [2, 220, 0.55, 50] },
  { src: 'sine', freq: 440, dur: 200, db: -4, env: [2, 0, 1, 50] },
]);

/** A detuned-saw reese, slowly filtered: the drum and bass bass. */
export const bassReese = (): Cue => cue([
  { src: 'sawtooth', freq: 440, dur: 400, db: -4, drive: 0.45, unison: { voices: 2, cents: 16 }, filter: { type: 'lowpass', freq: 380, to: 900, ms: 900, q: 2 }, env: [8, 0, 1, 90] },
  { src: 'sine', freq: 440, dur: 400, db: -3, env: [4, 0, 1, 80] },
]);

/** A triangle with a square edge: the chip bass. */
export const bassChip = (): Cue => cue([
  { src: 'triangle', freq: 440, dur: 150, db: 0, env: [1, 0, 1, 30] },
  { src: 'square', freq: 440, dur: 150, db: -14, filter: { type: 'lowpass', freq: 1200 }, env: [1, 90, 0.4, 30] },
]);

/** A slow, wide pad of detuned saws; `cut` sets how dark. */
export const padSaws = (cut = 1600, attack = 450): Cue => cue([
  { src: 'sawtooth', freq: 440, dur: 1000, db: 0, unison: { voices: 3, cents: 14 }, filter: { type: 'lowpass', freq: cut, q: 0.6 }, env: [attack, 0, 1, 900] },
  { src: 'triangle', freq: 440, dur: 1000, db: -8, env: [attack, 0, 1, 900] },
]);

/** A square pad for the chip track: thin, bright, short release. */
export const padChip = (): Cue => cue([
  { src: 'square', freq: 440, dur: 1000, db: -4, filter: { type: 'lowpass', freq: 2400 }, env: [60, 0, 1, 200] },
]);

/** A plucked arp: a filtered saw (or square) with a fast envelope. */
export const arpPluck = (src: 'sawtooth' | 'square' = 'sawtooth', cut = 3800, to = 700): Cue => cue([
  { src, freq: 440, dur: 110, db: 0, filter: { type: 'lowpass', freq: cut, to, ms: 120, q: 4, track: true }, env: [1, 140, 0, 60] },
]);

/** An FM bell arp: glassy, for the darker tracks. */
export const arpBell = (): Cue => cue([
  { src: 'sine', freq: 440, dur: 160, db: 0, fm: { ratio: 3.5, index: 1.4, decayMs: 120, floor: 0.1 }, env: [1, 220, 0, 120] },
]);

/** A lead: detuned saws (or a square) with a touch of vibrato, `bright` the filter. */
export const leadSaw = (bright = 3200): Cue => cue([
  { src: 'sawtooth', freq: 440, dur: 200, db: -2, unison: { voices: 2, cents: 9 }, vib: { rate: 5.2, cents: 14, delayMs: 180 }, filter: { type: 'lowpass', freq: bright, q: 1.2, track: true }, env: [10, 0, 1, 140] },
  { src: 'square', freq: 440, dur: 200, db: -12, filter: { type: 'lowpass', freq: 2000 }, env: [10, 0, 1, 140] },
]);

export const leadSquare = (): Cue => cue([
  { src: 'square', freq: 440, dur: 200, db: -3, vib: { rate: 6, cents: 18, delayMs: 140 }, filter: { type: 'lowpass', freq: 5000 }, env: [2, 60, 0.7, 60] },
]);

export const leadBell = (): Cue => cue([
  { src: 'sine', freq: 440, dur: 300, db: 0, fm: { ratio: 2, index: 1.6, decayMs: 260, floor: 0.2 }, vib: { rate: 4.5, cents: 10, delayMs: 250 }, env: [3, 500, 0.3, 300] },
]);

/** A stab: a saw chord with a snapping filter. */
export const stabSaw = (): Cue => cue([
  { src: 'sawtooth', freq: 440, dur: 120, db: 0, unison: { voices: 2, cents: 10 }, filter: { type: 'lowpass', freq: 3200, to: 500, ms: 160, q: 2 }, env: [1, 180, 0, 80] },
]);
