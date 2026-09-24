/**
 * The one AudioContext: created inside the first gesture, never before; a
 * voice budget with priorities so a full mix drops the least important sound
 * rather than the newest; effects and music muted separately, both persisted
 * in localStorage; and an offline `render` so the instrument hears exactly
 * the live chain.
 *
 *   effect voices -> category buses -> (kill, hit: duck) -> master
 *                 -> room (reverb send, `space.ts`) ----------^
 *   music (`music/Music.ts`) -> its own rig -----------------^
 *   master -> glue compressor -> limiter -> highpass -> speakers
 *
 * Every WebAudio call is wrapped: a browser with no audio, a context that
 * never leaves `suspended` headless, or storage that throws in a private
 * window must cost the game nothing but a counter in `stats.failures`. This
 * module never logs.
 */
import { CUES, cueDuration, type Category, type CueName } from './cues';
import { Music, type MusicStats } from './music/Music';
import { buildSpace, type Space } from './space';
import { buildMaster, buildVoice, dbToGain, type Voice, type VoiceOpts } from './synth';

export type AudioState = 'none' | 'disabled' | 'suspended' | 'running' | 'closed' | 'stuck';

export interface Stats {
  cues: number;
  voices: number;
  peakVoices: number;
  nodesCreated: number;
  refused: number;
  bundled: number;
  failures: number;
  state: AudioState;
  music: MusicStats & { on: boolean };
}

interface Live { name: CueName; priority: number; endsAt: number; voice: Voice }

export const MAX_VOICES = 12;
const STORAGE_KEY = 'shooter_ad.audio.muted';
const MUSIC_KEY = 'shooter_ad.audio.music';
/** A voice is released this long after its last release has ended, by wall clock. */
const RELEASE_GRACE_MS = 200;
/** Suspended this long after the gesture means the browser will not give us audio. */
const STUCK_MS = 2000;
const BUS_DB: Record<Category, number> = { kill: 0, hit: 0, event: 0, titan: 0, ui: -3 };
/** How far each kind of effect pulls the music down, dB, and for how long. */
const MUSIC_DUCK: Partial<Record<Category, [number, number]>> = { event: [-3, 260], titan: [-6, 500] };

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* storage is a convenience */ }
}

export function readStoredMute(): boolean | null {
  const v = read(STORAGE_KEY);
  return v === null ? null : v === '1';
}

/**
 * Music is on unless it was switched off. A player who muted SOUND before
 * music existed gets it off too, rather than a surprise.
 */
export function readStoredMusic(): boolean {
  const v = read(MUSIC_KEY);
  if (v !== null) return v === '1';
  return readStoredMute() !== true;
}

export class Audio {
  private ctx: AudioContext | null = null;
  private buses: Record<Category, GainNode> | null = null;
  private duck: GainNode | null = null;
  private space: Space | null = null;
  private live: Live[] = [];
  private unlockedAt = -1;
  private mutedFlag: boolean;
  private counters = { cues: 0, peakVoices: 0, nodesCreated: 0, refused: 0, failures: 0 };
  /** Set by the bundler's owner so the stats line can report it. */
  bundled = 0;
  readonly music: Music;

  constructor(private readonly disabled: boolean, muted: boolean, musicOn: boolean) {
    this.mutedFlag = muted;
    this.music = new Music(musicOn);
  }

  /** Effects muted. Music has its own switch. */
  get muted(): boolean { return this.mutedFlag; }

  setMuted(on: boolean): void {
    this.mutedFlag = on;
    if (on) this.stopAll();
    write(STORAGE_KEY, on ? '1' : '0');
  }

  get musicOn(): boolean { return this.music.on; }

  setMusic(on: boolean): void {
    this.guard(() => this.music.setEnabled(on));
    write(MUSIC_KEY, on ? '1' : '0');
  }

  get state(): AudioState {
    if (this.disabled) return 'disabled';
    if (!this.ctx) return 'none';
    const s = this.ctx.state as AudioState;
    if (s === 'suspended' && this.unlockedAt >= 0 && performance.now() - this.unlockedAt > STUCK_MS) return 'stuck';
    return s;
  }

  /** Called from inside a user gesture. Creates the context once and asks it to run. */
  unlock(): void {
    if (this.disabled) return;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext({ latencyHint: 'interactive' });
        this.buildGraph(this.ctx);
      } catch {
        this.counters.failures++;
        this.ctx = null;
        return;
      }
    }
    if (this.unlockedAt < 0) this.unlockedAt = performance.now();
    this.resume();
  }

  resume(): void {
    if (!this.ctx || this.ctx.state !== 'suspended') return;
    try { this.ctx.resume().catch(() => { this.counters.failures++; }); } catch { this.counters.failures++; }
  }

  suspend(): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    try { this.ctx.suspend().catch(() => { this.counters.failures++; }); } catch { this.counters.failures++; }
  }

  /** Runs `fn`, counting (never throwing) a WebAudio failure. */
  guard(fn: () => void): void {
    try { fn(); } catch { this.counters.failures++; }
  }

  private buildGraph(ctx: AudioContext): void {
    const master = buildMaster(ctx);
    this.space = buildSpace(ctx, master.input);
    this.counters.nodesCreated += master.nodes + this.space.nodes;
    const duck = ctx.createGain();
    duck.connect(master.input);
    this.duck = duck;
    const buses = {} as Record<Category, GainNode>;
    for (const cat of Object.keys(BUS_DB) as Category[]) {
      const bus = ctx.createGain();
      bus.gain.value = dbToGain(BUS_DB[cat]);
      bus.connect(cat === 'kill' || cat === 'hit' ? duck : master.input);
      buses[cat] = bus;
      this.counters.nodesCreated++;
    }
    this.counters.nodesCreated++;
    this.buses = buses;
    this.music.attach(ctx, master.input, this.space);
  }

  /** Voices whose wall-clock lifetime has run out are released. */
  purge(): void {
    const now = performance.now();
    this.live = this.live.filter((v) => v.endsAt > now);
  }

  /** Plays a cue now. False when it was muted, refused for budget, or the context cannot sound. */
  play(name: CueName, opts: VoiceOpts = {}): boolean {
    const cue = CUES[name];
    if (cue.enabled === false || this.mutedFlag || !this.ctx || !this.buses) return false;
    const state = this.state;
    if (state === 'closed' || state === 'stuck') return false;
    this.purge();
    if (!this.makeRoom(name, cue.priority, cue.cap)) { this.counters.refused++; return false; }
    try {
      this.music.syncHarmony();
      const when = this.ctx.currentTime + 0.005;
      const voice = buildVoice(this.ctx, { dry: this.buses[cue.category], wet: this.space?.reverb }, cue, when, opts);
      this.counters.nodesCreated += voice.nodes;
      this.counters.cues++;
      const endsAt = performance.now() + (voice.ends - when) * 1000 + RELEASE_GRACE_MS;
      this.live.push({ name, priority: cue.priority, endsAt, voice });
      this.counters.peakVoices = Math.max(this.counters.peakVoices, this.live.length);
      if (cue.duck) this.duckNow();
      const md = cue.duck ? [-5, 300] as [number, number] : MUSIC_DUCK[cue.category];
      if (md) this.music.duck(md[0], md[1]);
      return true;
    } catch {
      this.counters.failures++;
      return false;
    }
  }

  /** Evicts within the cue's own cap first, then the lowest priority below ours. */
  private makeRoom(name: CueName, priority: number, cap: number): boolean {
    const same = this.live.filter((v) => v.name === name);
    if (same.length >= cap) this.evict(same[0]);
    if (this.live.length < MAX_VOICES) return true;
    let lowest: Live | null = null;
    for (const v of this.live) if (v.priority < priority && (!lowest || v.priority < lowest.priority)) lowest = v;
    if (!lowest) return false;
    this.evict(lowest);
    return true;
  }

  private evict(v: Live): void {
    v.voice.stop();
    this.live = this.live.filter((x) => x !== v);
  }

  /** Stops every voice, optionally sparing one cue (the death sound outlives `gameover`). */
  stopAll(keep?: CueName): void {
    for (const v of this.live) if (v.name !== keep) v.voice.stop();
    this.live = this.live.filter((v) => v.name === keep);
  }

  private duckNow(): void {
    if (!this.ctx || !this.duck) return;
    try {
      const t = this.ctx.currentTime;
      this.duck.gain.cancelScheduledValues(t);
      this.duck.gain.setTargetAtTime(dbToGain(-6), t, 0.02);
      this.duck.gain.setTargetAtTime(1, t + 0.3, 0.1);
    } catch { this.counters.failures++; }
  }

  /** The kill bus eases from 0 dB at <= 5 kills/s to -6 dB at >= 30/s. */
  setKillRate(perSecond: number): void {
    if (!this.ctx || !this.buses) return;
    const db = -6 * Math.min(1, Math.max(0, (perSecond - 5) / 25));
    try { this.buses.kill.gain.setTargetAtTime(dbToGain(db), this.ctx.currentTime, 0.1); } catch { this.counters.failures++; }
  }

  /** Renders one cue through a clone of the live chain, room included; stereo, 48 kHz, interleaved as [L, R]. */
  async render(name: CueName, seconds?: number, opts: VoiceOpts = {}): Promise<[Float32Array, Float32Array]> {
    const cue = CUES[name];
    const rate = 48000;
    const length = Math.ceil(rate * (seconds ?? cueDuration(cue) / 1000 + 1.2));
    const ctx = new OfflineAudioContext(2, length, rate);
    const master = buildMaster(ctx);
    const space = buildSpace(ctx, master.input);
    const bus = ctx.createGain();
    bus.gain.value = dbToGain(BUS_DB[cue.category]);
    bus.connect(master.input);
    buildVoice(ctx, { dry: bus, wet: space.reverb }, cue, 0.01, opts);
    const buffer = await ctx.startRendering();
    return [buffer.getChannelData(0), buffer.getChannelData(1)];
  }

  get stats(): Stats {
    this.purge();
    return {
      ...this.counters, voices: this.live.length, bundled: this.bundled, state: this.state,
      music: { ...this.music.stats, on: this.music.on },
    };
  }

  /** Live voices of one cue, for the instrument's cap assertions. */
  voicesOf(name: CueName): number {
    this.purge();
    return this.live.filter((v) => v.name === name).length;
  }
}
