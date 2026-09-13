import { ARENA, SQUAD, WEAPON } from '../config';
import { tierFor, unitStats } from '../data/tiers';
import type { GateType } from '../data/gates';
import { SLOTS } from './Formation';
import {
  applyGate, damageFactor, freshUpgrades, rateFactor, squadDps, unitShares,
  type Progress, type Upgrades,
} from './Progression';

export interface Unit {
  x: number; y: number;
  /** Formation slot this unit eases toward. */
  slot: number;
  /** Visible rank. Stats come from `share`, which moves continuously. */
  tier: number;
  /** Power this unit holds, which is what its damage and rate are read from. */
  share: number;
  /** Seconds until this unit's next shot. */
  cooldown: number;
}

/**
 * The army. `power` decides how many units are visible (capped at three hex
 * rings) and what rank they wear; growing past the cap promotes the ring
 * rather than widening it.
 *
 * The gate maths and the damage model live in Progression, shared with the
 * difficulty model so the two cannot drift apart.
 */
export class Squad {
  x: number;
  readonly y: number;
  readonly progress: Progress;
  units: Unit[] = [];

  constructor(
    x: number, y: number, power: number,
    private readonly rng: () => number = Math.random,
  ) {
    this.x = x;
    this.y = y;
    this.progress = { power, upgrades: freshUpgrades() };
    this.rebuild();
  }

  get power(): number { return this.progress.power; }
  get upgrades(): Upgrades { return this.progress.upgrades; }
  get alive(): boolean { return this.progress.power > 0; }
  get dps(): number { return squadDps(this.progress); }

  /** Tier of the strongest unit, for the HUD. */
  get topTier(): number {
    let best = 0;
    for (const u of this.units) if (u.tier > best) best = u.tier;
    return best;
  }

  addPower(amount: number): void {
    this.progress.power = Math.max(0, Math.min(SQUAD.maxPower, this.progress.power + amount));
    this.rebuild();
  }

  /** Recompute the roster from current power. */
  rebuild(): void {
    const shares = unitShares(this.progress.power);
    const count = shares.length;

    while (this.units.length < count) {
      const slot = this.units.length;
      const s = SLOTS[slot] ?? SLOTS[0];
      this.units.push({
        x: this.x + s.x, y: this.y + s.y,
        slot, tier: 0, share: 1, cooldown: this.rng() * 0.4,
      });
    }
    if (this.units.length > count) this.units.length = count;

    for (let i = 0; i < count; i++) {
      this.units[i].slot = i;
      this.units[i].share = shares[i];
      this.units[i].tier = tierFor(shares[i]);
    }
  }

  update(dt: number, targetX: number): void {
    this.x = Math.max(ARENA.minX, Math.min(ARENA.maxX, targetX));

    const ease = 1 - Math.exp(-SQUAD.followLerp * dt);
    for (const u of this.units) {
      const s = SLOTS[u.slot] ?? SLOTS[0];
      u.x += (this.x + s.x - u.x) * ease;
      u.y += (this.y + s.y - u.y) * ease;
    }
  }

  damagePerShot(share: number): number {
    return WEAPON.baseDamage * unitStats(share).damage * damageFactor(this.progress.upgrades);
  }

  shotInterval(share: number): number {
    const rate = WEAPON.baseFireRate * unitStats(share).fireRate
      * rateFactor(this.progress.upgrades);
    return 1 / rate;
  }

  /** Applies a gate and returns the floating feedback label. */
  applyGate(gate: GateType): string {
    const label = applyGate(this.progress, gate);
    this.rebuild();
    return label;
  }
}
