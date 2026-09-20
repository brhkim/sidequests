import type { EnemyTier } from '../config';
import type { BonusAxis } from '../data/gates';

/**
 * What the simulation DID this step, for whatever draws or sounds it. One
 * stream, so sprites, HUD feedback and audio all read the same account of the
 * same step rather than each inferring its own from the state.
 *
 * Positions are where the thing happened; `share` on a charge is the cost as
 * a fraction of the power held BEFORE it, so a reader can size a reaction to
 * how much of the army went. `kill` carries the type's radius and colour for
 * the death pop.
 */
export type SimEvent =
  | { kind: 'kill'; x: number; y: number; radius: number; color: number; titan: boolean }
  | { kind: 'contact'; x: number; y: number; cost: number; share: number; tier: EnemyTier; titan: boolean }
  | { kind: 'breach'; x: number; y: number; cost: number; share: number; tier: EnemyTier; titan: boolean }
  | { kind: 'fire'; cost: number; share: number; hits: number }
  | { kind: 'pick'; x: number; y: number; width: number; axis: BonusAxis; label: string; grade: 'perfect' | 'good' | 'bad' }
  | { kind: 'miss'; x: number; y: number; pair: number }
  | { kind: 'rescue'; x: number; y: number; amount: number }
  | { kind: 'streak'; x: number; y: number; amount: number }
  | { kind: 'wave'; index: number; bonus: number; titan: boolean }
  | { kind: 'titan'; phase: 'arrive' | 'volley' | 'down' }
  | { kind: 'sense'; pair: number }
  | { kind: 'over'; cause: 'overrun' | 'titan' };

/**
 * Written only by `GameScene.step`, drained only by `GameScene.render`, so a
 * frame that runs several steps sees every event of every step in order and
 * a frame that runs none sees nothing. Rendering-facing only: nothing in
 * `systems/` reads it, which is what keeps it off the determinism surface -
 * a consumer that fed anything back into the simulation would be a balance
 * change wearing a feedback change's clothes.
 */
export class EventQueue {
  private items: SimEvent[] = [];
  private spare: SimEvent[] = [];

  push(e: SimEvent): void {
    this.items.push(e);
  }

  /**
   * Returns everything pushed since the last drain and clears the queue. The
   * two arrays are swapped rather than reallocated, so the returned slice is
   * valid until the NEXT drain and the steady state allocates nothing.
   */
  drain(): SimEvent[] {
    const out = this.items;
    this.spare.length = 0;
    this.items = this.spare;
    this.spare = out;
    return out;
  }
}
