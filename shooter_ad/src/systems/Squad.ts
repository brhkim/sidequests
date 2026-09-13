import { ARENA, SQUAD, BUFF, WEAPON } from '../config';
import { TIERS, tierFor } from '../data/tiers';
import type { GateType } from '../data/gates';
import { SLOTS } from './Formation';

export interface Unit {
  x: number; y: number;
  /** Formation slot this unit eases toward. */
  slot: number;
  tier: number;
  /** Seconds until this unit's next shot. */
  cooldown: number;
}

export interface Upgrades {
  damageMult: number;
  fireRateMult: number;
  guns: number;
  pierce: number;
}

/**
 * The army. `power` is the single source of truth for size *and* strength: it
 * decides how many units are visible (capped) and what tier they wear. Growing
 * past the cap promotes the ring rather than widening it.
 */
export class Squad {
  x: number;
  readonly y: number;
  power: number;
  units: Unit[] = [];
  upgrades: Upgrades = { damageMult: 1, fireRateMult: 1, guns: 1, pierce: 0 };
  shieldTime = 0;
  frenzyTime = 0;
  /** Set by the scene; Gates and Enemies read it to slow the world. */
  slowTime = 0;

  constructor(x: number, y: number, power: number) {
    this.x = x;
    this.y = y;
    this.power = power;
    this.rebuild();
  }

  get alive(): boolean { return this.power > 0; }

  /** How many bodies are actually drawn. */
  get visibleCount(): number {
    return Math.max(1, Math.min(Math.floor(this.power), SQUAD.ringCap));
  }

  /** Tier of the strongest unit, for the HUD. */
  get topTier(): number {
    let best = 0;
    for (const u of this.units) if (u.tier > best) best = u.tier;
    return best;
  }

  addPower(amount: number): void {
    this.power = Math.max(0, Math.min(99999, this.power + amount));
    this.rebuild();
  }

  /**
   * Recompute the roster. Power is dealt out evenly across the capped ring;
   * the remainder goes to the innermost units first, so the leader visibly
   * ranks up before the outer ring catches up.
   */
  rebuild(): void {
    const count = this.visibleCount;
    const total = Math.floor(this.power);
    const base = Math.floor(total / count);
    const extra = total % count;

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
      const share = base + (i < extra ? 1 : 0);
      this.units[i].slot = i;
      this.units[i].tier = tierFor(share);
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
    return WEAPON.baseDamage * TIERS[tier].damage * this.upgrades.damageMult;
  }

  shotInterval(tier: number): number {
    const frenzy = this.frenzyTime > 0 ? BUFF.frenzyFireRate : 1;
    const rate = WEAPON.baseFireRate * TIERS[tier].fireRate
      * this.upgrades.fireRateMult * frenzy;
    return 1 / rate;
  }

  /** Applies a gate. Returns a short string for the floating feedback text. */
  applyGate(gate: GateType): string {
    switch (gate.kind) {
      case 'add': this.addPower(gate.value); return `+${gate.value}`;
      case 'sub': this.addPower(-gate.value); return `-${gate.value}`;
      case 'mul':
        this.addPower(Math.floor(this.power) * (gate.value - 1));
        return `x${gate.value}`;
      case 'div':
        this.power = Math.max(1, Math.floor(this.power / gate.value));
        this.rebuild();
        return `/${gate.value}`;
      case 'firerate':
        this.upgrades.fireRateMult += gate.value; return 'FIRE RATE UP';
      case 'damage':
        this.upgrades.damageMult += gate.value; return 'DAMAGE UP';
      case 'multishot':
        this.upgrades.guns += gate.value; return `${this.upgrades.guns} GUNS`;
      case 'pierce':
        this.upgrades.pierce += gate.value; return 'PIERCING';
      case 'shield':
        this.shieldTime = BUFF.shield; return 'SHIELD';
      case 'slowmo':
        this.slowTime = BUFF.slowmo; return 'SLOW MOTION';
      case 'frenzy':
        this.frenzyTime = BUFF.frenzy; return 'FRENZY';
    }
  }
}
