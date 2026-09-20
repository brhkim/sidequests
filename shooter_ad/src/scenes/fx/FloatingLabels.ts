import Phaser from 'phaser';
import { FONT, hex } from '../hud/types';

export interface FloatOptions {
  size?: number;
  /** Pixels the label climbs over its life. */
  rise?: number;
  /** Milliseconds from spawn to gone, including `hold`. */
  duration?: number;
  /** Milliseconds it sits still at full alpha before rising. */
  hold?: number;
  tracking?: number;
  /** Stroke width; the stroke is always the field's near-black. */
  stroke?: number;
  color?: string;
}

/**
 * A small pool of Texts that rise and fade: `+5 ARMY` over an opened cage,
 * `-3` where a body touched the ring, `MISS` at the lane line. Pooled rather
 * than created per event because a busy step can spawn several, and a Text
 * is the most expensive object here to make. The oldest is reused when the
 * pool is full - a label nobody has read for 700ms was not going to be read.
 *
 * Rendering only: the tweens read the wall clock and nothing reads them back.
 */
export class FloatingLabels {
  private readonly items: Phaser.GameObjects.Text[] = [];
  private next = 0;

  constructor(private readonly scene: Phaser.Scene, size: number, depth: number) {
    for (let i = 0; i < size; i++) {
      this.items.push(scene.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
      }).setOrigin(0.5).setDepth(depth).setVisible(false));
    }
  }

  spawn(x: number, y: number, text: string, color: number, o: FloatOptions = {}): void {
    const t = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    this.scene.tweens.killTweensOf(t);
    const size = o.size ?? 16;
    t.setStyle({ fontSize: `${size}px`, color: o.color ?? hex(color) });
    t.setStroke('#05070f', o.stroke ?? 3);
    t.setLetterSpacing(o.tracking ?? 0);
    t.setText(text).setPosition(x, y).setAlpha(1).setScale(1).setVisible(true);
    const duration = o.duration ?? 700;
    const hold = o.hold ?? 0;
    this.scene.tweens.add({
      targets: t,
      y: y - (o.rise ?? 30), alpha: 0,
      delay: hold, duration: Math.max(1, duration - hold),
      ease: 'Quad.easeOut',
      onComplete: () => t.setVisible(false),
    });
  }

  reset(): void {
    for (const t of this.items) {
      this.scene.tweens.killTweensOf(t);
      t.setVisible(false);
    }
  }
}
