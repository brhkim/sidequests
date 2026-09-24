/**
 * Offline renders for the instruments: a stretch of music through the live
 * chain (master, room, the music rig), optionally with effects laid over it
 * at given times - each effect resolved against the chord the music was
 * playing at that moment, exactly as live. `npm run music` reads loudness,
 * clipping and spectra off these, and writes them as .wav for a human.
 */
import { CUES, type CueName } from './cues';
import type { MusicMode } from './music/composer';
import { Music } from './music/Music';
import { TRACKS } from './music/tracks';
import type { SectionName } from './music/types';
import { buildSpace } from './space';
import { buildMaster, buildVoice, dbToGain, type VoiceOpts } from './synth';

export interface Segment { mode: MusicMode; level: number; bars: number; force?: SectionName; crash?: boolean }
export interface Hit { t: number; cue: CueName; opts?: VoiceOpts }
export interface Rendered { left: Float32Array; right: Float32Array; seconds: number; sections: string[]; notes: number }

export const trackIds = (): string[] => TRACKS.map((t) => t.id);

export async function renderMusic(trackIndex: number, segments: Segment[], seed = 1, hits: Hit[] = [], music = true): Promise<Rendered> {
  const track = TRACKS[trackIndex % TRACKS.length];
  const bar = (60 / track.bpm) * 4;
  const bars = segments.reduce((n, s) => n + s.bars, 0);
  const seconds = bars * bar + 2.5;
  // One bar short of the end the music stops being laid, so the tail rings out.
  const until = bars * bar + 0.05;
  const rate = 48000;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
  const master = buildMaster(ctx);
  const space = buildSpace(ctx, master.input);
  const m = new Music(true);
  m.attach(ctx, master.input, space);
  m.prime(trackIndex, seed);
  // Segments switch on their downbeats, as a live mode change would.
  const starts: number[] = [];
  segments.reduce((n, s) => { starts.push(n); return n + s.bars; }, 0);
  m.onBar = (b) => {
    const i = starts.indexOf(b);
    if (i < 0) return;
    const s = segments[i];
    m.setLevel(s.level);
    m.setMode(s.mode, { force: s.force, crash: s.crash });
  };
  if (!music) m.silence();
  const bus = ctx.createGain();
  bus.gain.value = dbToGain(0);
  bus.connect(master.input);
  const queue = [...hits].sort((a, b) => a.t - b.t);
  // Scheduled the way the live engine is: a short lookahead at a time, the
  // render suspended every 100 ms to lay the next stretch - never the whole
  // piece up front, which measured 2.6x slower than real time for the nodes
  // waiting in the graph alone.
  const HOP = 0.1;
  const lay = (t: number): void => {
    m.advance(Math.min(t + 0.2, until));
    while (queue.length && queue[0].t < t + 0.2) {
      const hit = queue.shift()!;
      m.syncHarmonyAt(hit.t);
      buildVoice(ctx, { dry: bus, wet: space.reverb }, CUES[hit.cue], hit.t, hit.opts ?? {});
    }
    const next = t + HOP;
    if (next < seconds - 0.2) ctx.suspend(next).then(() => { lay(next); return ctx.resume(); });
  };
  lay(0);
  const buffer = await ctx.startRendering();
  return {
    left: buffer.getChannelData(0), right: buffer.getChannelData(1), seconds,
    sections: m.bars.map((b) => b.section), notes: m.stats.nodes,
  };
}
