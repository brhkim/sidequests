import type Phaser from 'phaser';
import { SpriteLayer } from './SpriteLayer';

/** What one pop looks like over its life. */
export interface FxShape {
  readonly texture: string;
  /** Diameter in screen px at birth and at death, before `size`. */
  readonly from: number;
  readonly to: number;
  /** Alpha at birth; it falls to zero, eased out. */
  readonly alpha: number;
}

interface Pop {
  x: number; y: number;
  /** Simulated seconds at birth; may be in the future for a staggered burst. */
  born: number;
  life: number;
  color: number;
  size: number;
  shape: FxShape;
  active: boolean;
}

/**
 * A fixed ring of pop records drawn from one `SpriteLayer`: kill rings and
 * flashes, contact puffs, block pings. Like `Shards`, it never allocates
 * after construction - past the budget the oldest pop is overwritten - and
 * everything is timed off the SIMULATED clock handed in, so a replay pops
 * identically. There is no randomness at all.
 */
export class FxPool {
  private readonly ring: Pop[] = [];
  private cursor = 0;
  private readonly layer: SpriteLayer;

  constructor(scene: Phaser.Scene, depth: number, capacity: number, blend: Phaser.BlendModes) {
    this.layer = new SpriteLayer(scene, 'fx-glow', depth, { blend });
    const none: FxShape = { texture: 'fx-glow', from: 0, to: 0, alpha: 0 };
    for (let i = 0; i < capacity; i++) {
      this.ring.push({ x: 0, y: 0, born: 0, life: 1, color: 0xffffff, size: 1, shape: none, active: false });
    }
  }

  pop(shape: FxShape, x: number, y: number, size: number, life: number, color: number, born: number): void {
    const p = this.ring[this.cursor];
    this.cursor = (this.cursor + 1) % this.ring.length;
    p.x = x; p.y = y; p.size = size; p.life = life; p.color = color; p.born = born;
    p.shape = shape; p.active = true;
  }

  render(elapsed: number): void {
    this.layer.begin();
    for (const p of this.ring) {
      if (!p.active) continue;
      const age = elapsed - p.born;
      if (age < 0) continue;
      const t = age / p.life;
      if (t >= 1) { p.active = false; continue; }
      // Out-cubic growth, a fade that holds then drops: a pop, not a smear.
      const ease = 1 - (1 - t) * (1 - t) * (1 - t);
      const s = p.shape;
      const d = (s.from + (s.to - s.from) * ease) * p.size;
      const img = this.layer.claim(s.texture);
      img.setPosition(p.x, p.y).setScale(d / img.width).setAlpha(s.alpha * (1 - t * t)).setTint(p.color);
    }
    this.layer.end();
  }

  reset(): void {
    for (const p of this.ring) p.active = false;
  }
}
