import Phaser from 'phaser';
import { RENDER, VIEW } from '../../config';
import { EDGE_DEPTH } from './HudLayout';

const DEPTH = 45;
/** The vignette's reach at the smallest and the largest hit, in px. */
const REACH = { min: 56, max: EDGE_DEPTH * 1.25 } as const;

/**
 * Damage taken, shown at the edges of the screen where the eye is not: a soft
 * vignette that blooms in from all four edges and fades. In the UI scene, so
 * it does not shake with the camera - the shake says "hit", this says how
 * hard: `share` on the event sizes the peak, and the peak sets both how
 * strong the vignette is and how far in it reaches.
 *
 * One baked falloff (`hud-edge-v` / `hud-edge-h`, `art/ui`) stretched along
 * each edge, tinted breach red, fire orange or loss red. Four thin images
 * rather than one full-screen one, so the middle of the field - where nothing
 * is drawn - costs no fill.
 */
export class EdgeFlash {
  private readonly edges: Phaser.GameObjects.Image[];

  constructor(private readonly scene: Phaser.Scene) {
    const w = VIEW.width, h = VIEW.height;
    this.edges = [
      scene.add.image(0, 0, 'hud-edge-v').setOrigin(0, 0),
      scene.add.image(0, h, 'hud-edge-v').setOrigin(0, 1).setFlipY(true),
      scene.add.image(0, 0, 'hud-edge-h').setOrigin(0, 0),
      scene.add.image(w, 0, 'hud-edge-h').setOrigin(1, 0).setFlipX(true),
    ];
    for (const e of this.edges) e.setDepth(DEPTH).setAlpha(0).setVisible(false);
  }

  /** `peak` (0 to 1) is how hard; the flash fades to nothing over `fade` ms. */
  flash(color: number, peak: number, fade: number = RENDER.moments.edgeFade): void {
    this.scene.tweens.killTweensOf(this.edges);
    const reach = REACH.min + (REACH.max - REACH.min) * Phaser.Math.Clamp(peak, 0, 1);
    const [top, bottom, left, right] = this.edges;
    top.setDisplaySize(VIEW.width, reach);
    bottom.setDisplaySize(VIEW.width, reach);
    left.setDisplaySize(reach, VIEW.height);
    right.setDisplaySize(reach, VIEW.height);
    const alpha = Math.min(0.9, 0.45 + 0.55 * peak);
    for (const e of this.edges) e.setTint(color).setAlpha(alpha).setVisible(true);
    this.scene.tweens.add({
      targets: this.edges, alpha: 0, duration: fade, ease: 'Quad.easeOut',
      onComplete: () => { for (const e of this.edges) e.setVisible(false); },
    });
  }

  reset(): void {
    this.scene.tweens.killTweensOf(this.edges);
    for (const e of this.edges) e.setAlpha(0).setVisible(false);
  }
}
