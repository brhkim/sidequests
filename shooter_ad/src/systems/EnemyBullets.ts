import { ENEMY_FIRE, VIEW } from '../config';

export interface EnemyBullet {
  x: number; y: number;
  /** Position at the start of this frame; the collision test sweeps the gap. */
  px: number; py: number;
  vx: number; vy: number;
  /** Squad power destroyed if this lands, before `SQUAD.fireLoss`. */
  damage: number;
  active: boolean;
}

export interface Hittable { x: number; y: number }

/**
 * Enemy fire. Same shape as `Bullets`: a fixed pool with no display objects,
 * rendered by GameScene from a SpritePool.
 *
 * These are slow and the squad is a tight cluster of 8px units, which is the
 * classic tunnelling setup. Two guards, both here rather than at the call site:
 *
 * - movement is split into substeps no longer than `ENEMY_FIRE.maxStep`, so a
 *   long frame cannot teleport a bullet across the formation;
 * - the hit test is SWEPT - point-to-segment distance from each unit to the
 *   bullet's path this frame, not to its endpoint - so even a substep that is
 *   wider than a unit cannot slip between two of them.
 */
export class EnemyBullets {
  readonly items: EnemyBullet[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < ENEMY_FIRE.maxBullets; i++) {
      this.items.push({
        x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, damage: 0, active: false,
      });
    }
  }

  spawn(x: number, y: number, vx: number, vy: number, damage: number): void {
    for (let i = 0; i < this.items.length; i++) {
      const b = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % this.items.length;
      if (!b.active) {
        b.x = x; b.y = y; b.px = x; b.py = y;
        b.vx = vx; b.vy = vy; b.damage = damage; b.active = true;
        return;
      }
    }
  }

  update(dt: number): void {
    for (const b of this.items) {
      if (!b.active) continue;
      b.px = b.x;
      b.py = b.y;
      const travel = Math.hypot(b.vx, b.vy) * dt;
      const steps = Math.max(1, Math.ceil(travel / ENEMY_FIRE.maxStep));
      const step = dt / steps;
      for (let i = 0; i < steps; i++) {
        b.x += b.vx * step;
        b.y += b.vy * step;
      }
      if (b.y < -30 || b.y > VIEW.height + 30 || b.x < -30 || b.x > VIEW.width + 30) {
        b.active = false;
      }
    }
  }

  /**
   * Consumes every bullet whose path this frame crossed a unit, and returns the
   * total damage. Called after `update`, so `px/py -> x/y` is exactly the
   * segment travelled.
   */
  collide(units: readonly Hittable[], radius: number): number {
    let cost = 0;
    const r = radius + ENEMY_FIRE.radius;
    const r2 = r * r;
    for (const b of this.items) {
      if (!b.active) continue;
      for (const u of units) {
        if (segmentDistanceSq(b.px, b.py, b.x, b.y, u.x, u.y) > r2) continue;
        cost += b.damage;
        b.active = false;
        break;
      }
    }
    return cost;
  }

  reset(): void {
    for (const b of this.items) b.active = false;
  }
}

/** Squared distance from point (px, py) to the segment (ax, ay)-(bx, by). */
function segmentDistanceSq(
  ax: number, ay: number, bx: number, by: number, px: number, py: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 1e-9) {
    t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
  }
  const cx = ax + t * dx - px;
  const cy = ay + t * dy - py;
  return cx * cx + cy * cy;
}
