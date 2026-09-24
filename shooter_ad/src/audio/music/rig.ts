/**
 * The music's signal chain and the one function that turns a bar's events
 * into voices - shared by the live engine and the offline renderer, so what
 * `npm run music` renders is what plays.
 *
 *   layer buses (mix dB) -> drums -----------------> duck -> pause LP -> out -> master
 *                        -> tonal -> sidechain pump -^
 *   layer buses -> reverb send / echo send (per-layer amounts)
 *
 * The pump is the kick ducking the tonal layers (sidechain, the house
 * breath); `duck` is the effects ducking the music under a pick or a Titan;
 * the pause lowpass is the music heard from behind the pause screen.
 */
import { buildVoice, dbToGain } from '../synth';
import { midiHz } from '../harmony';
import type { Space } from '../space';
import type { Drum, Layer, NoteEvent, Tonal, TrackDef } from './types';

const LAYERS: Layer[] = ['kick', 'snare', 'hat', 'open', 'perc', 'crash', 'riser', 'bass', 'pad', 'arp', 'lead', 'stab'];
const DRUMS = new Set<Layer>(['kick', 'snare', 'hat', 'open', 'perc', 'crash', 'riser']);

export interface Rig {
  layers: Record<Layer, GainNode>;
  wet: Record<Layer, GainNode>;
  echo: Record<Layer, GainNode>;
  pump: GainNode;
  duck: GainNode;
  lp: BiquadFilterNode;
  out: GainNode;
  space: Space;
  nodes: number;
}

export function buildRig(ctx: BaseAudioContext, dest: AudioNode, space: Space): Rig {
  const out = ctx.createGain();
  out.connect(dest);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 20000;
  lp.Q.value = 0.5;
  lp.connect(out);
  const duck = ctx.createGain();
  duck.connect(lp);
  const drums = ctx.createGain();
  drums.connect(duck);
  const pump = ctx.createGain();
  pump.connect(duck);
  const layers = {} as Record<Layer, GainNode>;
  const wet = {} as Record<Layer, GainNode>;
  const echo = {} as Record<Layer, GainNode>;
  for (const l of LAYERS) {
    const g = ctx.createGain();
    g.connect(DRUMS.has(l) ? drums : pump);
    const w = ctx.createGain();
    w.gain.value = 0;
    g.connect(w);
    w.connect(space.reverb);
    const e = ctx.createGain();
    e.gain.value = 0;
    g.connect(e);
    e.connect(space.echo);
    layers[l] = g; wet[l] = w; echo[l] = e;
  }
  return { layers, wet, echo, pump, duck, lp, out, space, nodes: 6 + LAYERS.length * 3 };
}

/**
 * A trim on every track's mix, from the first `npm run music` reading: the
 * kick and bass carried 55-83% of the energy under 150 Hz - which a phone
 * speaker drops - and the top octave under 3%. The kick and bass come down,
 * the hats and the melodic layers up.
 */
const BALANCE: Record<Layer, number> = {
  kick: -6, snare: -2, hat: 6, open: 5, perc: 0, crash: 0, riser: 0, bass: -7, pad: 1, arp: 3, lead: 2, stab: 1,
};

/** Sets a track's mix, sends and echo time from context time `at`. */
export function applyTrack(rig: Rig, track: TrackDef, at: number): void {
  for (const l of LAYERS) {
    rig.layers[l].gain.setValueAtTime(dbToGain(track.mix[l] + BALANCE[l]), at);
    rig.wet[l].gain.setValueAtTime(track.wet[l] ?? 0, at);
    rig.echo[l].gain.setValueAtTime(track.echo[l] ?? 0, at);
  }
  rig.space.setEchoTime((60 / track.bpm) * track.echoBeats, at);
}

export const stepSeconds = (track: TrackDef): number => 60 / track.bpm / 4;

/**
 * Schedules every event of one bar starting at context time `t0`. Returns
 * the node count, for the stats line. Drums play their kit recipe; tonal
 * layers play their instrument at `pitch = note / 440`, held for the note's
 * length (a hair short, so repeated notes articulate).
 */
export function scheduleBar(ctx: BaseAudioContext, rig: Rig, track: TrackDef, events: NoteEvent[], t0: number): number {
  const sd = stepSeconds(track);
  const swing = (track.swing ?? 0) * sd;
  let nodes = 0;
  for (const ev of events) {
    const t = t0 + ev.step * sd + (ev.step % 2 === 1 ? swing : 0);
    const gainDb = 20 * Math.log10(Math.max(0.05, ev.vel));
    if (DRUMS.has(ev.layer)) {
      const hold = ev.layer === 'riser' ? ev.hold * sd * 1000 : undefined;
      nodes += buildVoice(ctx, rig.layers[ev.layer], track.kit[ev.layer as Drum], t, { gainDb, hold }).nodes;
      if (ev.layer === 'kick' && track.pump > 0) {
        rig.pump.gain.setValueAtTime(1 - track.pump * ev.vel, t);
        rig.pump.gain.setTargetAtTime(1, t + 0.012, sd * 0.9);
      }
      continue;
    }
    const inst = track.instruments[ev.layer as Tonal];
    const hold = Math.max(40, ev.hold * sd * 1000 * 0.92);
    const chordDb = ev.notes.length > 1 ? -10 * Math.log10(ev.notes.length) : 0;
    for (const n of ev.notes) {
      nodes += buildVoice(ctx, rig.layers[ev.layer], inst, t, { pitch: midiHz(n) / 440, hold, gainDb: gainDb + chordDb }).nodes;
    }
  }
  return nodes;
}
