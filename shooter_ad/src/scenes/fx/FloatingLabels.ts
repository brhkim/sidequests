import Phaser from 'phaser';
import { FONT, hex } from '../hud/types';
import { MOTION } from '../theme';

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
  /** Slanted, like a grade word: for the words that are judgments (MISS). */
  italic?: boolean;
}

/** The scale a label snaps in from, before its overshoot settles it at 1. */
const SNAP_FROM = 0.55;

/**
 * A small pool of Texts that snap in and rise away: `+5 ARMY` over an opened
 * cage, `-3` where a body touched the ring, `MISS` at the lane line, `BLOCK`
 * over an absorbed bullet. Pooled rather than created per event because a
 * busy step can spawn several, and a Text is the most expensive object here
 * to make. The oldest is reused when the pool is full - a label nobody has
 * read for 700ms was not going to be read.
 *
 * Motion grammar: the entrance snaps (`MOTION.snap`, Back.out overshoot), the
 * label holds, then lifts and fades with no overshoot. Saira 800, upright for
 * figures, slanted for a judgment.
 *
 * Rendering only: the tweens read the scene clock and nothing reads them back.
 */
export class FloatingLabels {
  private readonly items: Phaser.GameObjects.Text[] = [];
  private next = 0;

  constructor(private readonly scene: Phaser.Scene, size: number, depth: number) {
    for (let i = 0; i < size; i++) {
      this.items.push(scene.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: '18px', fontStyle: '800', color: '#ffffff',
        shadow: { offsetX: 0, offsetY: 2, color: 'rgba(0,0,0,0.55)', blur: 3, stroke: true, fill: true },
      }).setOrigin(0.5).setDepth(depth).setVisible(false));
    }
  }

  spawn(x: number, y: number, text: string, color: number, o: FloatOptions = {}): void {
    const t = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    this.scene.tweens.killTweensOf(t);
    const size = o.size ?? 16;
    t.setStyle({
      fontSize: `${size}px`, fontStyle: o.italic ? 'italic 800' : '800', color: o.color ?? hex(color),
    });
    t.setStroke('#07070d', o.stroke ?? 4);
    t.setLetterSpacing(o.tracking ?? 0);
    t.setText(text).setPosition(x, y).setAlpha(1).setScale(SNAP_FROM).setVisible(true);
    const duration = o.duration ?? 700;
    const hold = o.hold ?? 0;
    this.scene.tweens.add({ targets: t, scale: 1, duration: MOTION.snap, ease: MOTION.snapEase });
    this.scene.tweens.add({
      targets: t,
      y: y - (o.rise ?? 30), alpha: 0,
      delay: MOTION.snap + hold, duration: Math.max(1, duration - hold - MOTION.snap),
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
