import Phaser from 'phaser';

/**
 * Lazily grown pool of images at one depth. Sprites are created on demand and
 * hidden rather than destroyed, so a busy wave never allocates in the middle
 * of the frame.
 *
 * A pool has a default texture; `claim(key)` swaps a sprite to another when
 * the pool serves several kinds at one depth (every enemy body shares one),
 * and only touches the texture when the key actually differs.
 */
export class SpritePool {
  private readonly items: Phaser.GameObjects.Image[] = [];
  private used = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly texture: string,
    private readonly depth: number,
  ) {}

  /** Call once per frame before claiming sprites. */
  begin(): void { this.used = 0; }

  claim(texture: string = this.texture): Phaser.GameObjects.Image {
    let sprite = this.items[this.used];
    if (!sprite) {
      sprite = this.scene.add.image(0, 0, texture).setDepth(this.depth);
      this.items.push(sprite);
    } else if (sprite.texture.key !== texture) {
      sprite.setTexture(texture);
    }
    sprite.setVisible(true);
    this.used++;
    return sprite;
  }

  /** Hides every sprite not claimed this frame. */
  end(): void {
    for (let i = this.used; i < this.items.length; i++) {
      this.items[i].setVisible(false);
    }
  }
}
