import { ARMY_DAMAGE, CONTACT, ENEMY_FIRE } from '../config';
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
export function contactCost(type: EnemyType, power: number, peak: number = power): number {
  const { share, floor } = CONTACT[type.tier];
  return Math.max(floor, Math.floor(damageBase(power, peak) * share));
}

/**
 * What a charge is a share OF: the army held, but never less than
 * `ARMY_DAMAGE.mercy` of the run's peak (1.6). Every price on the army -
 * contact, breach, a landing bullet - reads its share off this, so a hit
 * costs what it cost at the army's strongest until the army has fallen to
 * half of that, and holds there. Before 1.6 the base was the army held and
 * each hit made the next one cheaper. See the `ARMY_DAMAGE` comment.
 */
export function damageBase(power: number, peak: number): number {
  return Math.max(power, Math.max(peak, power) * ARMY_DAMAGE.mercy);
}

/** What one landing enemy bullet costs at `damage` 1, against the same base. */
export function bulletCost(power: number, peak: number = power): number {
  return Math.max(ENEMY_FIRE.minCost, Math.floor(damageBase(power, peak) * ENEMY_FIRE.powerShare));
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
