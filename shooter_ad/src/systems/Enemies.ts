import { ARENA, CAGE, VIEW, WAVE } from '../config';
import { ENEMY_BY_ID, poolAverageHp, rollEnemy, type EnemyType } from '../data/enemies';
import type { Difficulty } from './Difficulty';

export interface Enemy {
  x: number; y: number;
  hp: number; maxHp: number;
  type: EnemyType;
  radius: number;
  /** Per-enemy phase so zigzag movement is not synchronised across the wave. */
  phase: number;
  timer: number;
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

  constructor(
    private readonly rng: () => number,
    private readonly difficulty: Difficulty,
  ) {
    this.wave = this.buildWave(1);
  }

  /**
   * Horizontal band enemies may occupy: only where the squad's CENTRE can
   * reach. Outside it, targets drift past columns the central mass can never
   * line up on.
   */
  private band(radius: number): { min: number; max: number } {
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

  /** Current HP multiplier, set by the closed-loop difficulty model. */
  /** Set by GameScene each frame: what the squad can actually destroy. */
  playerDps = 1;
  /** Budget split for this frame, recomputed in update(). */
  private throttled: { hpMult: number; spawnRate: number } =
    { hpMult: 1, spawnRate: WAVE.baseSpawnRate };

  get hpMult(): number { return this.throttled.hpMult; }
  get spawnRate(): number { return this.throttled.spawnRate; }

  private spawn(type: EnemyType, x: number, y: number, hpScale = 1): void {
    const hp = type.hp * this.hpMult * hpScale;
    const free = this.items.find((e) => !e.active);
    const enemy: Enemy = {
      x, y, hp, maxHp: hp, type, radius: type.radius,
      phase: this.rng() * Math.PI * 2, timer: 0, active: true,
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

    for (const e of this.items) {
      if (!e.active) continue;
      e.timer += dt;
      this.applyBehaviour(e, dt);
    }

    for (const c of this.cages) {
      if (!c.active) continue;
      c.y += CAGE.speed * dt;
      if (c.y > VIEW.height + 40) c.active = false;
    }

    return { newWave };
  }

  private applyBehaviour(e: Enemy, dt: number): void {
    const t = e.type;
    let speed = t.speed;

    switch (t.behaviour) {
      case 'zigzag':
        e.x += Math.sin(e.timer * 3.4 + e.phase) * 78 * dt;
        break;
      case 'charger':
        if (e.y > ARENA.laneY - 320) speed *= 2.6;
        break;
      case 'healer': {
        if (e.timer > 1.4) {
          e.timer = 0;
          for (const other of this.items) {
            if (!other.active || other === e) continue;
            const dx = other.x - e.x, dy = other.y - e.y;
            if (dx * dx + dy * dy < 110 * 110) {
              other.hp = Math.min(other.maxHp, other.hp + other.maxHp * 0.12);
            }
          }
        }
        break;
      }
      case 'boss': {
        e.x += Math.sin(e.timer * 0.8 + e.phase) * 42 * dt;
        if (e.timer > 2.2) {
          e.timer = 0;
          const escort = ENEMY_BY_ID.get('runner');
          if (escort) {
            this.spawn(escort, e.x + (this.rng() - 0.5) * 80, e.y + 20);
          }
        }
        break;
      }
      default:
        break;
    }

    e.y += speed * dt;
    const { min, max } = this.band(e.radius);
    e.x = Math.max(min, Math.min(max, e.x));
  }

  /** Applies armour and returns true if the hit killed the enemy. */
  damage(e: Enemy, amount: number): boolean {
    e.hp -= amount * (1 - e.type.armor);
    if (e.hp > 0) return false;
    e.active = false;
    const t = e.type;
    if (t.behaviour === 'splitter' && t.splitInto) {
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
