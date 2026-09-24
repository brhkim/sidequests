/**
 * Wires audio to the game and exposes `window.__audio`, the instruments'
 * seam. `?mute=1` starts effects muted and `?music=0` the music; `?audio=1`
 * forces audio on; a `?seed=` page without `audio=1` is an instrument run
 * and never creates a context at all. The first pointer, touch or key
 * anywhere is the unlock.
 */
import type Phaser from 'phaser';
import { Audio, readStoredMusic, readStoredMute, type Stats } from './Audio';
import { AudioEvents, type CueExtras } from './AudioEvents';
import { CUES, CUE_NAMES, cueDuration, type CueName } from './cues';
import { renderMusic, trackIds, type Hit, type Segment } from './offline';
import type { VoiceOpts } from './synth';

export interface AudioSeam {
  play(name: CueName, extras?: CueExtras & { t?: number }): boolean;
  voice(name: CueName, opts?: VoiceOpts): boolean;
  tick(t?: number): void;
  render(name: CueName, seconds?: number, opts?: VoiceOpts): Promise<{ sampleRate: number; left: string; right: string }>;
  renderMusic(track: number, segments: Segment[], seed?: number, hits?: Hit[], music?: boolean):
    Promise<{ sampleRate: number; left: string; right: string; seconds: number; sections: string[]; nodes: number }>;
  tracks(): string[];
  cues(): { name: CueName; durationMs: number; db: number; category: string; priority: number; enabled: boolean }[];
  setMuted(on: boolean): void;
  setMusic(on: boolean): void;
  stopAll(): void;
  readonly muted: boolean;
  readonly stats: Stats;
  voicesOf(name: CueName): number;
}

function pcm16(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

export function installAudio(events: Phaser.Events.EventEmitter, search: string): AudioSeam {
  const params = new URLSearchParams(search);
  const disabled = params.has('seed') && params.get('audio') !== '1';
  const muted = params.get('mute') === '1' || (readStoredMute() ?? false);
  const musicOn = params.get('music') === '0' ? false : params.get('music') === '1' ? true : readStoredMusic();
  const audio = new Audio(disabled, muted, musicOn);
  const wired = new AudioEvents(audio, events);

  const unlock = (): void => {
    audio.unlock();
    wired.unlocked();
    for (const type of ['pointerdown', 'touchend', 'keydown']) window.removeEventListener(type, unlock, true);
  };
  for (const type of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(type, unlock, { capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) audio.suspend(); else audio.resume(); });

  const seam: AudioSeam = {
    play: (name, extras = {}) => wired.cue(name, extras.t ?? performance.now(), extras),
    voice: (name, opts) => audio.play(name, opts),
    tick: (t) => wired.tick(t ?? performance.now()),
    render: async (name, seconds, opts) => {
      const [l, r] = await audio.render(name, seconds, opts);
      return { sampleRate: 48000, left: pcm16(l), right: pcm16(r) };
    },
    renderMusic: async (track, segments, seed, hits, music) => {
      const out = await renderMusic(track, segments, seed, hits, music);
      return { sampleRate: 48000, left: pcm16(out.left), right: pcm16(out.right), seconds: out.seconds, sections: out.sections, nodes: out.notes };
    },
    tracks: () => trackIds(),
    cues: () => CUE_NAMES.map((name) => ({
      name, durationMs: cueDuration(CUES[name]), db: CUES[name].db, category: CUES[name].category,
      priority: CUES[name].priority, enabled: CUES[name].enabled !== false,
    })),
    setMuted: (on) => { audio.setMuted(on); events.emit('muted', on); },
    setMusic: (on) => { audio.setMusic(on); events.emit('music', on); },
    stopAll: () => audio.stopAll(),
    get muted() { return audio.muted; },
    get stats() { return audio.stats; },
    voicesOf: (name) => audio.voicesOf(name),
  };
  (window as unknown as { __audio: AudioSeam }).__audio = seam;
  return seam;
}
