/**
 * Turns a `Cue` recipe into WebAudio nodes on any BaseAudioContext - the live
 * one in `Audio.ts` or an OfflineAudioContext in `npm run audio` - so what the
 * instrument renders is what the player hears.
 *
 * Pure with respect to the game: no clock, no randomness of its own. The noise
 * buffer comes from a fixed-seed xorshift so two renders of the same cue are
 * the same samples, and nothing here imports `systems/`.
 */
import type { Cue, Part } from './cues';

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
}

export const dbToGain = (db: number): number => Math.pow(10, db / 20);

const NOISE_SECONDS = 1;
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

/** One second of white noise from a fixed-seed xorshift32, cached per context. */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
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

/**
 * Attack to 1, decay to sustain, hold to `dur`, release to 0. Attack and decay
 * are clamped inside `dur` so the automation never runs out of order.
 */
function envelope(gain: AudioParam, t0: number, part: Part): number {
  const [a, d, s, r] = part.env ?? [2, 0, 1, 20];
  const dur = part.dur / 1000;
  const attack = Math.min(a / 1000, dur);
  const decay = Math.min(d / 1000, dur - attack);
  gain.setValueAtTime(0, t0);
  gain.linearRampToValueAtTime(1, t0 + attack);
  if (decay > 0) gain.linearRampToValueAtTime(s, t0 + attack + decay);
  else if (attack < dur) gain.setValueAtTime(s, t0 + attack);
  gain.setValueAtTime(decay > 0 || attack < dur ? s : 1, t0 + dur);
  gain.linearRampToValueAtTime(0, t0 + dur + r / 1000);
  return t0 + dur + r / 1000;
}

function makeSource(ctx: BaseAudioContext, part: Part, pitch: number, freqScale: number): AudioScheduledSourceNode {
  if (part.src === 'noise') {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    return src;
  }
  const osc = ctx.createOscillator();
  osc.type = part.src;
  const f0 = (part.freq ?? 440) * pitch * freqScale;
  osc.frequency.value = f0;
  return osc;
}

function scheduleSweep(param: AudioParam, from: number, to: number | undefined, t0: number, ms: number): void {
  param.setValueAtTime(Math.max(1, from), t0);
  if (to !== undefined) param.exponentialRampToValueAtTime(Math.max(1, to), t0 + ms / 1000);
}

/**
 * Builds one cue at context time `when`, feeding `dest`. Every part gets its
 * own gain (the envelope) and optional filter; the voice gain carries the cue
 * level plus `gainDb`. Returns a handle that can stop the voice early.
 */
export function buildVoice(
  ctx: BaseAudioContext, dest: AudioNode, cue: Cue, when: number, opts: VoiceOpts = {},
): Voice {
  const pitch = opts.pitch ?? 1;
  const voiceGain = ctx.createGain();
  voiceGain.gain.value = dbToGain(cue.db + (opts.gainDb ?? 0));
  voiceGain.connect(dest);
  let nodes = 1;
  let ends = when;
  const sources: AudioScheduledSourceNode[] = [];
  const gains: GainNode[] = [];

  const layers: { part: Part; freqScale: number; dbOffset: number }[] = [];
  for (const part of cue.parts) {
    layers.push({ part, freqScale: 1, dbOffset: 0 });
    if (opts.subDb !== undefined && part.src !== 'noise') layers.push({ part, freqScale: 0.5, dbOffset: opts.subDb });
  }

  for (const { part, freqScale, dbOffset } of layers) {
    const t0 = when + (part.at ?? 0) / 1000;
    const src = makeSource(ctx, part, pitch, freqScale);
    const gain = ctx.createGain();
    nodes += 2;
    let head: AudioNode = src;
    if (part.src !== 'noise' && part.to !== undefined) {
      const osc = src as OscillatorNode;
      scheduleSweep(osc.frequency, (part.freq ?? 440) * pitch * freqScale, part.to * pitch * freqScale, t0, part.sweepMs ?? part.dur);
    }
    if (part.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = part.filter.type;
      filter.Q.value = part.filter.q ?? 0.7;
      scheduleSweep(filter.frequency, part.filter.freq, part.filter.to, t0, part.sweepMs ?? part.dur);
      head.connect(filter);
      head = filter;
      nodes++;
    }
    const partEnd = envelope(gain.gain, t0, part);
    ends = Math.max(ends, partEnd);
    const level = ctx.createGain();
    level.gain.value = dbToGain(part.db + dbOffset);
    nodes++;
    head.connect(gain);
    gain.connect(level);
    level.connect(voiceGain);
    src.start(t0);
    src.stop(partEnd + 0.01);
    sources.push(src);
    gains.push(gain);
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
 * The output chain every voice ends in: master trim, a compressor that keeps a
 * stack of kills from adding up past full scale, and a highpass that takes the
 * sub-30 Hz rumble a phone speaker would only distort. Returns the node voices
 * (via their buses) connect to.
 */
export function buildMaster(ctx: BaseAudioContext, dest: AudioNode = ctx.destination): { input: GainNode; nodes: number } {
  const master = ctx.createGain();
  master.gain.value = dbToGain(-6);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 6;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 30;
  master.connect(comp);
  comp.connect(hp);
  hp.connect(dest);
  return { input: master, nodes: 3 };
}
