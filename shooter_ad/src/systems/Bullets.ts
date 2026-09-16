import { WEAPON, VIEW } from '../config';

export interface Bullet {
  x: number; y: number;
  vx: number; vy: number;
  damage: number;
  /** Remaining enemies this bullet can pass through. */
  pierce: number;
  active: boolean;
  /**
   * Whether the renderer draws this bullet. PRESENTATION ONLY - an undrawn
   * bullet moves, collides and does damage exactly like a drawn one. Decided
   * once at spawn rather than per frame so a bullet does not flicker in and out
   * on its way up the screen.
   */
  drawn: boolean;
  /**
   * How many real shots a drawn bullet stands for, at the moment it was fired.
   * 1 means it stands for itself. Read only by the tint; see `bulletTint`.
   */
  density: number;
}

/**
 * Fixed-size pool. Allocation during play is the usual source of frame spikes,
 * and a spike is what causes tunnelling in the collision step, so the pool is
 * load-bearing rather than premature.
 */
export class Bullets {
  readonly items: Bullet[] = [];
  private cursor = 0;
  /**
   * Diagnostics, written by `spawn` and read by nothing in the simulation.
   *
   * `refused` is the interesting one: the pool gives up rather than overwrite a
   * live bullet, so past a few hundred shots a second the squad's ACTUAL rate
   * of fire is the pool's recycle rate and not the rate its build implies. That
   * ceiling is invisible in `squadDps`, which is analytic, and invisible on the
   * HUD, which reads `squadDps`. `npm run hud` prints both.
   */
  spawned = 0;
  refused = 0;

  constructor() {
    for (let i = 0; i < WEAPON.maxBullets; i++) {
      this.items.push({
        x: 0, y: 0, vx: 0, vy: 0, damage: 0, pierce: 0, active: false,
        drawn: true, density: 1,
      });
    }
  }

  /**
   * `drawn` and `density` are rendering hints and nothing else. They are
   * arguments rather than a post-spawn mutation so that a caller cannot forget
   * them and silently leave a bullet carrying the previous occupant's tint.
   */
  spawn(
    x: number, y: number, vx: number, vy: number, damage: number, pierce: number,
    drawn = true, density = 1,
  ): void {
    // Scan forward for a free slot; give up rather than overwrite live bullets.
    for (let i = 0; i < this.items.length; i++) {
      const b = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % this.items.length;
      if (!b.active) {
        b.x = x; b.y = y; b.vx = vx; b.vy = vy;
        b.damage = damage; b.pierce = pierce; b.active = true;
        b.drawn = drawn; b.density = density;
        this.spawned++;
        return;
      }
    }
    this.refused++;
  }

  update(dt: number): void {
    for (const b of this.items) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -20 || b.y > VIEW.height + 20 || b.x < -20 || b.x > VIEW.width + 20) {
        b.active = false;
      }
    }
  }
}
