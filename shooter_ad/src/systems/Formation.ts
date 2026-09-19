import { SQUAD } from '../config';

export interface Slot { readonly x: number; readonly y: number; }

/**
 * Hexagonal ring packing around the leader: ring r holds 6r units, so three
 * rings hold 1 + 6 + 12 = 19. Slots are generated once and reused; the ring
 * never grows past `SQUAD.ringCap`, which is what keeps the formation's
 * footprint readable no matter how large the army gets.
 */
function buildSlots(max: number): Slot[] {
  const slots: Slot[] = [{ x: 0, y: 0 }];
  for (let ring = 1; slots.length < max; ring++) {
    const count = 6 * ring;
    const radius = ring * SQUAD.unitSpacing;
    // Offset alternate rings so units nest instead of forming spokes.
    const offset = ring % 2 === 0 ? 0 : Math.PI / count;
    for (let i = 0; i < count && slots.length < max; i++) {
      const angle = offset + (i / count) * Math.PI * 2;
      slots.push({
        x: Math.cos(angle) * radius,
        // Squash vertically: a wide, shallow formation reads better in a
        // portrait lane and keeps more shooters on the front line.
        y: Math.sin(angle) * radius * 0.62,
      });
    }
  }
  return slots;
}

export const SLOTS: readonly Slot[] = buildSlots(SQUAD.ringCap);

/**
 * Half the formation's footprint in x. `GameScene.fire` scales unit positions
 * by it so the whole ring fires inside `WEAPON.columnWidth`.
 */
export const FORMATION_HALF_WIDTH: number =
  SLOTS.reduce((m, s) => Math.max(m, Math.abs(s.x)), 0);

/** Slots sorted front-to-back, so the front rank fires first. */
export const FIRING_ORDER: readonly number[] = SLOTS
  .map((_, i) => i)
  .sort((a, b) => SLOTS[a].y - SLOTS[b].y);
