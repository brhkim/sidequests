import { ARENA, MOTION } from '../config';
import { hash01 } from './Rng';
import type { Enemy } from './Enemies';

export interface Band { min: number; max: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * One frame of movement for one enemy.
 *
 * Every case writes only `e.x` / `e.y`; facing (`e.fx`, `e.fy`) is derived from
 * the displacement afterwards so that no case has to remember to set it, and so
 * that a directional shield can never disagree with what the enemy is visibly
 * doing.
 *
 * Randomness here never touches the shared generator - see `hash01`.
 */
export function applyMotion(e: Enemy, dt: number, band: Band): void {
  if (dt <= 0) return;
  const x0 = e.x;
  const y0 = e.y;
  const t = e.type;
  const m = t.motion;
  let vy = t.speed;

  switch (m.kind) {
    case 'zigzag':
      e.x += Math.sin(e.timer * m.frequency + e.phase) * m.amplitude * dt;
      break;

    case 'drift':
      e.x += Math.sin(e.timer * m.frequency + e.phase) * m.amplitude * dt;
      break;

    case 'charger':
      if (e.y > ARENA.laneY - m.trigger) vy *= m.sprint;
      break;

    case 'waypoint': {
      if (e.waypoint === null || Math.abs(e.x - e.waypoint) <= 2) {
        e.leg++;
        e.waypoint = nextWaypoint(e, band, m.span);
      }
      const gap = e.waypoint - e.x;
      const step = m.lateral * dt;
      e.x += Math.abs(gap) <= step ? gap : Math.sign(gap) * step;
      break;
    }

    case 'harass': {
      const cycle = m.advance + m.retreat;
      const index = Math.floor(e.timer / cycle);
      if (index > e.cycle) {
        // Ratchet the high-water mark forward once per cycle. Without this a
        // badly tuned retreat could exactly cancel its own advance and the
        // enemy would hover on the spot for the rest of the run.
        e.cycle = index;
        e.anchor += MOTION.minCycleProgress;
      }
      const phase = e.timer - index * cycle;
      vy = phase < m.advance ? t.speed : -t.speed * m.retreatSpeed;
      break;
    }

    case 'dash': {
      const index = Math.floor(e.timer / m.interval);
      const phase = e.timer - index * m.interval;
      if (phase < m.duration) {
        if (index !== e.cycle) {
          e.cycle = index;
          e.dir = hash01(e.seed, index) < 0.5 ? -1 : 1;
        }
        // Turn away from a wall rather than grinding along it.
        if (e.x - band.min < 70) e.dir = 1;
        else if (band.max - e.x < 70) e.dir = -1;
        vy = t.speed * m.speed;
        e.x += vy * m.lateral * e.dir * dt;
      } else {
        vy = t.speed * m.idle;
      }
      break;
    }
  }

  // Every case above prices `vy` in the data's px/s; the geometry scales it
  // once here so the seconds to the line are what the data says. See
  // `ARENA.descentScale`.
  e.y += vy * ARENA.descentScale * dt;

  if (vy < 0) {
    // Retreat is bounded twice: never above the screen ceiling, and never back
    // past the deepest point this enemy has already reached less its own
    // allowance. Both are hard floors, not steering.
    const allowance = m.kind === 'harass' ? m.maxRetreat : 0;
    e.y = Math.max(e.y, MOTION.ceilingY, e.anchor - allowance);
  } else if (e.y > e.anchor) {
    e.anchor = e.y;
  }

  e.x = clamp(e.x, band.min, band.max);

  const dx = e.x - x0;
  const dy = e.y - y0;
  const len = Math.hypot(dx, dy);
  if (len > 1e-4) {
    e.fx = dx / len;
    e.fy = dy / len;
  }
}

function nextWaypoint(e: Enemy, band: Band, span: number): number {
  const h = hash01(e.seed, e.leg);
  const desired = band.min + h * (band.max - band.min);
  return clamp(clamp(desired, e.x - span, e.x + span), band.min, band.max);
}

/**
 * Damage reduction for a hit arriving along the unit vector (dx, dy).
 *
 * `armor` is flat and applies from every side. `frontArmor` applies only inside
 * the cone the enemy is walking into, tapering to nothing by the time the shot
 * is coming in from the flank - so a Shielder on a hard sideways leg is soft,
 * and one walking straight at you is not.
 */
const FULL = Math.cos(0.61);  // ~35 degrees: dead-on
const NONE = Math.cos(1.31);  // ~75 degrees: flank or behind

export function armorAgainst(e: Enemy, dx: number, dy: number): number {
  const front = e.type.frontArmor ?? 0;
  if (front <= 0) return e.type.armor;
  // A shot travelling INTO the enemy's face runs opposite to its facing.
  const align = -(e.fx * dx + e.fy * dy);
  const cover = clamp((align - NONE) / (FULL - NONE), 0, 1);
  return Math.min(0.95, e.type.armor + front * cover);
}
