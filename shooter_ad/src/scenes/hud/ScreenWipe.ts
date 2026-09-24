import Phaser from 'phaser';
import { VIEW } from '../../config';
import { LIGHT, MOTION, SURFACE } from '../theme';

const LANES = 3;
const LANE_W = VIEW.width / LANES;
const BEDS = [SURFACE.lane, SURFACE.laneCentre, SURFACE.lane] as const;

/**
 * The screens' ground and their entrance: three lane beds, the highway's own
 * floor, that drop in lane by lane (the contract's "screens wipe in lane by
 * lane", `MOTION.wipe` each, `MOTION.wipeStagger` apart), each led by a
 * white-hot edge, and then the screen's content snaps in over them.
 *
 * The beds live in their own Container half a depth under the screen's
 * content Container, so the content can fade as one (a single alpha on its
 * container) while the lanes scale - and so every Text stays a DIRECT child
 * of a top-level container, which is where the probes read the screens.
 * Opaque: the paused field and the ended run never bleed through a screen
 * built to be read and screenshotted.
 *
 * Cost: four tweens per entrance on the scene clock, and nothing at all
 * while the screen is up or hidden.
 */
export class ScreenBackdrop {
  readonly back: Phaser.GameObjects.Container;
  private readonly beds: Phaser.GameObjects.Rectangle[] = [];
  private readonly edges: Phaser.GameObjects.Rectangle[] = [];
  private content: Phaser.GameObjects.Container | null = null;

  constructor(private readonly scene: Phaser.Scene, depth: number) {
    const parts: Phaser.GameObjects.GameObject[] = [];
    for (let i = 0; i < LANES; i++) {
      const bed = scene.add.rectangle(i * LANE_W, 0, LANE_W, VIEW.height, BEDS[i], 1).setOrigin(0, 0);
      this.beds.push(bed);
      parts.push(bed);
    }
    for (let i = 0; i < LANES; i++) {
      const edge = scene.add.rectangle(i * LANE_W, 0, LANE_W, 3, LIGHT.judgment, 1)
        .setOrigin(0, 1).setVisible(false);
      this.edges.push(edge);
      parts.push(edge);
    }
    this.back = scene.add.container(0, 0, parts).setDepth(depth - 0.5).setVisible(false);
  }

  setDepth(depth: number): this {
    this.back.setDepth(depth - 0.5);
    return this;
  }

  /**
   * The wipe: lane beds fall from the top edge, left lane first, then the
   * content fades up over the last of them. `onLanded` runs when the
   * content is fully in (the end screen starts its count-up there).
   */
  enter(content: Phaser.GameObjects.Container, onLanded?: () => void): void {
    this.stop();
    this.content = content;
    this.back.setVisible(true);
    content.setAlpha(0).setVisible(true);
    for (let i = 0; i < LANES; i++) {
      const bed = this.beds[i], edge = this.edges[i];
      bed.setScale(1, 0);
      edge.setVisible(true).setAlpha(1).setY(0);
      this.scene.tweens.add({
        targets: bed, scaleY: 1, duration: MOTION.wipe, delay: i * MOTION.wipeStagger,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          edge.y = bed.scaleY * VIEW.height;
          edge.alpha = 1 - bed.scaleY * bed.scaleY;
        },
        onComplete: () => edge.setVisible(false),
      });
    }
    const contentAt = MOTION.wipe * 0.5 + MOTION.wipeStagger * (LANES - 1);
    this.scene.tweens.add({
      targets: content, alpha: 1, duration: MOTION.snap, delay: contentAt, ease: 'Quad.easeOut',
      onComplete: () => onLanded?.(),
    });
  }

  /** Shown at once, no wipe (a page change inside a screen that is already up). */
  cut(content: Phaser.GameObjects.Container): void {
    this.stop();
    this.content = content;
    this.back.setVisible(true);
    for (const bed of this.beds) bed.setScale(1, 1);
    for (const edge of this.edges) edge.setVisible(false);
    content.setAlpha(1).setVisible(true);
  }

  hide(content: Phaser.GameObjects.Container): void {
    this.stop();
    this.content = null;
    this.back.setVisible(false);
    content.setVisible(false).setAlpha(1);
  }

  private stop(): void {
    this.scene.tweens.killTweensOf(this.beds);
    if (this.content) this.scene.tweens.killTweensOf(this.content);
  }
}
