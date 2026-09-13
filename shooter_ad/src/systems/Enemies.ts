import { ARENA, CAGE, ENEMY_FIRE, VIEW, WAVE } from '../config';
import { ENEMY_BY_ID, poolAverageHp, rollEnemy, type EnemyType } from '../data/enemies';
import type { Difficulty } from './Difficulty';
import type { EnemyBullets } from './EnemyBullets';
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
  active: boolean;
}

/** A cage of allies: shoot it open before it leaves the screen to grow the army. */
export interface Cage {
  x: number; y: number;
  hp: number; maxHp: number;
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

  private spawn(type: EnemyType, x: number, y: number, hpScale = 1): void {
    const hp = type.hp * this.hpMult * hpScale;
    const phase = this.rng() * Math.PI * 2;
    const free = this.items.find((e) => !e.active);
    const enemy: Enemy = {
      x, y, hp, maxHp: hp, type, radius: type.radius,
      phase, seed: Math.floor(phase * 1e6) | 0,
      timer: 0, fx: 0, fy: 1,
      waypoint: null, leg: 0, cycle: -1, anchor: y, dir: 1,
      gunCooldown: ENEMY_FIRE.armDelay + phase * 0.12,
      traitCooldown: 0,
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
        const scale = this.difficulty.bossHpScale(boss.hp * this.hpMult);
        this.spawn(boss, VIEW.width / 2, ARENA.spawnY - 40, scale);
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
      applyMotion(e, dt, this.band(e.radius));
      applyTraits(e, dt, this.traits);
    }

    return { newWave };
  }

  private updateCages(dt: number): void {
    this.cageAccum += dt;
    if (this.cageAccum > this.wave.duration && this.rng() < CAGE.chancePerWave) {
      this.cageAccum = 0;
      const hp = CAGE.hp * this.hpMult;
      const cage = this.cages.find((c) => !c.active);
      const fresh: Cage = {
        x: this.spawnX(CAGE.radius), y: ARENA.spawnY, hp, maxHp: hp, active: true,
      };
      if (cage) Object.assign(cage, fresh);
      else this.cages.push(fresh);
    }
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

  /** Enemies past the breach line. Removes them and reports the power cost. */
  collectBreaches(): number {
    let cost = 0;
    for (const e of this.items) {
      if (!e.active || e.y < ARENA.breachY) continue;
      cost += e.type.damage;
      e.active = false;
    }
    return cost;
  }

  reset(): void {
    for (const e of this.items) e.active = false;
    for (const c of this.cages) c.active = false;
    this.wave = this.buildWave(1);
    this.spawnAccum = 0;
    this.cageAccum = 0;
  }
}
