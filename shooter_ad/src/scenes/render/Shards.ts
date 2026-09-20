import Phaser from 'phaser';
import { RENDER } from '../../config';
import { SpritePool } from '../../systems/SpritePool';

interface Shard {
  x: number; y: number;
  vx: number; vy: number;
  /** Simulated seconds at birth; position integrates from here, never from a
   * frame delta, so the pop looks the same at any frame rate. */
  born: number;
  life: number;
  color: number;
  angle: number;
  active: boolean;
}

/**
 * Death and impact pops: a few shards flung from where a body died, read off
 * `kill` and `contact` events. A FIXED ring of records and one sprite pool,
 * sized in config (`RENDER.shardRing`); past the budget the oldest shard is
 * overwritten, so a burst of kills never allocates and never grows.
 *
 * Spoke angles come from the simulated clock, not from any generator: the
 * same kill at the same moment pops the same way in every replay, and nothing
 * here can reach the RNG.
 */
export class Shards {
  private readonly ring: Shard[] = [];
  private cursor = 0;
  private readonly pool: SpritePool;

  constructor(scene: Phaser.Scene, depth: number) {
    this.pool = new SpritePool(scene, 'shard', depth);
    for (let i = 0; i < RENDER.shardRing; i++) {
      this.ring.push({
        x: 0, y: 0, vx: 0, vy: 0, born: 0, life: 1, color: 0xffffff, angle: 0, active: false,
      });
    }
  }

  /** `count` shards from (x, y) at `speed` px/s, evenly spoked, phased by `now`. */
  pop(x: number, y: number, count: number, life: number, color: number, speed: number, now: number): void {
    const phase = (now * 7) % (Math.PI * 2);
    for (let k = 0; k < count; k++) {
      const a = phase + (k * Math.PI * 2) / count;
      const s = this.ring[this.cursor];
      this.cursor = (this.cursor + 1) % this.ring.length;
      s.x = x; s.y = y;
      s.vx = Math.cos(a) * speed; s.vy = Math.sin(a) * speed;
      s.born = now; s.life = life; s.color = color; s.angle = a; s.active = true;
    }
  }

  render(elapsed: number): void {
    this.pool.begin();
    for (const s of this.ring) {
      if (!s.active) continue;
      const age = elapsed - s.born;
      const t = age / s.life;
      if (t >= 1 || t < 0) { s.active = false; continue; }
      this.pool.claim()
        .setPosition(s.x + s.vx * age, s.y + s.vy * age)
        .setRotation(s.angle)
        .setScale(1 - 0.75 * t)
        .setAlpha(1 - t)
        .setTint(s.color);
    }
    this.pool.end();
  }

  reset(): void {
    for (const s of this.ring) s.active = false;
  }
}
