import { ARENA, ENEMY_FIRE } from '../config';
import { ENEMY_BY_ID, type EnemyType } from '../data/enemies';
import type { Enemy } from './Enemies';
import type { EnemyBullets } from './EnemyBullets';

/**
 * What a trait is allowed to reach: the roster around it, the projectile pool,
 * where the squad currently is, and the ability to add more enemies.
 */
export interface TraitContext {
  readonly items: readonly Enemy[];
  readonly fire: EnemyBullets;
  /** Where aimed guns lead. Set by GameScene each frame. */
  readonly targetX: number;
  readonly targetY: number;
  spawn(type: EnemyType, x: number, y: number, hpScale?: number): void;
  rng(): number;
}

/**
 * Everything an enemy does that is not movement, driven entirely by which
 * optional fields its type declares. A new enemy combines shooting, escorting
 * and splitting by filling in data; it never needs a case here, which
 * is the property that stopped holding last time this file was a `switch`.
 */
export function applyTraits(e: Enemy, dt: number, ctx: TraitContext): void {
  const t = e.type;

  if (t.gun) {
    e.gunCooldown -= dt;
    // Nothing shoots from off the top of the screen, where the player cannot
    // see what is firing at them or do anything about it.
    if (e.gunCooldown <= 0 && e.y > ENEMY_FIRE.minFireY && e.y < ARENA.breachY) {
      e.gunCooldown += t.gun.interval;
      e.volleyed = true;
      shoot(e, ctx);
    }
  }

  if (!t.escort) return;
  e.traitCooldown -= dt;
  if (e.traitCooldown > 0) return;
  e.traitCooldown += t.escort.interval;

  const child = ENEMY_BY_ID.get(t.escort.spawn);
  if (!child) return;
  for (let i = 0; i < t.escort.count; i++) {
    ctx.spawn(child, e.x + (ctx.rng() - 0.5) * 80, e.y + 20);
  }
}

function shoot(e: Enemy, ctx: TraitContext): void {
  const gun = e.type.gun;
  if (!gun) return;
  // Straight down, unless the gun leads the squad - which is what makes a
  // Spitter a reason to move and a Lancer a reason to not be in that column.
  const base = gun.aimed
    ? Math.atan2(ctx.targetY - e.y, ctx.targetX - e.x)
    : Math.PI / 2;
  for (let i = 0; i < gun.count; i++) {
    const offset = gun.count === 1 ? 0 : (i - (gun.count - 1) / 2) * gun.spread;
    const a = base + offset;
    ctx.fire.spawn(
      e.x, e.y + e.radius * 0.6,
      Math.cos(a) * gun.speed, Math.sin(a) * gun.speed,
      gun.damage, gun.shell === true,
    );
  }
}
