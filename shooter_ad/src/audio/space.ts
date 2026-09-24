/**
 * The room everything plays in. Two shared sends, built once per context:
 *
 * - **Reverb**: one ConvolverNode over a generated impulse - decorrelated
 *   stereo noise under an exponential decay, a few early reflections, and a
 *   tail that darkens as it dies (a one-pole lowpass whose cutoff falls with
 *   time), the way a real hall loses its highs first. The impulse is a
 *   fixed-seed xorshift, so every context gets the same room. One convolver
 *   for the whole game is the cost: padenot's WebAudio perf notes rate it
 *   the expensive node, so there is exactly one, on a send, never per voice.
 * - **Echo**: a stereo ping-pong delay for the music's lead and arp, its
 *   time set to the track's tempo, a lowpass inside the loop so repeats
 *   soften.
 *
 * The sends make the palette sound like it happens somewhere - the "tail"
 * of transient / body / tail - without baking a tail into every recipe.
 */
import { dbToGain } from './synth';

const IR_SECONDS = 1.9;
const T60 = 1.7;
const PREDELAY = 0.012;

/** The impulse: stereo, deterministic, darkening, `IR_SECONDS` long. */
export function impulse(ctx: BaseAudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const n = Math.ceil(rate * IR_SECONDS);
  const buf = ctx.createBuffer(2, n, rate);
  const pre = Math.floor(PREDELAY * rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let s = ch === 0 ? 0x2545f491 : 0x9e3779b9;
    let lp = 0;
    for (let i = pre; i < n; i++) {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      const white = (s / 0xffffffff) * 2 - 1;
      const t = (i - pre) / rate;
      // Cutoff falls from ~9 kHz to ~1.5 kHz across the tail.
      const fc = 1500 + 7500 * Math.exp(-t / 0.35);
      const k = 1 - Math.exp(-2 * Math.PI * fc / rate);
      lp += k * (white - lp);
      d[i] = lp * Math.pow(10, (-60 * t) / (20 * T60));
    }
    // Early reflections: a handful of discrete taps in the first 45 ms, different per side.
    const taps = ch === 0 ? [0.007, 0.013, 0.021, 0.034, 0.043] : [0.009, 0.016, 0.025, 0.031, 0.045];
    taps.forEach((tt, j) => {
      const i = pre + Math.floor(tt * rate);
      if (i < n) d[i] += (j % 2 ? -1 : 1) * 0.5 * Math.pow(0.72, j);
    });
  }
  return buf;
}

export interface Space {
  /** Reverb input: voices send here. */
  reverb: GainNode;
  /** Echo input, and the knob that sets its time. */
  echo: GainNode;
  setEchoTime(seconds: number, at?: number): void;
  nodes: number;
}

/** Builds both sends into `dest` (the master input). */
export function buildSpace(ctx: BaseAudioContext, dest: AudioNode): Space {
  const reverb = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.normalize = true;
  conv.buffer = impulse(ctx);
  // Keep the mud out of the room: nothing under 220 Hz is sent into it.
  const pre = ctx.createBiquadFilter();
  pre.type = 'highpass';
  pre.frequency.value = 220;
  const ret = ctx.createGain();
  ret.gain.value = dbToGain(-3);
  reverb.connect(pre);
  pre.connect(conv);
  conv.connect(ret);
  ret.connect(dest);

  const echo = ctx.createGain();
  const dl = ctx.createDelay(2);
  const dr = ctx.createDelay(2);
  const fbl = ctx.createGain();
  const fbr = ctx.createGain();
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 3200;
  fbl.gain.value = 0.42;
  fbr.gain.value = 0.42;
  const merge = ctx.createChannelMerger(2);
  const echoRet = ctx.createGain();
  echoRet.gain.value = dbToGain(-6);
  echo.connect(tone);
  tone.connect(dl);
  dl.connect(fbl); fbl.connect(dr);
  dr.connect(fbr); fbr.connect(dl);
  dl.connect(merge, 0, 0);
  dr.connect(merge, 0, 1);
  merge.connect(echoRet);
  echoRet.connect(dest);
  // The echo's repeats get a little room too.
  echoRet.connect(reverb);

  const setEchoTime = (seconds: number, at = ctx.currentTime): void => {
    dl.delayTime.setValueAtTime(seconds, at);
    dr.delayTime.setValueAtTime(seconds, at);
  };
  setEchoTime(0.3, 0);
  return { reverb, echo, setEchoTime, nodes: 16 };
}
