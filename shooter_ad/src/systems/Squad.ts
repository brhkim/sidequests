import { ARENA, SQUAD, BUFF, WEAPON } from '../config';
import { TIERS, tierFor } from '../data/tiers';
import type { GateType } from '../data/gates';
import { SLOTS } from './Formation';
import {
  applyGate, freshUpgrades, squadDps, unitShares,
  type Progress, type Upgrades,
} from './Progression';

export interface Unit {
  x: number; y: number;
  /** Formation slot this unit eases toward. */
  slot: number;
  tier: number;
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
  shieldTime = 0;
  frenzyTime = 0;
  slowTime = 0;

  constructor(x: number, y: number, power: number) {
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
        slot, tier: 0, cooldown: Math.random() * 0.4,
      });
    }
    if (this.units.length > count) this.units.length = count;

    for (let i = 0; i < count; i++) {
      this.units[i].slot = i;
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

    this.shieldTime = Math.max(0, this.shieldTime - dt);
    this.frenzyTime = Math.max(0, this.frenzyTime - dt);
    this.slowTime = Math.max(0, this.slowTime - dt);
  }

  damagePerShot(tier: number): number {
    return WEAPON.baseDamage * TIERS[tier].damage * this.progress.upgrades.damageMult;
  }

  shotInterval(tier: number): number {
    const frenzy = this.frenzyTime > 0 ? BUFF.frenzyFireRate : 1;
    const rate = WEAPON.baseFireRate * TIERS[tier].fireRate
      * this.progress.upgrades.fireRateMult * frenzy;
    return 1 / rate;
  }

  /** Applies a gate and returns the floating feedback label. */
  applyGate(gate: GateType): string {
    const label = applyGate(this.progress, gate);
    switch (gate.kind) {
      case 'shield': this.shieldTime = BUFF.shield; break;
      case 'slowmo': this.slowTime = BUFF.slowmo; break;
      case 'frenzy': this.frenzyTime = BUFF.frenzy; break;
      default: this.rebuild(); break;
    }
    return label;
  }
}
