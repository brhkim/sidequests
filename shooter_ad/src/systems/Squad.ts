import { ARENA, SQUAD, WEAPON } from '../config';
import { tierFor, unitStats } from '../data/tiers';
import type { GateType } from '../data/gates';
import { SLOTS } from './Formation';
import { Shield } from './Shield';
import {
  applyGate, damageFactor, freshUpgrades, moveSpeed, rateFactor,
  shotsPerSecond, squadDps, unitShares, type Progress, type Upgrades,
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
  /** The `+SHIELD` charge pool; stepped here, spent by `GameScene`. */
  readonly shield = new Shield();

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
  /**
   * Deliberately the same quantity par is measured in, because this feeds
   * `standing` and the difficulty budget, and a ratio of two different
   * quantities is the mistake that once produced standings above 20. It is also
   * what the HUD shows. It is honest because the simulation bundles shots past
   * `WEAPON.maxSimShotsPerSecond` rather than dropping them - see
   * `bundleFactor`; when the pool used to refuse them this had to read a
   * separate `deliverableDps`, and the HUD was claiming damage nobody could do.
   */
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

  /**
   * Travel toward `targetX` at the squad's own speed rather than snapping to
   * it.
   *
   * Under a pointer this used to assign the finger's x directly, so the squad
   * teleported and crossing the lane was free. That quietly deleted the whole
   * movement economy: `x MOVE` could buy nothing, reaching the gate you judged
   * best was never in doubt, and the only thing costing time was the keyboard
   * path almost nobody plays on. Movement is a constraint now, which is what
   * makes an offer you cannot get to a real loss.
   */
  update(dt: number, targetX: number): void {
    const want = Math.max(ARENA.minX, Math.min(ARENA.maxX, targetX));
    const step = moveSpeed(this.progress.upgrades) * dt;
    const delta = want - this.x;
    this.x += Math.abs(delta) <= step ? delta : Math.sign(delta) * step;

    this.shield.update(dt, this.progress.upgrades.shield);

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

  /**
   * Shots the build WANTS to fire per second, guns included.
   *
   * Delegated rather than recomputed here: `Progression` is the single
   * definition of squad strength, the difficulty budget reads the same figure
   * through `deliverableDps`, and a second copy would drift.
   *
   * `GameScene.fire` reads it for both collapses: the simulation's, which
   * decides how many shots ride in each spawned bullet, and the renderer's,
   * which decides how many spawned bullets are drawn.
   */
  shotsPerSecond(): number {
    return shotsPerSecond(this.progress);
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
