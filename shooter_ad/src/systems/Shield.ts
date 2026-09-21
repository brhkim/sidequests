import { SHIELD } from '../config';

/**
 * The SHIELD charge pool: `blocksPerLevel x level` charges, refilling at
 * `blocksPerLevel x level` per `windowSeconds`, so a level is "blocks up to
 * two bullets every five seconds" (the author's rule) whether the bullets
 * arrive together or apart. A charge is spent per BULLET, whatever it cost -
 * a Mortar's shell is one block like a Spitter's dart.
 *
 * Owned by the squad and stepped on the fixed simulation clock, so a match
 * code replays which bullets were blocked. Taking a `+SHIELD` gate fills
 * the pool to its new capacity at once: the pick is felt on the next
 * volley, not five seconds later.
 */
export class Shield {
  /** Charges ready, fractional between refills. */
  charges = 0;
  private lastLevel = 0;

  static capacity(level: number): number {
    return SHIELD.blocksPerLevel * Math.max(0, Math.min(SHIELD.maxLevel, Math.floor(level)));
  }

  update(dt: number, level: number): void {
    const cap = Shield.capacity(level);
    if (level !== this.lastLevel) {
      this.lastLevel = level;
      this.charges = cap;
      return;
    }
    if (cap <= 0) { this.charges = 0; return; }
    this.charges = Math.min(cap, this.charges + (cap / SHIELD.windowSeconds) * dt);
  }

  /** Spends one charge if a whole one is ready. */
  tryBlock(): boolean {
    if (this.charges < 1) return false;
    this.charges -= 1;
    return true;
  }

  /** Whole charges ready to block. */
  get ready(): number { return Math.floor(this.charges + 1e-9); }

  reset(): void {
    this.charges = 0;
    this.lastLevel = 0;
  }
}
