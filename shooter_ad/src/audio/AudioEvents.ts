/**
 * The game's one sound listener. Subscribes to `game.events` - `moment` (the
 * simulation's account of each frame), `hud`, `paused`, `restart`,
 * `showstart`, `startmatch`, `gameover`, `mutetoggle`, `musictoggle`,
 * `uitap` - and answers the toggles with `muted` / `music`. It touches no
 * scene and no system: audio reads events and nothing reads audio, which is
 * what keeps it off the determinism surface.
 *
 * It also CONDUCTS: the music's mode (menu / play / boss), its intensity
 * level (from the wave and the damage being taken), the track rotation (a
 * new run, every second Titan felled) and the pause filter are all decided
 * here from the same events the effects read.
 *
 * The clock the bundler runs on is wall time from `performance.now()`.
 * Audio is allowed that because nothing here can reach the simulation; the
 * instrument drives the same code with a synthetic clock through
 * `window.__audio`.
 */
import type Phaser from 'phaser';
import type { SimEvent } from '../systems/SimEvents';
import type { HudPayload } from '../scenes/hud/types';
import { Audio, type Stats } from './Audio';
import { Bundler, encodeBundle, type Flush } from './collapse';
import { CUES, type CueName } from './cues';
import { hash01 } from './music/composer';
import type { VoiceOpts } from './synth';

const GRADE_CUE = { perfect: 'pickPerfect', good: 'pickGood', bad: 'pickBad', risk: 'pickRisk' } as const;
const OVER_CUE = { overrun: 'playerDeath', titan: 'titanLand' } as const;
const VOLLEY_GAP_MS = 250;
/** Kills climb the chord and fall back, a tone a voice, while they keep coming. */
const KILL_CLIMB = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1];
const KILL_CHAIN_MS = 600;
/** A kill voice varies +-8 cents: a texture, not a metronome, and still in tune. */
const KILL_DETUNE = 0.0046;
/** Effects sit at most this far off centre: portrait phones have one speaker, or two a hand covers. */
const PAN_WIDTH = 0.45;
/** Seconds after the run ends before the menu music fades in under the end screen. */
const MENU_AFTER_MS = 3500;
/** Damage raises intensity; this is its half-life, ms. */
const DANGER_HALF_LIFE = 6000;

/** Per-event extras the seam may pass: `share` sizes a charge, `x` places it. */
export interface CueExtras { share?: number; x?: number }

const panOf = (x: number | undefined): number => (x === undefined ? 0 : Math.max(-1, Math.min(1, (x - 270) / 270)) * PAN_WIDTH);

export class AudioEvents {
  private readonly bundler = new Bundler();
  private killTimes: number[] = [];
  private lastPan: Partial<Record<CueName, number>> = {};
  private killStep = 0;
  private lastKillVoice = -Infinity;
  private killVoices = 0;
  private streak = 0;
  private titanSince = -1;
  private titanProgress = 0;
  private titansDown = 0;
  private nextPulse = 0;
  private lastVolley = -Infinity;
  private paused = false;
  private danger = 0;
  private dangerAt = 0;
  private wave = 1;
  private inRun = false;
  private menuAt = -1;
  private runs = 0;
  private runPending = false;
  private trackShown = '';

  constructor(readonly audio: Audio, private readonly events: Phaser.Events.EventEmitter) {
    events.on('moment', (list: SimEvent[]) => this.onMoment(list));
    events.on('hud', (h: HudPayload) => this.onHud(h));
    events.on('paused', (on: boolean) => this.onPaused(on));
    events.on('restart', () => this.onRestart());
    events.on('showstart', () => this.onShowStart());
    events.on('gameover', () => this.onGameOver());
    events.on('startmatch', () => { this.audio.play('start'); this.beginRun(); });
    events.on('mutetoggle', () => this.toggleMute());
    events.on('musictoggle', () => this.toggleMusic());
    events.on('uitap', () => { this.audio.play('uitap'); });
    // The UI scene's labels start from the truth, not from a default.
    events.on('uiready', () => {
      events.emit('muted', this.audio.muted);
      events.emit('music', this.audio.musicOn);
      events.emit('musictrack', this.audio.music.trackName);
    });
  }

  /** One simulation event becomes at most one cue, or one tally in the bundler. */
  cue(kind: CueName, now: number, extras: CueExtras = {}, opts: VoiceOpts = {}): boolean {
    const cue = CUES[kind];
    const pan = panOf(extras.x);
    if (cue.bundle) {
      this.lastPan[kind] = pan;
      const flush = this.bundler.add(kind, cue.bundle, now, extras.share ?? 0);
      if (kind === 'kill') this.killTimes.push(now);
      this.audio.bundled = this.bundler.bundled;
      return flush ? this.playFlush(flush, now) : false;
    }
    return this.audio.play(kind, { pan, ...opts });
  }

  private playFlush(flush: Flush, now: number): boolean {
    const name = flush.name as CueName;
    const cue = CUES[name];
    const opts: VoiceOpts = cue.encode ? encodeBundle(flush.count) : {};
    opts.pan = this.lastPan[name] ?? 0;
    if (name === 'kill') {
      if (now - this.lastKillVoice > KILL_CHAIN_MS) this.killStep = 0;
      this.lastKillVoice = now;
      opts.climb = KILL_CLIMB[this.killStep++ % KILL_CLIMB.length];
      opts.pitch = 1 + KILL_DETUNE * (hash01(this.killVoices++) * 2 - 1);
    }
    if (cue.share) opts.gainDb = Math.min(cue.share.max - cue.db, cue.share.range * Math.min(1, flush.share / cue.share.scale));
    return this.audio.play(name, opts);
  }

  private onMoment(list: SimEvent[]): void {
    const now = performance.now();
    for (const e of list) this.onEvent(e, now);
  }

  private hurt(share: number, now: number): void {
    this.decayDanger(now);
    this.danger = Math.min(1, this.danger + share * 4 + 0.05);
  }

  private onEvent(e: SimEvent, now: number): void {
    switch (e.kind) {
      case 'kill': if (!e.titan) this.cue('kill', now, { x: e.x }); break;
      case 'contact': if (!e.titan) { this.cue('contact', now, { share: e.share, x: e.x }); this.hurt(e.share, now); } break;
      case 'breach': if (!e.titan) { this.cue('breach', now, { share: e.share, x: e.x }); this.hurt(e.share, now); } break;
      case 'fire': if (e.hits > 0) { this.cue('fireHit', now); this.hurt(e.share, now); } break;
      case 'block': this.cue('block', now, { x: e.x }); break;
      case 'pick': this.onPick(e.grade, e.x, now); break;
      case 'miss': this.streak = 0; this.cue('miss', now, { x: e.x }); break;
      case 'rescue': this.cue('rescue', now, { x: e.x }); break;
      case 'wave': this.wave = e.index; this.cue('wave', now); break;
      case 'sense': this.cue('sense', now); break;
      case 'titan': this.onTitan(e.phase, now); break;
      case 'over': this.stopTitan(); this.streak = 0; this.audio.play(OVER_CUE[e.cause]); break;
    }
  }

  /** A PERFECT streak climbs the arpeggio a chord tone a pick, up to four; anything else resets it. */
  private onPick(grade: keyof typeof GRADE_CUE, x: number, now: number): void {
    if (grade === 'perfect') this.streak++; else this.streak = 0;
    const climb = grade === 'perfect' ? Math.min(this.streak - 1, 4) : 0;
    this.cue(GRADE_CUE[grade], now, { x }, { climb });
  }

  private onTitan(phase: 'arrive' | 'volley' | 'down', now: number): void {
    const music = this.audio.music;
    if (phase === 'arrive') {
      this.titanSince = now;
      this.nextPulse = now + 800;
      this.audio.play('titanArrive');
      this.audio.guard(() => music.setMode('boss', { crash: true }));
    } else if (phase === 'volley') {
      if (now - this.lastVolley < VOLLEY_GAP_MS) return;
      this.lastVolley = now;
      this.audio.play('titanVolley');
    } else {
      this.stopTitan();
      this.audio.play('titanKill');
      this.titansDown++;
      this.audio.guard(() => {
        if (this.titansDown % 2 === 0) music.nextTrack();
        music.setMode('play', { crash: true, force: this.level() >= 2 ? 'drop' : undefined });
      });
    }
  }

  private stopTitan(): void { this.titanSince = -1; }

  private decayDanger(now: number): void {
    this.danger *= Math.pow(0.5, (now - this.dangerAt) / DANGER_HALF_LIFE);
    this.dangerAt = now;
  }

  /** Intensity 1-4 in a run: the wave sets the floor, damage taken lifts it. */
  private level(): number {
    const x = 0.25 + 0.06 * (this.wave - 1) + 0.2 * this.danger;
    return Math.max(1, Math.min(4, Math.floor(x * 5)));
  }

  private onHud(h: HudPayload): void {
    this.wave = h.wave;
    this.titanProgress = h.titan?.progress ?? 0;
    this.tick(performance.now());
  }

  /** Once per frame: closes bundle windows, eases the kill bus, conducts, beats the Titan's heart. */
  tick(now: number): void {
    for (const flush of this.bundler.update(now)) this.playFlush(flush, now);
    while (this.killTimes.length && now - this.killTimes[0] > 1000) this.killTimes.shift();
    this.audio.setKillRate(this.killTimes.length);
    const music = this.audio.music;
    this.decayDanger(now);
    if (this.inRun) this.audio.guard(() => music.setLevel(this.level()));
    if (this.menuAt >= 0 && now >= this.menuAt) { this.menuAt = -1; this.audio.guard(() => music.setMode('menu')); }
    if (music.trackName !== this.trackShown) { this.trackShown = music.trackName; this.events.emit('musictrack', music.trackName); }
    // The heartbeat is for a silent room: with music on, the boss section carries the dread in tempo.
    if (this.titanSince >= 0 && !this.paused && now >= this.nextPulse && !(music.on && this.audio.state === 'running')) {
      const progress = Math.max(this.titanProgress, Math.min(1, (now - this.titanSince) / 20000));
      this.audio.play('titanPulse', { pitch: 1 + 0.5 * progress });
      this.nextPulse = now + 2000 - 1200 * progress;
    }
  }

  private beginRun(): void {
    this.runPending = false;
    this.inRun = true;
    this.menuAt = -1;
    this.titansDown = 0;
    this.streak = 0;
    this.danger = 0;
    this.wave = 1;
    this.runs++;
    this.audio.guard(() => this.audio.music.newRun(this.runs));
  }

  private onPaused(on: boolean): void {
    this.paused = on;
    if (on) this.audio.stopAll();
    this.audio.play(on ? 'pause' : 'resume');
    this.audio.guard(() => this.audio.music.setPaused(on));
    if (!on) this.nextPulse = performance.now() + 400;
  }

  private onGameOver(): void {
    this.stopTitan();
    this.bundler.reset();
    this.killTimes.length = 0;
    this.inRun = false;
    this.menuAt = performance.now() + MENU_AFTER_MS;
    // The death cue arrives in the same frame's `moment`, after this; keep it if it is already sounding.
    this.audio.stopAll('playerDeath');
    this.audio.guard(() => this.audio.music.end());
  }

  /**
   * A restart is a new run - unless the start screen follows in the same
   * tick (a new match waits on START MATCH), so the decision is deferred
   * one task and `showstart` cancels it.
   */
  private onRestart(): void {
    this.stopTitan();
    this.paused = false;
    this.bundler.reset();
    this.killTimes.length = 0;
    this.audio.stopAll();
    this.runPending = true;
    setTimeout(() => { if (this.runPending) this.beginRun(); }, 0);
  }

  private onShowStart(): void {
    this.runPending = false;
    this.inRun = false;
    this.menuAt = -1;
    this.audio.guard(() => this.audio.music.setMode('menu'));
  }

  private toggleMute(): void {
    this.audio.setMuted(!this.audio.muted);
    this.events.emit('muted', this.audio.muted);
  }

  private toggleMusic(): void {
    this.audio.setMusic(!this.audio.musicOn);
    this.events.emit('music', this.audio.musicOn);
  }

  /** After the unlock gesture: the context exists, so the music can begin in whatever mode was asked for. */
  unlocked(): void {
    this.audio.guard(() => this.audio.music.setEnabled(this.audio.music.on));
  }

  get stats(): Stats { return this.audio.stats; }
}
