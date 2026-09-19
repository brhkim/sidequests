import { CONTACT } from '../config';
import type { EnemyType } from '../data/enemies';
import type { Enemy } from './Enemies';
import type { Hittable } from './EnemyBullets';

/**
 * What one body costs the army when it reaches it, by contact or by breach.
 * ONE function for both, for the reason Scoring.ts is one function: two
 * prices drift, and the failure is silent. `power` is the army BEFORE this
 * step's charges, so several bodies arriving together each cost the same -
 * mirror of `applyIncomingFire`.
 */
export function contactCost(type: EnemyType, power: number): number {
  const { share, floor } = CONTACT[type.tier];
  return Math.max(floor, Math.floor(power * share));
}

/**
 * Circle vs circle against every unit. An ENDPOINT test, deliberately not
 * swept: the fastest body moves 3.2 px a step (a Splitter's dash) against a
 * 34 px overlap disc (Runner 9 + unit 8, doubled), and the ring's discs
 * overlap each other (spacing 24 < 34), so nothing can cross the formation
 * between two steps. The sweep in `EnemyBullets` exists for 16 px-per-step
 * bullets through 8 px units. See CLAUDE.md, "Contact damage".
 */
export function touching(e: Enemy, units: readonly Hittable[], unitRadius: number): boolean {
  const r = e.radius + unitRadius;
  const r2 = r * r;
  for (const u of units) {
    const dx = u.x - e.x, dy = u.y - e.y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}
