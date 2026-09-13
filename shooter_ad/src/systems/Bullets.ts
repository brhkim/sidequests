import { WEAPON, VIEW } from '../config';

export interface Bullet {
  x: number; y: number;
  vx: number; vy: number;
  damage: number;
  /** Remaining enemies this bullet can pass through. */
  pierce: number;
  active: boolean;
}

/**
 * Fixed-size pool. Allocation during play is the usual source of frame spikes,
 * and a spike is what causes tunnelling in the collision step, so the pool is
 * load-bearing rather than premature.
 */
export class Bullets {
  readonly items: Bullet[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < WEAPON.maxBullets; i++) {
      this.items.push({ x: 0, y: 0, vx: 0, vy: 0, damage: 0, pierce: 0, active: false });
    }
  }

  spawn(x: number, y: number, vx: number, vy: number, damage: number, pierce: number): void {
    // Scan forward for a free slot; give up rather than overwrite live bullets.
    for (let i = 0; i < this.items.length; i++) {
      const b = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % this.items.length;
      if (!b.active) {
        b.x = x; b.y = y; b.vx = vx; b.vy = vy;
        b.damage = damage; b.pierce = pierce; b.active = true;
        return;
      }
    }
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
