import Phaser from 'phaser';
import { MOTION } from '../theme';
import { FONT } from './types';

/**
 * A HUD readout that costs nothing while it says the same thing.
 *
 * A Phaser Text re-rasterises its canvas and re-uploads the texture on every
 * `setText` AND every `setColor`, whether or not anything changed - which is
 * what the old rail and strip did eleven times a frame. This wrapper:
 *
 * - renders WHITE once and takes its colour through `setTint`, which is a
 *   vertex attribute, so a colour change (the standing colour, a flash) never
 *   touches the texture;
 * - calls `setText` only when the string differs from the last one;
 * - fits to a width by SCALE, not by re-rendering smaller, so a late-state
 *   `+1.84K%` shrinks to its box instead of running into its neighbour.
 */
export interface HudTextStyle {
  size: number;
  weight: string;
  tracking?: number;
  italic?: boolean;
}

export class HudText {
  readonly text: Phaser.GameObjects.Text;
  private str: string;
  private tintNow = -1;
  /** The scale that fits the current string into `maxWidth`. */
  private fitScale = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number, y: number, style: HudTextStyle,
    originX: number, originY: number,
    private readonly maxWidth = 0,
    initial = '',
    color = 0xffffff,
  ) {
    this.str = initial;
    this.text = scene.add.text(x, y, initial, {
      fontFamily: FONT, fontSize: `${style.size}px`, color: '#ffffff',
      fontStyle: style.italic ? `italic ${style.weight}` : style.weight,
    }).setOrigin(originX, originY);
    if (style.tracking) this.text.setLetterSpacing(style.tracking);
    this.tint(color);
    this.fit();
  }

  /** Set the string; a no-op when it is what is already shown. */
  set(s: string): this {
    if (s === this.str) return this;
    this.str = s;
    this.text.setText(s);
    this.fit();
    return this;
  }

  get value(): string { return this.str; }

  /** Colour, as a tint: never re-rasterises. */
  tint(color: number): this {
    if (color === this.tintNow) return this;
    this.tintNow = color;
    this.text.setTint(color);
    return this;
  }

  /**
   * The beat's value-change punch: up to `MOTION.punchScale`, settling back.
   * A figure already filling its box punches only into `room` px beyond it,
   * so even the overshoot never reaches a neighbour.
   */
  punch(ms: number = MOTION.punch, room = 6): void {
    const t = this.text;
    this.scene.tweens.killTweensOf(t);
    let peak: number = MOTION.punchScale;
    if (this.maxWidth > 0) {
      const drawn = t.width * this.fitScale;
      peak = Math.max(1, Math.min(peak, (this.maxWidth + room) / drawn));
    }
    t.setScale(this.fitScale * peak);
    this.scene.tweens.add({ targets: t, scale: this.fitScale, duration: ms, ease: MOTION.punchEase });
  }

  private fit(): void {
    const w = this.text.width;
    this.fitScale = this.maxWidth > 0 && w > this.maxWidth ? this.maxWidth / w : 1;
    if (!this.scene.tweens.isTweening(this.text)) this.text.setScale(this.fitScale);
  }
}
