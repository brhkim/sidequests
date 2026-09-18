import { WEAPON, VIEW } from '../config';

export interface Bullet {
  x: number; y: number;
  vx: number; vy: number;
  /** Damage of ONE of the shots this bullet stands for, before armour. */
  damage: number;
  /**
   * The bundle. `bundle[p]` is how many of the shots this bullet stands for
   * still have `p` pierce left; a bullet that stands for itself is `[0, .., 1]`
   * with the 1 at its pierce level. See `strike` for how a body consumes it.
   */
  bundle: number[];
  /** Shots still in the bundle. Zero means spent. */
  shots: number;
  active: boolean;
  /**
   * Whether the renderer draws this bullet. PRESENTATION ONLY - an undrawn
   * bullet moves, collides and does damage exactly like a drawn one. Decided
   * once at spawn rather than per frame so a bullet does not flicker in and out
   * on its way up the screen.
   */
  drawn: boolean;
  /**
   * How many real shots a drawn bullet stands for, at the moment it was fired:
   * the sim bundle times the render stride. 1 means it stands for itself. Read
   * only by the tint; see `bulletTint`.
   */
  density: number;
}

/**
 * Fixed-size pool. Allocation during play is the usual source of frame spikes,
 * and a spike is what causes tunnelling in the collision step, so the pool is
 * load-bearing rather than premature.
 *
 * Its size is DERIVED from `WEAPON.maxSimShotsPerSecond`: the simulation never
 * spawns faster than that, so the pool is sized to hold a full flight's worth
 * of bullets at the cap plus headroom, and `refused` should stay at zero. It
 * used to be the other way round - a 900-bullet pool that happened to recycle
 * at ~988 bullets a second was the game's real throughput ceiling, and nothing
 * in the design had chosen that number.
 */
export class Bullets {
  readonly items: Bullet[] = [];
  private cursor = 0;
  /**
   * Diagnostics, written by `spawn` and read by nothing in the simulation.
   * `spawned` counts bullets, `shotsSpawned` counts the shots they carry, and
   * `refused` counts spawns the pool could not place - which now indicates a
   * pool sized wrong rather than a ceiling doing its job. `npm run hud` prints
   * all three.
   */
  spawned = 0;
  shotsSpawned = 0;
  refused = 0;

  constructor() {
    for (let i = 0; i < WEAPON.maxBullets; i++) {
      this.items.push({
        x: 0, y: 0, vx: 0, vy: 0, damage: 0, bundle: [], shots: 0, active: false,
        drawn: true, density: 1,
      });
    }
  }

  /**
   * `shots` is how many real shots this bullet stands for, all at `pierce`.
   * `drawn` and `density` are rendering hints and nothing else. They are
   * arguments rather than a post-spawn mutation so that a caller cannot forget
   * them and silently leave a bullet carrying the previous occupant's tint.
   */
  spawn(
    x: number, y: number, vx: number, vy: number, damage: number, pierce: number,
    shots = 1, drawn = true, density = 1,
  ): void {
    // Scan forward for a free slot; give up rather than overwrite live bullets.
    for (let i = 0; i < this.items.length; i++) {
      const b = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % this.items.length;
      if (!b.active) {
        b.x = x; b.y = y; b.vx = vx; b.vy = vy;
        b.damage = damage; b.active = true;
        // Reused rather than reallocated: the pool exists to keep play free of
        // allocation, and pierce is a small number.
        b.bundle.length = pierce + 1;
        b.bundle.fill(0);
        b.bundle[pierce] = shots;
        b.shots = shots;
        b.drawn = drawn; b.density = density;
        this.spawned++;
        this.shotsSpawned += shots;
        return;
      }
    }
    this.refused++;
  }

  update(dt: number): void {
    for (const b of this.items) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -20 || b.y > VIEW.height + 20 || b.x < -20 || b.x > VIEW.width + 20) {
        b.active = false;
      }
    }
  }
}

/**
 * A bundle meets a body with `hp` left, where each shot it stands for would
 * land `perShot` damage (armour already applied). Returns how many shots the
 * body consumed; the caller deals `consumed x damage` and applies armour itself.
 *
 * This is the thin-shot model resolved at one instant. The shots this bullet
 * stands for hit one at a time; each hit spends one pierce, and the body dies
 * after `ceil(hp / perShot)` of them, so the rest pass untouched and carry on
 * with their pierce intact. Exactly as many shots as would have hit are
 * charged, exactly as many pierces as would have been spent are spent, and
 * damage past the kill is wasted only within the last shot - which is what a
 * real stream of thin bullets wastes too.
 *
 * Consumption starts from the LOWEST pierce level, because those are the shots
 * that have already hit the most bodies - the leading edge of the stream - and
 * the leading edge is what meets the next body first. A consumed shot with
 * pierce left drops one level (`through`); one at level 0 is spent. Cages stop
 * every shot that hits them whatever its pierce, so they call with `through`
 * false.
 *
 * A bullet standing for one shot reduces to the old rule exactly: one hit, one
 * pierce spent or the bullet gone. That is the property that keeps the whole
 * regime below `WEAPON.maxSimShotsPerSecond` behaving as it always has.
 */
export function strike(b: Bullet, hp: number, perShot: number, through: boolean): number {
  // The 1e-9 keeps a body whose hp is an exact multiple of the shot from
  // charging one extra shot to float noise. A fully armoured body takes every
  // shot and is hurt by none, which is what a stream of thin shots would do.
  let need = perShot > 0 ? Math.max(1, Math.ceil(hp / perShot - 1e-9)) : Infinity;
  let consumed = 0;
  for (let p = 0; p < b.bundle.length && need > 0; p++) {
    const take = Math.min(b.bundle[p], need);
    if (take <= 0) continue;
    b.bundle[p] -= take;
    need -= take;
    consumed += take;
    if (through && p > 0) b.bundle[p - 1] += take;
  }
  let left = 0;
  for (const n of b.bundle) left += n;
  b.shots = left;
  if (left <= 0) b.active = false;
  return consumed;
}
