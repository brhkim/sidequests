/**
 * The music engine: one track at a time, scheduled a bar ahead on the audio
 * clock (the "tale of two clocks" pattern: a loose 25 ms timer decides WHEN
 * to schedule, the AudioContext clock decides when each note sounds, so a
 * janky frame never makes the music stutter). A bar is scheduled whole when
 * the clock comes within `LOOKAHEAD` of its start, which also means a mode
 * change - a Titan arriving - lands on the next barline, musically.
 *
 * It reads nothing but what `AudioEvents` tells it: the mode (menu, play,
 * boss), an intensity level 0-4, pause, and the run ending. It publishes
 * the chord it is playing, by audio time, so the effects play in key.
 * Nothing in it can reach the simulation.
 */
import { dbToGain } from '../synth';
import { setHarmony, type Harmony } from '../harmony';
import type { Space } from '../space';
import { BARS, barEvents, hash01, planPhrase, STEPS, type MusicMode, type PhrasePlan } from './composer';
import { applyTrack, buildRig, scheduleBar, stepSeconds, type Rig } from './rig';
import { TRACKS } from './tracks';
import type { NoteEvent, SectionName, TrackDef } from './types';

const LOOKAHEAD = 0.15;
const TIMER_MS = 25;
/** The music's level into the master, dB; the menu sits a little under play. */
const LEVEL_DB = { play: -10, boss: -9, menu: -12 } as const;
const PAUSE_CUTOFF = 650;

export interface MusicStats { bars: number; nodes: number; late: number; track: string; section: string; level: number; running: boolean }

export class Music {
  private rig: Rig | null = null;
  private ctx: BaseAudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private trackIndex = 0;
  private track: TrackDef = TRACKS[0];
  private seed = 1;
  private mode: MusicMode = 'menu';
  private level = 0;
  private cursor = 0;
  private cursorLevel = -1;
  private phrase = 0;
  private bar = 0;
  private plan: PhrasePlan | null = null;
  private prevSection: SectionName | undefined;
  private nextStepAt = -1;
  private step = 0;
  private barAt = 0;
  private readonly steps: NoteEvent[][] = Array.from({ length: STEPS }, () => []);
  private replan: { force?: SectionName; crash?: boolean } | null = null;
  private pendingTrack = -1;
  private timeline: { t: number; h: Harmony }[] = [];
  private enabled: boolean;
  private running = false;
  /** Offline rendering: no timer, no ramps on the live clock, every bar's harmony kept. */
  private offline = false;
  private log: { t: number; h: Harmony; section: SectionName }[] = [];
  private counters = { bars: 0, nodes: 0, late: 0 };

  constructor(enabled: boolean) { this.enabled = enabled; }

  get on(): boolean { return this.enabled; }
  get trackName(): string { return this.track.name; }

  /** The context exists (after the unlock gesture): build the rig once. */
  attach(ctx: BaseAudioContext, dest: AudioNode, space: Space): void {
    if (this.rig) return;
    this.ctx = ctx;
    this.rig = buildRig(ctx, dest, space);
    this.rig.out.gain.value = 0;
    this.counters.nodes += this.rig.nodes;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) this.begin(); else this.fadeOut(0.4, true);
  }

  /** Menu, play or boss. Takes effect on the next barline; `crash` marks it. */
  setMode(mode: MusicMode, opts: { force?: SectionName; crash?: boolean } = {}): void {
    const changed = mode !== this.mode;
    this.mode = mode;
    if (changed || opts.force) this.replan = { force: opts.force, crash: opts.crash ?? changed };
    if (!this.offline) this.begin();
  }

  /** Intensity 0-4; read at the next phrase. */
  setLevel(level: number): void { this.level = Math.max(0, Math.min(4, Math.round(level))); }

  /** Moves to the next track at the next barline (a new run, every second Titan). */
  nextTrack(immediately = false): void {
    this.pendingTrack = (this.trackIndex + 1) % TRACKS.length;
    if (immediately) { this.applyPending(); this.nextStepAt = -1; }
  }

  /** Moves to track `index` at the next barline (the audition page). */
  selectTrack(index: number): void {
    this.pendingTrack = ((index % TRACKS.length) + TRACKS.length) % TRACKS.length;
  }

  setPaused(on: boolean): void {
    if (!this.ctx || !this.rig) return;
    const t = this.ctx.currentTime;
    this.rig.lp.frequency.cancelScheduledValues(t);
    this.rig.lp.frequency.setTargetAtTime(on ? PAUSE_CUTOFF : 20000, t, on ? 0.08 : 0.15);
    this.rig.duck.gain.setTargetAtTime(on ? dbToGain(-5) : 1, t, 0.1);
  }

  /** The run ended: the filter closes and the music fades over `seconds`, then stops. */
  end(seconds = 1.8): void { this.fadeOut(seconds, true, true); }

  /** Pulls the music down under an effect for `ms`. */
  duck(db: number, ms: number): void {
    if (!this.ctx || !this.rig || !this.running) return;
    const t = this.ctx.currentTime;
    const g = this.rig.duck.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(dbToGain(db), t, 0.015);
    g.setTargetAtTime(1, t + ms / 1000, 0.12);
  }

  /** Publishes the chord sounding at the audio clock's now into `HARMONY`. */
  syncHarmony(): void {
    if (this.ctx) this.syncHarmonyAt(this.ctx.currentTime);
  }

  /** Publishes the chord sounding at context time `t`. */
  syncHarmonyAt(t: number): void {
    if (!this.timeline.length) return;
    let h = this.timeline[0].h;
    for (const e of this.timeline) if (e.t <= t + 0.02) h = e.h;
    setHarmony(h);
  }

  get stats(): MusicStats {
    return { ...this.counters, track: this.track.id, section: this.plan?.name ?? '-', level: this.level, running: this.running };
  }

  private begin(): void {
    if (!this.enabled || !this.ctx || !this.rig) return;
    const t = this.ctx.currentTime;
    const g = this.rig.out.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(dbToGain(LEVEL_DB[this.mode]), t + 0.4);
    this.rig.lp.frequency.cancelScheduledValues(t);
    this.rig.lp.frequency.setTargetAtTime(20000, t, 0.1);
    if (!this.running) {
      this.running = true;
      if (this.nextStepAt < t) { this.nextStepAt = -1; this.replan = this.replan ?? {}; }
    }
    if (!this.timer) this.timer = setInterval(() => this.tick(), TIMER_MS);
    this.tick();
  }

  private fadeOut(seconds: number, stop: boolean, close = false): void {
    if (!this.ctx || !this.rig) return;
    const t = this.ctx.currentTime;
    const g = this.rig.out.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + seconds);
    if (close) this.rig.lp.frequency.setTargetAtTime(250, t, seconds / 3);
    if (stop) this.running = false;
  }

  private applyPending(): void {
    if (this.pendingTrack < 0) return;
    this.trackIndex = this.pendingTrack;
    this.track = TRACKS[this.trackIndex];
    this.pendingTrack = -1;
    this.seed = Math.floor(hash01(this.seed + 7919 * (this.trackIndex + 1)) * 1e9);
    this.phrase = 0;
    this.cursor = 0;
    this.replan = { ...(this.replan ?? {}), crash: true };
  }

  /** The timer: schedules every sixteenth that starts within `LOOKAHEAD` of the audio clock. */
  tick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.rig) return;
    if (!this.running) {
      if (this.timer && this.rig.out.gain.value < 1e-3) { clearInterval(this.timer); this.timer = null; }
      return;
    }
    const now = ctx.currentTime;
    if (this.nextStepAt < 0) { this.nextStepAt = now + 0.06; this.step = 0; }
    if (this.nextStepAt < now - 0.05) { this.counters.late++; this.nextStepAt = now + 0.03; }
    this.advance(now + LOOKAHEAD);
  }

  /**
   * Schedules steps until `until`. A bar is PLANNED on its downbeat and its
   * notes are created a sixteenth at a time, so the graph never holds more
   * than a lookahead of notes that have not started - measured, a graph's
   * waiting nodes cost more than its sounding ones.
   */
  advance(until: number): void {
    const ctx = this.ctx!;
    while (this.nextStepAt < until) {
      if (this.step === 0) this.beginBar(this.nextStepAt);
      const due = this.steps[this.step];
      if (due.length) this.counters.nodes += scheduleBar(ctx, this.rig!, this.track, due, this.barAt);
      this.step++;
      this.nextStepAt = this.barAt + this.step * stepSeconds(this.track);
      if (this.step === STEPS) { this.step = 0; this.bar++; }
    }
  }

  /** Plans the bar starting at `t` (and its phrase, if due) and publishes its chord. */
  private beginBar(t: number): void {
    const rig = this.rig!;
    this.onBar?.(this.counters.bars);
    if (this.pendingTrack >= 0) this.applyPending();
    if (this.replan || !this.plan || this.bar >= BARS) {
      if (this.bar >= BARS) this.phrase++;
      if (this.cursorLevel !== this.level) { this.cursor = 0; this.cursorLevel = this.level; }
      applyTrack(rig, this.track, t);
      if (this.offline && !this.silent) rig.out.gain.setValueAtTime(dbToGain(LEVEL_DB[this.mode]), t);
      this.plan = planPhrase(this.track, this.mode, this.level, this.cursor++, this.phrase, this.seed, {
        crash: this.replan?.crash, force: this.replan?.force, prev: this.prevSection,
      });
      this.prevSection = this.plan.name;
      this.replan = null;
      this.bar = 0;
    }
    this.barAt = t;
    for (const list of this.steps) list.length = 0;
    for (const ev of barEvents(this.track, this.plan, this.bar, this.seed, this.phrase)) this.steps[ev.step].push(ev);
    this.timeline.push({ t, h: this.plan.harmonies[this.bar] });
    if (this.timeline.length > 4) this.timeline.shift();
    if (this.offline) this.log.push({ t, h: this.plan.harmonies[this.bar], section: this.plan.name });
    this.counters.bars++;
  }

  /**
   * Offline: pins a track and a seed on a rig built in an OfflineAudioContext,
   * so `advance` can lay bars from its own clock. The instrument's
   * path to exactly what the live engine schedules.
   */
  prime(trackIndex: number, seed: number): void {
    this.offline = true;
    this.trackIndex = trackIndex % TRACKS.length;
    this.track = TRACKS[this.trackIndex];
    this.seed = seed;
    this.phrase = 0; this.cursor = 0; this.cursorLevel = -1; this.bar = 0; this.plan = null;
    this.running = true;
    this.nextStepAt = 0.05;
    this.step = 0;
    if (this.rig) this.rig.out.gain.value = dbToGain(0);
  }

  /** Offline: renders the effects alone, for a with / without comparison. */
  silence(): void { this.silent = true; if (this.rig) this.rig.out.gain.value = 0; }
  private silent = false;

  /** Offline: called on every downbeat with the bar count so far, before it is planned. */
  onBar: ((bar: number) => void) | null = null;

  /** Offline: the bar length of the current track, seconds. */
  get barSeconds(): number { return stepSeconds(this.track) * STEPS; }

  /** Offline: every bar laid so far - its time, its chord and its section. */
  get bars(): readonly { t: number; h: Harmony; section: SectionName }[] { return this.log; }

  /** A fresh run: the next track, a new variation seed, play mode from the downbeat. */
  newRun(runNumber: number): void {
    this.seed = Math.floor(hash01(runNumber * 104729 + 17) * 1e9);
    if (runNumber > 1) this.nextTrack();
    this.setMode('play', { crash: true });
  }
}
