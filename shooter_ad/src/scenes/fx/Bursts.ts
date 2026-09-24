import Phaser from 'phaser';
import { GATES } from '../../config';
import { HW, NOTE } from '../art/cards';

const POOL = 4;
const SPARKS = 48;
const SPARKS_PER_BURST = 10;
/** Milliseconds of scene clock a spark lives. */
const SPARK_LIFE = 420;
const RING_LIFE = 440;
const FLASH_LIFE = 300;

interface Spark {
  x: number; y: number;
  /** Unit direction and the distance it travels over its life. */
  dx: number; dy: number; reach: number;
  born: number;
  color: number;
  active: boolean;
}

/** A small integer hash (xorshift-multiply), for spark variety without any RNG. */
function hash(n: number): number {
  let h = (n | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * The judgment burst: when a note is taken it flashes in its own footprint,
 * throws a ring and a spray of sparks in the grade colour. All additive, all
 * at one depth (26) so it is one batch, from fixed pools - four flashes, four
 * rings and a ring buffer of 48 sparks that overwrites its oldest.
 *
 * Timing is the SCENE clock (`scene.time.now`), like the tweens beside it,
 * and the sparks advance on the scene's `update` event rather than inside the
 * field's render, so a burst finishes cleanly over the end-of-run beat when
 * the simulation has stopped drawing. Spark directions come from a hash of a
 * running counter: no `Math.random()`, nothing near the simulation's RNG.
 */
export class Bursts {
  private readonly flashes: Phaser.GameObjects.NineSlice[] = [];
  private readonly rings: Phaser.GameObjects.Image[] = [];
  private readonly sparks: Spark[] = [];
  private readonly sprites: Phaser.GameObjects.Image[] = [];
  private next = 0;
  private cursor = 0;
  private count = 0;
  private live = 0;

  constructor(private readonly scene: Phaser.Scene, depth: number) {
    for (let i = 0; i < POOL; i++) {
      this.flashes.push(scene.add.nineslice(0, 0, HW.noteFill, undefined, 100, GATES.height, NOTE.slice, NOTE.slice, 0, 0)
        .setDepth(depth).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
      this.rings.push(scene.add.image(0, 0, HW.ring)
        .setDepth(depth).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    }
    for (let i = 0; i < SPARKS; i++) {
      this.sparks.push({ x: 0, y: 0, dx: 0, dy: 0, reach: 0, born: 0, color: 0xffffff, active: false });
      this.sprites.push(scene.add.image(0, 0, HW.spark)
        .setDepth(depth).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    }
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this));
  }

  /** A note of `width` (the gate's, gap included) taken at (x, y), in `color`. */
  burst(x: number, y: number, width: number, color: number): void {
    const i = this.next;
    this.next = (this.next + 1) % POOL;
    const flash = this.flashes[i];
    const ring = this.rings[i];
    this.scene.tweens.killTweensOf([flash, ring]);
    const w = width - GATES.gap;
    if (flash.width !== w) flash.setSize(w, GATES.height);
    flash.setPosition(x, y).setTint(color).setAlpha(0.7).setScale(1).setVisible(true);
    this.scene.tweens.add({
      targets: flash, alpha: 0, scaleX: 1 + 28 / w, scaleY: 1.22,
      duration: FLASH_LIFE, ease: 'Cubic.easeOut',
      onComplete: () => flash.setVisible(false),
    });
    ring.setPosition(x, y).setTint(color).setAlpha(1).setScale(0.3).setVisible(true);
    this.scene.tweens.add({
      targets: ring, scale: Math.max(1.1, w / 90), alpha: 0,
      duration: RING_LIFE, ease: 'Cubic.easeOut',
      onComplete: () => ring.setVisible(false),
    });

    const now = this.scene.time.now;
    this.count++;
    const phase = hash(this.count) * Math.PI * 2;
    for (let k = 0; k < SPARKS_PER_BURST; k++) {
      const s = this.sparks[this.cursor];
      this.cursor = (this.cursor + 1) % SPARKS;
      const a = phase + (k * Math.PI * 2) / SPARKS_PER_BURST + (hash(this.count * 31 + k) - 0.5) * 0.5;
      // Wider than tall, like the note they came from; a little lift.
      s.dx = Math.cos(a);
      s.dy = Math.sin(a) * 0.75 - 0.25;
      s.reach = 60 + 70 * hash(this.count * 57 + k);
      s.x = x + s.dx * w * 0.3;
      s.y = y + s.dy * 20;
      s.born = now; s.color = color; s.active = true;
    }
    this.live = SPARKS;
  }

  private tick(): void {
    if (this.live === 0) return;
    const now = this.scene.time.now;
    let alive = 0;
    for (let i = 0; i < SPARKS; i++) {
      const s = this.sparks[i];
      const sprite = this.sprites[i];
      if (!s.active) { if (sprite.visible) sprite.setVisible(false); continue; }
      const u = (now - s.born) / SPARK_LIFE;
      if (u >= 1 || u < 0) { s.active = false; sprite.setVisible(false); continue; }
      alive++;
      // Decelerating travel: all of `reach` by the end, most of it early.
      const d = s.reach * (1 - (1 - u) * (1 - u));
      sprite.setVisible(true)
        .setPosition(s.x + s.dx * d, s.y + s.dy * d)
        .setRotation(Math.atan2(s.dy, s.dx))
        .setScale(1.2 - 0.7 * u, 1)
        .setTint(s.color)
        .setAlpha(1 - u * u);
    }
    if (alive === 0) this.live = 0;
  }

  reset(): void {
    for (let i = 0; i < POOL; i++) {
      this.scene.tweens.killTweensOf([this.flashes[i], this.rings[i]]);
      this.flashes[i].setVisible(false);
      this.rings[i].setVisible(false);
    }
    for (let i = 0; i < SPARKS; i++) {
      this.sparks[i].active = false;
      this.sprites[i].setVisible(false);
    }
    this.live = 0;
  }
}
