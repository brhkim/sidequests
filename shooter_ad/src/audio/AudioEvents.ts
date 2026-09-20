/**
 * The game's one sound listener. Subscribes to `game.events` - `moment` (the
 * simulation's account of each frame), `paused`, `restart`, `gameover`,
 * `startmatch`, `mutetoggle` - and answers `mutetoggle` with `muted`. It
 * touches no scene and no system: audio reads events and nothing reads audio,
 * which is what keeps it off the determinism surface.
 *
 * The clock the bundler runs on is wall time from `performance.now()`,
 * advanced once per frame. Audio is allowed that because nothing here can
 * reach the simulation; the instrument drives the same code with a synthetic
 * clock through `window.__audio`.
 */
import type Phaser from 'phaser';
import type { SimEvent } from '../systems/SimEvents';
import { Audio, readStoredMute, type Stats } from './Audio';
import { Bundler, encodeBundle, type Flush } from './collapse';
import { CUES, CUE_NAMES, cueDuration, type CueName } from './cues';
import type { VoiceOpts } from './synth';

const GRADE_CUE = { perfect: 'pickPerfect', good: 'pickGood', bad: 'pickBad', risk: 'pickRisk' } as const;
const OVER_CUE = { overrun: 'playerDeath', titan: 'titanLand' } as const;
/** The heartbeat quickens over this long after the Titan arrives; audio has no view of its descent. */
const TITAN_RAMP_MS = 20000;
const VOLLEY_GAP_MS = 250;
/** Kill bundles vary +-3% in pitch so a run of them is a texture, not a metronome. */
const KILL_JITTER = 0.03;

/** A counter hashed to [-1, 1): variation without randomness, so a replay sounds the same. */
function hash01(n: number): number {
  let x = (n * 0x9e3779b1) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return (x / 0x100000000) * 2 - 1;
}

/** Per-event extras the seam may pass: `share` sizes a charge, `count` weights a kill. */
export interface CueExtras { share?: number; count?: number }

export interface AudioSeam {
  play(name: CueName, extras?: CueExtras & { t?: number }): boolean;
  voice(name: CueName, opts?: VoiceOpts): boolean;
  tick(t?: number): void;
  render(name: CueName, seconds?: number, opts?: VoiceOpts): Promise<{ sampleRate: number; pcm16: string }>;
  cues(): { name: CueName; durationMs: number; db: number; category: string; priority: number; enabled: boolean }[];
  setMuted(on: boolean): void;
  stopAll(): void;
  readonly muted: boolean;
  readonly stats: Stats;
  voicesOf(name: CueName): number;
}

export class AudioEvents {
  private readonly bundler = new Bundler();
  private killTimes: number[] = [];
  private titanSince = -1;
  private nextPulse = 0;
  private lastVolley = -Infinity;
  private paused = false;
  private killVoices = 0;

  constructor(readonly audio: Audio, private readonly events: Phaser.Events.EventEmitter) {
    events.on('moment', (list: SimEvent[]) => this.onMoment(list));
    events.on('hud', () => this.tick(performance.now()));
    events.on('paused', (on: boolean) => this.onPaused(on));
    events.on('restart', () => this.reset());
    events.on('gameover', () => this.onGameOver());
    events.on('startmatch', () => { this.audio.play('start'); });
    events.on('mutetoggle', () => this.toggleMute());
  }

  /** One simulation event becomes at most one cue, or one tally in the bundler. */
  cue(kind: CueName, now: number, extras: CueExtras = {}): boolean {
    const cue = CUES[kind];
    if (cue.bundle) {
      const flush = this.bundler.add(kind, cue.bundle, now, extras.share ?? 0);
      if (kind === 'kill') this.killTimes.push(now);
      this.audio.bundled = this.bundler.bundled;
      return flush ? this.playFlush(flush) : false;
    }
    return this.audio.play(kind);
  }

  private playFlush(flush: Flush): boolean {
    const name = flush.name as CueName;
    const cue = CUES[name];
    const opts: VoiceOpts = cue.encode ? encodeBundle(flush.count) : {};
    if (cue.encode) opts.pitch = (opts.pitch ?? 1) * (1 + KILL_JITTER * hash01(this.killVoices++));
    if (cue.share) opts.gainDb = Math.min(cue.share.max - cue.db, cue.share.range * Math.min(1, flush.share / cue.share.scale));
    return this.audio.play(name, opts);
  }

  private onMoment(list: SimEvent[]): void {
    const now = performance.now();
    for (const e of list) this.onEvent(e, now);
  }

  private onEvent(e: SimEvent, now: number): void {
    switch (e.kind) {
      case 'kill': if (!e.titan) this.cue('kill', now); break;
      case 'contact': if (!e.titan) this.cue('contact', now, { share: e.share }); break;
      case 'breach': if (!e.titan) this.cue('breach', now, { share: e.share }); break;
      case 'fire': if (e.hits > 0) this.cue('fireHit', now); break;
      case 'pick': this.cue(GRADE_CUE[e.grade], now); break;
      case 'miss': this.cue('miss', now); break;
      case 'rescue': this.cue('rescue', now); break;
      case 'wave': this.cue('wave', now); break;
      case 'sense': this.cue('sense', now); break;
      case 'titan': this.onTitan(e.phase, now); break;
      case 'over': this.stopTitan(); this.audio.play(OVER_CUE[e.cause]); break;
    }
  }

  private onTitan(phase: 'arrive' | 'volley' | 'down', now: number): void {
    if (phase === 'arrive') {
      this.titanSince = now;
      this.nextPulse = now + 800;
      this.audio.play('titanArrive');
    } else if (phase === 'volley') {
      if (now - this.lastVolley < VOLLEY_GAP_MS) return;
      this.lastVolley = now;
      this.audio.play('titanVolley');
    } else {
      this.stopTitan();
      this.audio.play('titanKill');
    }
  }

  private stopTitan(): void { this.titanSince = -1; }

  /** Once per frame: closes bundle windows, eases the kill bus, beats the Titan's heart. */
  tick(now: number): void {
    for (const flush of this.bundler.update(now)) this.playFlush(flush);
    while (this.killTimes.length && now - this.killTimes[0] > 1000) this.killTimes.shift();
    this.audio.setKillRate(this.killTimes.length);
    if (this.titanSince >= 0 && !this.paused && now >= this.nextPulse) {
      const progress = Math.min(1, (now - this.titanSince) / TITAN_RAMP_MS);
      this.audio.play('titanPulse', { pitch: (55 + 27 * progress) / 55 });
      this.nextPulse = now + 2000 - 1200 * progress;
    }
  }

  private onPaused(on: boolean): void {
    this.paused = on;
    if (on) this.audio.stopAll();
    this.audio.play(on ? 'pause' : 'resume');
    if (!on) this.nextPulse = performance.now() + 400;
  }

  private onGameOver(): void {
    this.stopTitan();
    this.bundler.reset();
    this.killTimes.length = 0;
    // The death cue arrives in the same frame's `moment`, after this; keep it if it is already sounding.
    this.audio.stopAll('playerDeath');
  }

  private reset(): void {
    this.stopTitan();
    this.paused = false;
    this.bundler.reset();
    this.killTimes.length = 0;
    this.audio.stopAll();
  }

  private toggleMute(): void {
    this.audio.setMuted(!this.audio.muted);
    this.events.emit('muted', this.audio.muted);
  }
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

/**
 * Wires audio to the game. `?mute=1` starts muted; `?audio=1` forces it on;
 * a `?seed=` page without `audio=1` is an instrument run and never creates a
 * context at all. The first pointer, touch or key anywhere is the unlock.
 */
export function installAudio(events: Phaser.Events.EventEmitter, search: string): AudioSeam {
  const params = new URLSearchParams(search);
  const disabled = params.has('seed') && params.get('audio') !== '1';
  const muted = params.get('mute') === '1' || (readStoredMute() ?? false);
  const audio = new Audio(disabled, muted);
  const wired = new AudioEvents(audio, events);

  const unlock = (): void => {
    audio.unlock();
    for (const type of ['pointerdown', 'touchend', 'keydown']) window.removeEventListener(type, unlock, true);
  };
  for (const type of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(type, unlock, { capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) audio.suspend(); else audio.resume(); });

  const seam: AudioSeam = {
    play: (name, extras = {}) => wired.cue(name, extras.t ?? performance.now(), extras),
    voice: (name, opts) => audio.play(name, opts),
    tick: (t) => wired.tick(t ?? performance.now()),
    render: async (name, seconds, opts) => ({ sampleRate: 48000, pcm16: pcm16(await audio.render(name, seconds, opts)) }),
    cues: () => CUE_NAMES.map((name) => ({
      name, durationMs: cueDuration(CUES[name]), db: CUES[name].db, category: CUES[name].category,
      priority: CUES[name].priority, enabled: CUES[name].enabled !== false,
    })),
    setMuted: (on) => { audio.setMuted(on); events.emit('muted', on); },
    stopAll: () => audio.stopAll(),
    get muted() { return audio.muted; },
    get stats() { return audio.stats; },
    voicesOf: (name) => audio.voicesOf(name),
  };
  (window as unknown as { __audio: AudioSeam }).__audio = seam;
  return seam;
}
