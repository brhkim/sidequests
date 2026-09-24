import Phaser from 'phaser';
import { RENDER } from '../../config';
import { SpriteLayer } from './SpriteLayer';

interface Shard {
  x: number; y: number;
  vx: number; vy: number;
  /** Simulated seconds at birth; position integrates from here, never from a
   * frame delta, so the pop looks the same at any frame rate. */
  born: number;
  life: number;
  color: number;
  angle: number;
  /** Radians per second it tumbles: a shard pointing straight out from a
   * kill ring reads as a gun sight's tick. */
  spin: number;
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
/** A stable pseudo-random value in [0, 1) from an integer: rendering only. */
function hash01(n: number): number {
  let x = (n | 0) * 0x9e3779b1;
  x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

export class Shards {
  private readonly ring: Shard[] = [];
  private cursor = 0;
  private readonly pool: SpriteLayer;

  constructor(scene: Phaser.Scene, depth: number) {
    this.pool = new SpriteLayer(scene, 'shard', depth);
    for (let i = 0; i < RENDER.shardRing; i++) {
      this.ring.push({
        x: 0, y: 0, vx: 0, vy: 0, born: 0, life: 1, color: 0xffffff, angle: 0, spin: 0, active: false,
      });
    }
  }

  /**
   * `count` shards from (x, y) at `speed` px/s, spoked round the circle and
   * phased by `now`. Each spoke is knocked off even by a hash of its ring
   * slot (up to ±0.45 rad), its speed by up to ±20%, and it is thrown
   * tumbling at an angle off the spoke: three evenly spaced shards pointing
   * straight out round a kill ring read as a gun sight. A hash, never the RNG.
   */
  pop(x: number, y: number, count: number, life: number, color: number, speed: number, now: number): void {
    const phase = (now * 7) % (Math.PI * 2);
    for (let k = 0; k < count; k++) {
      const h = hash01(this.cursor);
      const a = phase + (k * Math.PI * 2) / count + (h - 0.5) * 0.9;
      const v = speed * (0.8 + 0.4 * hash01(this.cursor + 977));
      const s = this.ring[this.cursor];
      this.cursor = (this.cursor + 1) % this.ring.length;
      s.x = x; s.y = y;
      s.vx = Math.cos(a) * v; s.vy = Math.sin(a) * v;
      const t = hash01(this.cursor + 1931);
      s.born = now; s.life = life; s.color = color; s.active = true;
      s.angle = a + (t - 0.5) * 2.4;
      s.spin = (t < 0.5 ? -1 : 1) * (10 + 14 * h);
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
        .setRotation(s.angle + s.spin * age)
        .setScale(0.85 * (1 - 0.75 * t))
        .setAlpha(1 - t)
        .setTint(s.color);
    }
    this.pool.end();
  }

  reset(): void {
    for (const s of this.ring) s.active = false;
  }
}
