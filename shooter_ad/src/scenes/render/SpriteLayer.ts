import Phaser from 'phaser';
import { ATLAS } from '../art/draw';

export interface LayerStyle {
  /** `Phaser.BlendModes`; ADD for the stream, the ghosts and the pops. */
  readonly blend?: Phaser.BlendModes;
}

/**
 * A lazily grown pool of images at one depth, like `systems/SpritePool`, but
 * drawn from frames of the field atlas (`art/draw` `packAtlas` says why one
 * texture) and with its blend mode fixed when each image is made - so a frame
 * never pays for it, and every image at one depth shares a blend mode, which
 * is what keeps the batch unbroken. Tint stays MULTIPLY (`art/draw` `Finish`
 * says why). Sprites are hidden rather than destroyed, so a busy wave never
 * allocates mid-frame.
 */
export class SpriteLayer {
  private readonly items: Phaser.GameObjects.Image[] = [];
  private used = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly frame: string,
    private readonly depth: number,
    private readonly style: LayerStyle = {},
  ) {}

  /** Call once per frame before claiming sprites. */
  begin(): void { this.used = 0; }

  /** The next sprite, showing atlas frame `frame` (a texture's name at boot). */
  claim(frame: string = this.frame): Phaser.GameObjects.Image {
    let sprite = this.items[this.used];
    if (!sprite) {
      sprite = this.scene.add.image(0, 0, ATLAS, frame).setDepth(this.depth);
      if (this.style.blend !== undefined) sprite.setBlendMode(this.style.blend);
      this.items.push(sprite);
    } else if (sprite.frame.name !== frame) {
      sprite.setFrame(frame);
    }
    sprite.setVisible(true);
    this.used++;
    return sprite;
  }

  /** Hides every sprite not claimed this frame. */
  end(): void {
    for (let i = this.used; i < this.items.length; i++) {
      const s = this.items[i];
      if (s.visible) s.setVisible(false);
    }
  }
}
