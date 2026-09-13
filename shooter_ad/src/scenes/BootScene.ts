import Phaser from 'phaser';

/**
 * Builds every texture procedurally. There is no artist and no asset pipeline
 * here by design: the whole game ships as code, which is what keeps the build a
 * single static folder with nothing to load at runtime.
 *
 * Note `TextureManager.generate` and the Create palettes were removed in Phaser
 * v4 - `Graphics#generateTexture` is the supported path. Everything is drawn in
 * white and tinted at runtime, so one texture serves every colour variant.
 */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create(): void {
    this.makeCircle('dot', 32);
    this.makeBullet();
    this.makeBody();
    this.makeHead();
    this.makeCage();
    this.scene.start('Game');
    this.scene.launch('UI');
  }

  private makeCircle(key: string, size: number): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1).fillCircle(size / 2, size / 2, size / 2 - 1);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  private makeBullet(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, 6, 14, 3);
    g.generateTexture('bullet', 6, 14);
    g.destroy();
  }

  /** Torso: a rounded capsule, tinted with the unit's rank colour. */
  private makeBody(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, 14, 18, 5);
    g.generateTexture('body', 14, 18);
    g.destroy();
  }

  private makeHead(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1).fillCircle(5, 5, 5);
    g.generateTexture('head', 10, 10);
    g.destroy();
  }

  private makeCage(): void {
    const g = this.add.graphics();
    g.lineStyle(3, 0xffffff, 1);
    g.strokeRect(2, 2, 32, 32);
    g.lineBetween(12, 2, 12, 34);
    g.lineBetween(23, 2, 23, 34);
    g.generateTexture('cage', 36, 36);
    g.destroy();
  }
}
