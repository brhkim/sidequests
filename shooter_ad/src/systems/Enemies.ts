import { ARENA, CAGE, ENEMY_FIRE, VIEW, WAVE } from '../config';
import { ENEMY_BY_ID, poolAverageHp, rollEnemy, type EnemyType } from '../data/enemies';
import { touching } from './Contact';
import type { Difficulty } from './Difficulty';
import type { EnemyBullets, Hittable } from './EnemyBullets';
import { applyMotion, armorAgainst, type Band } from './EnemyMotion';
import { applyTraits, type TraitContext } from './EnemyTraits';

export interface Enemy {
  x: number; y: number;
  hp: number; maxHp: number;
  type: EnemyType;
  radius: number;
  /** Per-enemy phase so wave-shaped movement is not synchronised. */
  phase: number;
  /** Per-enemy seed for `hash01`, so long-lived motion never touches the
   * shared generator. Derived from `phase`, so spawning still costs one draw. */
  seed: number;
  /** Age in seconds. Every motion case reads it; nothing resets it. */
  timer: number;
  /** Facing, from last frame's displacement. Drives directional armour. */
  fx: number; fy: number;
  /** Waypoint motion: current lateral target and how many legs have been run. */
  waypoint: number | null;
  leg: number;
  /** Harass/dash: index of the movement cycle currently running. */
  cycle: number;
  /** Deepest y reached, ratcheted forward - the floor retreat cannot cross. */
  anchor: number;
  /** Dash lateral direction, +1 or -1. */
  dir: number;
  gunCooldown: number;
  traitCooldown: number;
  /** Fired a volley THIS step. Cleared every step before traits run; the
   * renderer reads it off the Titan for its volley event. */
  volleyed: boolean;
  /** `timer` at the last hit that landed, -1 if none. Written here, read only
   * by rendering (the hit flash); nothing in `systems/` branches on it. */
  hitFlash: number;
  active: boolean;
}

/**
 * A body that reached the army and was removed for it - not killed. What it
 * costs is priced by `Contact.contactCost` against the squad's power, which
 * this system does not hold, so the bodies come back rather than a sum.
 */
export interface Consumed { readonly type: EnemyType; readonly x: number; readonly y: number }

/** A cage of allies: shoot it open before it leaves the screen to grow the army. */
export interface Cage {
  x: number; y: number;
  hp: number; maxHp: number;
  /** Simulated seconds at the last hit, -1 if none. Rendering only. */
  hitFlash: number;
  active: boolean;
}

export interface WaveState {
  index: number;
  timeLeft: number;
  duration: number;
  spawnRate: number;
}

export class Enemies {
  readonly items: Enemy[] = [];
  readonly cages: Cage[] = [];
  wave: WaveState;
  private spawnAccum = 0;
  private cageAccum = 0;
  /** Cages spawned this run; `npm run balance` reads it as cages per minute. */
  cagesSpawned = 0;

  /** Set by GameScene each frame: what the squad can actually destroy. */
  playerDps = 1;
  /** Set by GameScene each frame: where aimed guns lead. */
  targetX: number = VIEW.width / 2;
  targetY: number = ARENA.laneY;

  private throttled: { hpMult: number; spawnRate: number } =
    { hpMult: 1, spawnRate: WAVE.baseSpawnRate };

  /** Built once; `targetX`/`targetY` are getters so traits always read the
   * squad's position for THIS frame rather than the one it was built on. */
  private readonly traits: TraitContext;

  constructor(
    private readonly rng: () => number,
    private readonly difficulty: Difficulty,
    fire: EnemyBullets,
  ) {
    this.wave = this.buildWave(1);
    const self = this;
    this.traits = {
      items: this.items,
      fire,
      get targetX(): number { return self.targetX; },
      get targetY(): number { return self.targetY; },
      spawn: (type, x, y, hpScale) => this.spawn(type, x, y, hpScale),
      rng: this.rng,
    };
  }

  /**
   * Instrument seam for `npm run from`: begin at a later wave, so the enemy
   * pool, the spawn curve and the gate speed all match an injected squad
   * rather than sending wave-1 fodder at a late-game build. Nothing in a
   * shipped game calls it.
   */
  startAt(wave: number): void {
    this.wave = this.buildWave(Math.max(1, Math.floor(wave)));
  }

  get hpMult(): number { return this.throttled.hpMult; }
  get spawnRate(): number { return this.throttled.spawnRate; }

  /**
   * Horizontal band enemies may occupy: only where the squad's CENTRE can
   * reach. Outside it, targets drift past columns the central mass can never
   * line up on.
   */
  private band(radius: number): Band {
    const inset = ARENA.spawnInset + radius;
    return { min: ARENA.minX + inset, max: ARENA.maxX - inset };
  }

  private buildWave(index: number): WaveState {
    const duration = Math.max(
      WAVE.minDuration,
      WAVE.baseDuration * Math.pow(WAVE.durationFalloff, index - 1),
    );
    return {
      index,
      duration,
      timeLeft: duration,
      spawnRate: Math.min(
        WAVE.maxSpawnRate,
        WAVE.baseSpawnRate + (index - 1) * WAVE.spawnRateGrowth,
      ),
    };
  }

  /** Where a Titan appears; `titanProgress` measures its descent from here. */
  static readonly titanSpawnY = ARENA.spawnY - 40;

  /**
   * The HP a Titan spawning NOW would have: the boss's own descent and armor
   * through `Difficulty.titanHp`. The boss reads it on a boss wave; a rescue
   * cage reads a fraction of it whenever it spawns, so the two scale together.
   */
  private titanBudget(): number {
    const boss = ENEMY_BY_ID.get('titan');
    if (!boss) return 1;
    const travelSeconds = (ARENA.breachY - Enemies.titanSpawnY) / boss.speed;
    return this.difficulty.titanHp(travelSeconds, boss.armor);
  }

  /** The live Titan, if one is on the board. Instruments read it; nothing in
   * the shipped game does. */
  get titan(): Enemy | null {
    return this.items.find((e) => e.active && e.type.id === 'titan') ?? null;
  }

  /** Fraction of the descent a Titan has covered, 0 at spawn and 1 at the
   * breach line - the axis the boss budget is written in. */
  static titanProgress(e: Enemy): number {
    return Enemies.titanProgressAt(e.y);
  }

  /** The same axis for a bare y, for where a landed Titan was consumed. */
  static titanProgressAt(y: number): number {
    return (y - Enemies.titanSpawnY) / (ARENA.breachY - Enemies.titanSpawnY);
  }

  /**
   * `hpScale` multiplies the wave-scaled HP ordinary bodies get; `absoluteHp`
   * replaces it outright, for the one body whose HP is a deadline and not a
   * share of a pressure budget.
   */
  private spawn(type: EnemyType, x: number, y: number, hpScale = 1, absoluteHp?: number): void {
    const hp = absoluteHp ?? type.hp * this.hpMult * hpScale;
    const phase = this.rng() * Math.PI * 2;
    const free = this.items.find((e) => !e.active);
    const enemy: Enemy = {
      x, y, hp, maxHp: hp, type, radius: type.radius,
      phase, seed: Math.floor(phase * 1e6) | 0,
      timer: 0, fx: 0, fy: 1,
      waypoint: null, leg: 0, cycle: -1, anchor: y, dir: 1,
      gunCooldown: ENEMY_FIRE.armDelay + phase * 0.12,
      traitCooldown: 0,
      volleyed: false,
      hitFlash: -1,
      active: true,
    };
    if (free) Object.assign(free, enemy);
    else this.items.push(enemy);
  }

  private spawnX(radius: number): number {
    const { min, max } = this.band(radius);
    return min + this.rng() * Math.max(0, max - min);
  }

  /** Advances the wave clock. Returns true on the frame a new wave begins. */
  private advanceWave(dt: number): boolean {
    this.wave.timeLeft -= dt;
    if (this.wave.timeLeft > 0) return false;
    const next = this.wave.index + 1;
    this.wave = this.buildWave(next);
    if (next % WAVE.bossEvery === 0) {
      const boss = ENEMY_BY_ID.get('titan');
      if (boss) {
        // Sized by the distance it has to cover, not by a pressure budget: the
        // Titan ends the run when it crosses the breach line, so the only
        // question is whether a competent player can kill it on the way down.
        // The budget is ABSOLUTE HP: the wave's `hpMult` is what ordinary
        // bodies are scaled by to spend a pressure budget, and applying it here
        // too once multiplied the boss by whatever the wave happened to be
        // scaled by - thousands of times, late - so no Titan past the first was
        // ever killable, and the constants that were supposed to size it did
        // not matter at all.
        this.spawn(boss, VIEW.width / 2, Enemies.titanSpawnY, 1, this.titanBudget());
      }
    }
    return true;
  }

  update(dt: number): { newWave: boolean } {
    const newWave = this.advanceWave(dt);

    this.difficulty.update(dt, this.playerDps);
    this.throttled = this.difficulty.throttle(
      this.wave.spawnRate, poolAverageHp(this.wave.index),
    );

    this.spawnAccum += dt * this.throttled.spawnRate;
    while (this.spawnAccum >= 1) {
      this.spawnAccum -= 1;
      const type = rollEnemy(this.wave.index, this.rng);
      this.spawn(type, this.spawnX(type.radius), ARENA.spawnY);
      this.difficulty.observeSpawn();
    }

    this.updateCages(dt);

    for (const e of this.items) {
      if (!e.active) continue;
      e.timer += dt;
      e.volleyed = false;
      applyMotion(e, dt, this.band(e.radius));
      applyTraits(e, dt, this.traits);
    }

    return { newWave };
  }

  private updateCages(dt: number): void {
    this.cageAccum += dt;
    if (this.cageAccum > this.wave.duration) {
      // One roll per wave duration, and the clock restarts on EVERY roll.
      // For two versions it restarted only on a success, so a failed roll
      // was rolled again on the next step - sixty times a second - until
      // one passed: at 40% that is a cage within ~40ms of the deadline on
      // every wave, and the 40% was a figure on paper. Measured in 0.8.
      this.cageAccum = 0;
      if (this.rng() >= CAGE.chancePerWave) return this.driftCages(dt);
      this.cagesSpawned++;
      // A fifth of a Titan, not a wave-scaled constant: the cage is priced off
      // the same par budget the boss is, so opening one costs the same share
      // of a run's fire at every stage. Par gets nothing for it (see
      // Difficulty), which is what makes it a way back for a player behind.
      const hp = Math.max(1, this.titanBudget() * CAGE.hpTitanFraction);
      const cage = this.cages.find((c) => !c.active);
      const fresh: Cage = {
        x: this.spawnX(CAGE.radius), y: ARENA.spawnY, hp, maxHp: hp, hitFlash: -1, active: true,
      };
      if (cage) Object.assign(cage, fresh);
      else this.cages.push(fresh);
    }
    this.driftCages(dt);
  }

  private driftCages(dt: number): void {
    for (const c of this.cages) {
      if (!c.active) continue;
      c.y += CAGE.speed * dt;
      if (c.y > VIEW.height + 40) c.active = false;
    }
  }

  /**
   * Applies armour and returns true if the hit killed the enemy. `(dx, dy)` is
   * the direction the shot was travelling, which is what a directional shield
   * is measured against.
   */
  damage(e: Enemy, amount: number, dx = 0, dy = -1): boolean {
    e.hp -= amount * (1 - armorAgainst(e, dx, dy));
    e.hitFlash = e.timer;
    if (e.hp > 0) return false;
    e.active = false;
    const t = e.type;
    if (t.splitInto) {
      const child = ENEMY_BY_ID.get(t.splitInto);
      if (child) {
        const n = t.splitCount ?? 2;
        for (let i = 0; i < n; i++) {
          this.spawn(child, e.x + (i - (n - 1) / 2) * 20, e.y, 0.8);
        }
      }
    }
    return true;
  }

  /**
   * Bodies overlapping a unit. Removed - no kill, no split, no streak: a body
   * that reached the army is a failure to kill, and crediting it would make
   * standing in the stream a way to farm. A Splitter does not split either;
   * three Grunts spawned inside the ring would each contact next step.
   */
  collectContacts(units: readonly Hittable[], unitRadius: number): { consumed: Consumed[]; titan: boolean } {
    const out = { consumed: [] as Consumed[], titan: false };
    for (const e of this.items) {
      if (e.active && touching(e, units, unitRadius)) this.consume(e, out);
    }
    return out;
  }

  /**
   * Bodies past the breach line that missed the army. Same removal, same
   * price (`Contact.contactCost`): reaching you IS the failure, whichever
   * line was crossed first.
   *
   * A Titan arriving is not damage, it is the end of the run. A boss that can be
   * absorbed like any other body is not a boss, and the whole point of sizing
   * its HP against par is that reaching you is supposed to be fatal - otherwise
   * the deadline it creates is a suggestion.
   */
  collectBreaches(): { consumed: Consumed[]; titan: boolean } {
    const out = { consumed: [] as Consumed[], titan: false };
    for (const e of this.items) {
      if (e.active && e.y >= ARENA.breachY) this.consume(e, out);
    }
    return out;
  }

  /** Removes a body without killing it: `active` off directly, never through
   * `damage`, so nothing splits and no kill is counted. */
  private consume(e: Enemy, out: { consumed: Consumed[]; titan: boolean }): void {
    if (e.type.id === 'titan') out.titan = true;
    out.consumed.push({ type: e.type, x: e.x, y: e.y });
    e.active = false;
  }

  reset(): void {
    for (const e of this.items) e.active = false;
    for (const c of this.cages) c.active = false;
    this.wave = this.buildWave(1);
    this.spawnAccum = 0;
    this.cageAccum = 0;
    this.cagesSpawned = 0;
  }
}
