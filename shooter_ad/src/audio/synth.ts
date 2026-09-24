/**
 * Turns a `Cue` recipe into WebAudio nodes on any BaseAudioContext - the live
 * one in `Audio.ts` or an OfflineAudioContext in `npm run audio` - so what the
 * instrument renders is what the player hears. The music engine plays its
 * notes through the same builder, so a bass note and a kill are one kind of
 * thing.
 *
 * A part is one source - an oscillator (optionally FM-modulated, optionally a
 * detuned unison stack) or fixed-seed noise - through an optional filter and
 * an optional soft clip, under its own envelope. Pitched parts either name a
 * frequency or a `tone` resolved against the live harmony (`harmony.ts`), so
 * the table stays static and the notes follow the music.
 *
 * Pure with respect to the game: no clock, no randomness of its own.
 */
import type { Cue, Part } from './cues';
import { above, HARMONY, midiHz, step, tone, type Harmony } from './harmony';

export interface Voice {
  /** Nodes created, for the stats line. */
  nodes: number;
  /** Context time at which the last release has finished, seconds. */
  ends: number;
  /** Fades the voice out over ~20 ms and stops its sources. */
  stop(): void;
}

export interface VoiceOpts {
  /** Frequency multiplier on every oscillator part. */
  pitch?: number;
  /** Added to the cue's level. */
  gainDb?: number;
  /** When set, every oscillator part gets a copy an octave down at this level relative to the part. */
  subDb?: number;
  /** Stereo position, -1 to 1, added to each part's own. */
  pan?: number;
  /** Replaces every part's `dur`, ms: how long a music note is held. */
  hold?: number;
  /** The harmony `tone` parts resolve against; the live one by default. */
  harmony?: Harmony;
  /** Chord-tone offset added to every `tone.chord` (a streak climbs the chord). */
  climb?: number;
  /** Multiplies the cue's reverb send. */
  sendScale?: number;
}

/** Where a voice goes: the dry bus, and the reverb input if the cue sends to it. */
export interface Outs { dry: AudioNode; wet?: AudioNode }

export const dbToGain = (db: number): number => Math.pow(10, db / 20);

const NOISE_SECONDS = 1;
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
const driveCurves = new WeakMap<BaseAudioContext, Map<number, Float32Array>>();

/** One second of white noise from a fixed-seed xorshift32, cached per context. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseBuffers.get(ctx);
  if (cached) return cached;
  const length = Math.ceil(ctx.sampleRate * NOISE_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let s = 0x9e3779b9;
  for (let i = 0; i < length; i++) {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    data[i] = (s / 0xffffffff) * 2 - 1;
  }
  noiseBuffers.set(ctx, buffer);
  return buffer;
}

/** A tanh soft clip, `amount` 0-1, normalised so a full-scale input stays near full scale. */
function driveCurve(ctx: BaseAudioContext, amount: number): Float32Array {
  let map = driveCurves.get(ctx);
  if (!map) { map = new Map(); driveCurves.set(ctx, map); }
  const key = Math.round(amount * 100);
  const hit = map.get(key);
  if (hit) return hit;
  const k = 1 + key / 8;
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  map.set(key, curve);
  return curve;
}

/**
 * Attack to 1, decay to sustain, hold to `dur`, release to 0. Attack and decay
 * are clamped inside `dur` so the automation never runs out of order.
 */
function envelope(gain: AudioParam, t0: number, part: Part, durMs: number, peak: number): number {
  const [a, d, s, r] = part.env ?? [2, 0, 1, 20];
  const dur = durMs / 1000;
  const attack = Math.min(a / 1000, dur);
  const decay = Math.min(d / 1000, dur - attack);
  // Decays are exponential (a pluck, a bell); the ramp cannot reach zero, so
  // a zero sustain is -80 dB under the peak, which is silence. The part's
  // level IS the envelope's peak: one gain node a part, not two.
  const sus = peak * Math.max(s, 0.0001);
  gain.setValueAtTime(0, t0);
  gain.linearRampToValueAtTime(peak, t0 + Math.max(attack, 0.0005));
  if (decay > 0) gain.exponentialRampToValueAtTime(sus, t0 + attack + decay);
  else if (attack < dur) gain.setValueAtTime(peak * s, t0 + attack);
  gain.setValueAtTime(decay > 0 ? sus : attack < dur ? peak * s : peak, t0 + dur);
  gain.linearRampToValueAtTime(0, t0 + dur + r / 1000);
  return t0 + dur + r / 1000;
}

/** The part's base frequency: its `tone` against the harmony, or its `freq`. */
function baseFreq(part: Part, opts: VoiceOpts): number {
  if (!part.tone) return part.freq ?? 440;
  const h = opts.harmony ?? HARMONY;
  const t = part.tone;
  let midi: number;
  if (t.key !== undefined) midi = 12 * (t.oct + 1) + h.key + t.key;
  else if (t.step !== undefined) midi = step(h, t.step, t.oct);
  else if (t.deg !== undefined) midi = above(h, t.deg, t.oct);
  else midi = tone(h, (t.chord ?? 0) + (opts.climb ?? 0), t.oct);
  return midiHz(midi + (t.semis ?? 0));
}

function scheduleSweep(param: AudioParam, from: number, to: number | undefined, t0: number, ms: number): void {
  param.setValueAtTime(Math.max(1, from), t0);
  if (to !== undefined) param.exponentialRampToValueAtTime(Math.max(1, to), t0 + Math.max(ms, 1) / 1000);
}

interface Built { head: AudioNode; sources: AudioScheduledSourceNode[]; nodes: number }

/** The part's source(s): noise, or one oscillator per unison voice, FM-modulated if asked. */
function makeSources(ctx: BaseAudioContext, part: Part, f0: number, t0: number, durMs: number): Built {
  if (part.src === 'noise') {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    return { head: src, sources: [src], nodes: 1 };
  }
  const count = part.unison?.voices ?? 1;
  const cents = part.unison?.cents ?? 0;
  const sweepTo = part.bend !== undefined ? f0 * Math.pow(2, part.bend / 12) : part.to !== undefined ? f0 * (part.to / (part.freq ?? part.to)) : undefined;
  const sources: AudioScheduledSourceNode[] = [];
  let nodes = 0;
  const mix = count > 1 ? ctx.createGain() : null;
  if (mix) { mix.gain.value = 1 / Math.sqrt(count); nodes++; }
  let head: AudioNode | null = null;
  let vib: GainNode | null = null;
  if (part.vib) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = part.vib.rate;
    vib = ctx.createGain();
    const d = (part.vib.delayMs ?? 0) / 1000;
    vib.gain.setValueAtTime(0, t0);
    vib.gain.linearRampToValueAtTime(0, t0 + d);
    vib.gain.linearRampToValueAtTime(part.vib.cents, t0 + d + 0.25);
    lfo.connect(vib);
    sources.push(lfo);
    nodes += 2;
  }
  for (let v = 0; v < count; v++) {
    const osc = ctx.createOscillator();
    osc.type = part.src;
    const spread = count > 1 ? (v / (count - 1)) * 2 - 1 : 0;
    osc.detune.value = spread * cents;
    scheduleSweep(osc.frequency, f0, sweepTo, t0, part.sweepMs ?? durMs);
    if (vib) vib.connect(osc.detune);
    nodes++;
    if (part.fm) {
      const mod = ctx.createOscillator();
      const depth = ctx.createGain();
      mod.frequency.value = f0 * part.fm.ratio;
      const peak = f0 * part.fm.index;
      depth.gain.setValueAtTime(peak, t0);
      depth.gain.setTargetAtTime(peak * (part.fm.floor ?? 0.08), t0, (part.fm.decayMs ?? durMs) / 3000);
      mod.connect(depth);
      depth.connect(osc.frequency);
      sources.push(mod);
      nodes += 2;
    }
    sources.push(osc);
    if (mix) osc.connect(mix); else head = osc;
  }
  return { head: mix ?? head!, sources, nodes };
}

/**
 * Builds one cue at context time `when`. Every part gets its own envelope and
 * optional filter and drive; the voice gain carries the cue level plus
 * `gainDb`, then a stereo position, then the dry bus and the reverb send.
 */
export function buildVoice(
  ctx: BaseAudioContext, outs: Outs | AudioNode, cue: Cue, when: number, opts: VoiceOpts = {},
): Voice {
  const out: Outs = outs instanceof AudioNode ? { dry: outs } : outs;
  const pitch = opts.pitch ?? 1;
  const voiceGain = ctx.createGain();
  voiceGain.gain.value = dbToGain(cue.db + (opts.gainDb ?? 0));
  let nodes = 1;
  const pan = Math.max(-1, Math.min(1, opts.pan ?? 0));
  let tail: AudioNode = voiceGain;
  if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    voiceGain.connect(p);
    tail = p;
    nodes++;
  }
  tail.connect(out.dry);
  const send = (cue.send ?? 0) * (opts.sendScale ?? 1);
  let sendGain: GainNode | null = null;
  if (send > 0 && out.wet) {
    sendGain = ctx.createGain();
    sendGain.gain.value = send;
    tail.connect(sendGain);
    sendGain.connect(out.wet);
    nodes++;
  }
  let ends = when;
  const sources: AudioScheduledSourceNode[] = [];
  let last: AudioScheduledSourceNode | null = null;
  let lastEnd = -1;

  const layers: { part: Part; freqScale: number; dbOffset: number }[] = [];
  for (const part of cue.parts) {
    layers.push({ part, freqScale: 1, dbOffset: 0 });
    if (opts.subDb !== undefined && part.src !== 'noise') layers.push({ part, freqScale: 0.5, dbOffset: opts.subDb });
  }

  for (const { part, freqScale, dbOffset } of layers) {
    const t0 = when + (part.at ?? 0) / 1000;
    const durMs = part.sustain === false ? part.dur : (opts.hold ?? part.dur);
    const f0 = baseFreq(part, opts) * pitch * freqScale;
    const built = makeSources(ctx, part, f0, t0, durMs);
    nodes += built.nodes;
    let head = built.head;
    if (part.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = part.filter.type;
      filter.Q.value = part.filter.q ?? 0.7;
      const track = part.filter.track ? f0 / 440 : 1;
      scheduleSweep(filter.frequency, part.filter.freq * track, part.filter.to !== undefined ? part.filter.to * track : undefined, t0, part.filter.ms ?? part.sweepMs ?? durMs);
      head.connect(filter);
      head = filter;
      nodes++;
    }
    if (part.drive) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = driveCurve(ctx, part.drive) as Float32Array<ArrayBuffer>;
      head.connect(shaper);
      head = shaper;
      nodes++;
    }
    const gain = ctx.createGain();
    const partEnd = envelope(gain.gain, t0, part, durMs, dbToGain(part.db + dbOffset));
    ends = Math.max(ends, partEnd);
    let level: AudioNode = gain;
    nodes++;
    if (part.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = part.pan;
      gain.connect(p);
      level = p;
      nodes++;
    }
    head.connect(gain);
    level.connect(voiceGain);
    for (const src of built.sources) {
      src.start(t0);
      src.stop(partEnd + 0.02);
      sources.push(src);
      if (partEnd >= lastEnd) { lastEnd = partEnd; last = src; }
    }
  }
  // A finished voice leaves the graph at once. Nodes that sit connected after
  // their sources end are still pulled every render quantum until they are
  // collected, and measured, a graph's idle nodes cost more than its sounding
  // ones (2,000 idle gains ran 0.37x real time offline).
  if (last) {
    last.onended = () => {
      try { voiceGain.disconnect(); if (tail !== voiceGain) tail.disconnect(); sendGain?.disconnect(); } catch { /* gone */ }
    };
  }

  const stop = (): void => {
    const now = ctx.currentTime;
    try {
      voiceGain.gain.cancelScheduledValues(now);
      voiceGain.gain.setTargetAtTime(0, now, 0.006);
      for (const s of sources) s.stop(now + 0.05);
    } catch {
      /* already stopped, or the context is gone: nothing to release */
    }
  };
  return { nodes, ends, stop };
}

/**
 * The output chain everything ends in: master trim, a gentle glue
 * compressor, a fast brick-ish limiter so a Titan landing on a stack of kills
 * never clips a phone's DAC, and a highpass that takes the sub-30 Hz rumble
 * a phone speaker would only distort. Returns the node the buses feed.
 */
export function buildMaster(ctx: BaseAudioContext, dest: AudioNode = ctx.destination): { input: GainNode; nodes: number } {
  const master = ctx.createGain();
  master.gain.value = dbToGain(-4);
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -18;
  glue.knee.value = 10;
  glue.ratio.value = 3;
  glue.attack.value = 0.01;
  glue.release.value = 0.2;
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -4;
  limit.knee.value = 0;
  limit.ratio.value = 20;
  limit.attack.value = 0.001;
  limit.release.value = 0.1;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 30;
  master.connect(glue);
  glue.connect(limit);
  limit.connect(hp);
  hp.connect(dest);
  return { input: master, nodes: 4 };
}
