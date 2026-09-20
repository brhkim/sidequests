import Phaser from 'phaser';
import { makeCage } from './art/cage';
import { makeCreatures } from './art/creatures';
import { makeProjectiles } from './art/projectiles';
import { makeSquad } from './art/squad';

/**
 * Builds every texture procedurally. There is no artist and no asset pipeline
 * here by design: the whole game ships as code, which is what keeps the build a
 * single static folder with nothing to load at runtime.
 *
 * The drawings live in `scenes/art/`, one module per family. Every texture is
 * white with black detail, drawn at 2x and shown at half scale, and tinted at
 * runtime - see `art/draw.ts` for the rule and `art/creatures.ts` for the
 * table the renderer reads. `TextureManager.generate` and the Create palettes
 * were removed in Phaser v4; `Graphics#generateTexture` is the path.
 */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create(): void {
    makeCreatures(this);
    makeSquad(this);
    makeProjectiles(this);
    makeCage(this);
    this.scene.start('Game');
    this.scene.launch('UI');
  }
}
