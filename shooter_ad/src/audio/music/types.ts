/**
 * The shape of a track. A track is DATA - authored cells the composer
 * re-sequences and layers - not a recording and not free generation: every
 * bar is an authored pattern played over an authored chord, so the variety
 * comes from which cells meet, never from random notes.
 *
 * Grid: 4/4, sixteen steps a bar, phrases of eight bars.
 *
 * Line tokens, one character a sixteenth (spaces and `|` are ignored):
 *   0-6   a tone of the bar's chord (0 root, 1 third, 2 fifth, 3 root an
 *         octave up ...), in the layer's octave
 *   a b   a tone BELOW the root (a = the fifth below, b = the third below)
 *   + -   the scale step above / below the previous note
 *   _     hold the previous note; .  rest
 *   x     (stab lines) the whole chord
 * Drum tokens: X accent, x hit, g ghost, . rest.
 */
import type { Cue } from '../cues';
import type { Chord, ScaleName } from '../harmony';

export type Drum = 'kick' | 'snare' | 'hat' | 'open' | 'perc' | 'crash' | 'riser';
export type Tonal = 'bass' | 'pad' | 'arp' | 'lead' | 'stab';
export type Layer = Drum | Tonal;

export interface DrumSet { kick?: string; snare?: string; hat?: string; open?: string; perc?: string }

export interface Progression {
  /** One chord a bar; a phrase plays it to eight bars (a four-bar progression twice). */
  chords: Chord[];
  /** Lead lines written against these chords, each as long as `chords` (16 steps a chord). */
  leads: string[];
}

export interface Section {
  layers: Tonal[];
  /** Key into `TrackDef.drums`; absent means no drums. */
  drums?: string;
  bass?: string;
  arp?: string;
  stab?: string;
  /** Plays the Titan's leitmotif instead of the progression's lead. */
  motif?: boolean;
  /** A riser over the phrase's last two bars. */
  riser?: boolean;
  /** Always fills the phrase's last bar. */
  fill?: boolean;
}

export type SectionName = 'intro' | 'groove' | 'build' | 'drop' | 'break' | 'boss' | 'boss2' | 'menu';

export interface TrackDef {
  id: string;
  /** What the pause screen says is playing. */
  name: string;
  bpm: number;
  /** Tonic pitch class, 0 = C. */
  key: number;
  scale: ScaleName;
  progressions: Progression[];
  /** Titan mode: its own chords (usually a darker mode) under the leitmotif. */
  boss: Progression[];
  drums: Record<string, DrumSet>;
  /** Snare lines for a phrase's last bar. */
  fills: string[];
  bass: Record<string, string>;
  arps: Record<string, string>;
  stabs?: Record<string, string>;
  sections: Partial<Record<SectionName, Section>>;
  /** Which sections a phrase cycles through at each intensity level, 0-4. */
  arrangement: SectionName[][];
  bossArrangement: SectionName[];
  /** Octave per tonal layer (4 holds A440). */
  octave: Record<Tonal, number>;
  instruments: Record<Tonal, Cue>;
  kit: Record<Drum, Cue>;
  /** Layer levels, dB. */
  mix: Record<Layer, number>;
  /** Reverb send per layer, linear. */
  wet: Partial<Record<Layer, number>>;
  /** Echo send per layer, linear, and its time in beats. */
  echo: Partial<Record<Layer, number>>;
  echoBeats: number;
  /** Sidechain depth on the tonal layers per kick, 0-1. */
  pump: number;
  /** Delay of every odd sixteenth, as a share of a sixteenth. */
  swing?: number;
}

/** One scheduled sound, in steps from the bar's start. */
export interface NoteEvent {
  step: number;
  layer: Layer;
  /** MIDI notes: one for a line, several for a pad or stab chord; none for a drum. */
  notes: number[];
  /** Held length in steps. */
  hold: number;
  vel: number;
}
