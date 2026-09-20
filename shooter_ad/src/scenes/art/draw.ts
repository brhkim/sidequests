import Phaser from 'phaser';

/**
 * One procedural texture. Every sprite in the game is drawn WHITE with its
 * details in pure BLACK: under the default multiply tint white takes the
 * runtime colour and black stays black, so eyes, seams and outlines live in
 * the one texture and a single image serves every hue. Anything that needs a
 * SECOND hue (a pale plate, a hot fuse) is a separate overlay texture.
 *
 * Textures are drawn at 2x and rendered at `setScale(0.5)`, which is what
 * keeps a 3px black seam crisp rather than a smeared grey line.
 */
export function texture(
  scene: Phaser.Scene, key: string, width: number, height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}

export const WHITE = 0xffffff;
export const BLACK = 0x000000;

/** Two black eyes; every creature has them. */
export function eyes(g: Phaser.GameObjects.Graphics, x1: number, x2: number, y: number, r: number): void {
  g.fillStyle(BLACK, 1);
  g.fillCircle(x1, y, r);
  g.fillCircle(x2, y, r);
}

/** A black stroked arc, for carapace seams. Angles in fractions of PI. */
export function seam(
  g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  from: number, to: number, width: number,
): void {
  g.lineStyle(width, BLACK, 1);
  g.beginPath();
  g.arc(x, y, r, from * Math.PI, to * Math.PI);
  g.strokePath();
}
