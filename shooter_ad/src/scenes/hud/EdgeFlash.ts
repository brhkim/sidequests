import Phaser from 'phaser';
import { RENDER, VIEW } from '../../config';

const THICK = 28;

/**
 * Damage taken, shown at the edges of the screen where the eye is not: four
 * bands that flash and fade. In the UI scene, so they do not shake with the
 * camera - the shake says "hit", this says how hard, by how much of the army
 * went (`share` on the event sizes the peak).
 */
export class EdgeFlash {
  private readonly bands: Phaser.GameObjects.Rectangle[];

  constructor(private readonly scene: Phaser.Scene) {
    const w = VIEW.width, h = VIEW.height;
    this.bands = [
      scene.add.rectangle(w / 2, THICK / 2, w, THICK, 0xffffff, 1),
      scene.add.rectangle(w / 2, h - THICK / 2, w, THICK, 0xffffff, 1),
      scene.add.rectangle(THICK / 2, h / 2, THICK, h, 0xffffff, 1),
      scene.add.rectangle(w - THICK / 2, h / 2, THICK, h, 0xffffff, 1),
    ];
    for (const b of this.bands) b.setDepth(45).setAlpha(0).setVisible(false);
  }

  /** `peak` is the starting alpha; the flash fades to nothing over `fade` ms. */
  flash(color: number, peak: number, fade: number = RENDER.moments.edgeFade): void {
    this.scene.tweens.killTweensOf(this.bands);
    for (const b of this.bands) b.setFillStyle(color, 1).setAlpha(peak).setVisible(true);
    this.scene.tweens.add({
      targets: this.bands, alpha: 0, duration: fade, ease: 'Quad.easeOut',
      onComplete: () => { for (const b of this.bands) b.setVisible(false); },
    });
  }

  reset(): void {
    this.scene.tweens.killTweensOf(this.bands);
    for (const b of this.bands) b.setAlpha(0).setVisible(false);
  }
}
