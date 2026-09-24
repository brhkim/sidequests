/**
 * Pitch as music rather than as Hz. The music engine publishes the chord it
 * is playing into `HARMONY`, and every pitched effect resolves its notes
 * against it at play time - so a PERFECT is an arpeggio of the chord under
 * it, a kill is a chord tone, and nothing the player does can play a wrong
 * note against the track (Tetris Effect's trick: every input lands inside
 * the mode the music is in). With music off the harmony holds the last
 * track's tonic chord, so the effects still agree with each other.
 *
 * Everything is MIDI note numbers until the last moment. Pure: no clock, no
 * randomness, nothing from `systems/`.
 */

/** Semitone offsets from the tonic. */
export const SCALES = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
} as const;
export type ScaleName = keyof typeof SCALES;

/** A chord is a scale degree (0-based) stacked in scale thirds. */
export interface Chord {
  deg: number;
  scale?: ScaleName;
  /** Adds the seventh to pads and stabs; the tone ladder stays a triad. */
  seventh?: boolean;
  /** Suspends the third to the fourth (sus4), for an unresolved bar. */
  sus?: boolean;
}

export interface Harmony {
  /** MIDI note of the tonic in octave 0 terms: 0 = C, 9 = A. */
  key: number;
  scale: ScaleName;
  chord: Chord;
}

export const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Scale degree `d` (any integer; wraps into octaves) as a semitone offset from the tonic. */
export function degree(scale: ScaleName, d: number): number {
  const s = SCALES[scale];
  const oct = Math.floor(d / s.length);
  return s[((d % s.length) + s.length) % s.length] + 12 * oct;
}

/**
 * The chord's root as a semitone offset from the tonic, FOLDED into -5..+6:
 * a chord on the sixth degree sits a third below the tonic, not a sixth
 * above, so a line written in chord tones moves by steps between chords
 * instead of leaping an octave whenever the root passes the tritone.
 */
export function rootOffset(h: Harmony): number {
  const r = degree(h.chord.scale ?? h.scale, h.chord.deg) % 12;
  return r > 6 ? r - 12 : r;
}

/**
 * The chord's tones as semitone offsets from its ROOT: three for a triad,
 * four with the seventh - but `tone` walks the TRIAD only, so a line written
 * in tone indices means the same thing on every chord.
 */
export function chordTones(h: Harmony, withSeventh = false): number[] {
  const sc = h.chord.scale ?? h.scale;
  const r = h.chord.deg;
  const base = degree(sc, r);
  const third = h.chord.sus ? degree(sc, r + 3) : degree(sc, r + 2);
  const out = [0, third - base, degree(sc, r + 4) - base];
  if (withSeventh && h.chord.seventh) out.push(degree(sc, r + 6) - base);
  return out;
}

/**
 * Tone index `i` of the current chord as a MIDI note, around octave `oct`
 * (octave 4 holds A440 = 69). 0 root, 1 third, 2 fifth, 3 the root an
 * octave up, and so on; negative indices walk down.
 */
export function tone(h: Harmony, i: number, oct: number): number {
  const t = chordTones(h);
  const o = Math.floor(i / 3);
  const k = ((i % 3) + 3) % 3;
  return 12 * (oct + 1) + h.key + rootOffset(h) + t[k] + 12 * o;
}

/** Scale step `n` above the chord's root, folded like the root. */
export function above(h: Harmony, n: number, oct: number): number {
  const sc = h.chord.scale ?? h.scale;
  return 12 * (oct + 1) + h.key + rootOffset(h) + degree(sc, h.chord.deg + n) - degree(sc, h.chord.deg);
}

/** Scale step `d` of the key (not the chord) as MIDI, around octave `oct`. */
export function step(h: Harmony, d: number, oct: number): number {
  return 12 * (oct + 1) + h.key + degree(h.chord.scale ?? h.scale, d);
}

/** The nearest scale step above (dir 1) or below (dir -1) a MIDI note. */
export function neighbour(h: Harmony, midi: number, dir: 1 | -1): number {
  const s = SCALES[h.chord.scale ?? h.scale];
  for (let n = midi + dir; Math.abs(n - midi) <= 12; n += dir) {
    const pc = (((n - h.key) % 12) + 12) % 12;
    if ((s as readonly number[]).includes(pc)) return n;
  }
  return midi + dir * 2;
}

/**
 * The live harmony every pitched effect reads. The music engine writes it
 * once a bar; with music off it stays on the last tonic. A-minor to start.
 */
export const HARMONY: Harmony = { key: 9, scale: 'aeolian', chord: { deg: 0 } };

export function setHarmony(h: Harmony): void {
  HARMONY.key = h.key;
  HARMONY.scale = h.scale;
  HARMONY.chord = h.chord;
}
