import Phaser from 'phaser';
import { CAGE, COLORS, ENEMY_FIRE, SQUAD } from '../../config';
import { bulletTint, tierRow } from '../../data/tiers';
import type { Bullets } from '../../systems/Bullets';
import type { Enemies } from '../../systems/Enemies';
import type { EnemyBullets } from '../../systems/EnemyBullets';
import type { Squad } from '../../systems/Squad';
import { SpritePool } from '../../systems/SpritePool';
import type { SimEvent } from '../../systems/SimEvents';

const SKIN = 0xf2c9a0;

/** What the sprite layer reads, once per frame. All of it is simulation state
 * it may look at and never write. */
export interface SpriteWorld {
  readonly enemies: Enemies;
  readonly bullets: Bullets;
  readonly enemyFire: EnemyBullets;
  readonly squad: Squad;
  /** Simulated seconds, for animation phase. Never the wall clock. */
  readonly elapsed: number;
}

/**
 * Every pooled sprite on the playfield: enemy bodies, cages, both bullet
 * streams and the squad, plus the per-enemy overlay (shield facing, health
 * bars). Split out of GameScene so the art can change without the scene
 * growing, and so a change here is rendering by construction - nothing in
 * this file may reach back into the simulation.
 *
 * `onEvents` receives what the simulation did since the last frame (see
 * `systems/SimEvents.ts`), for hit flashes and death pops.
 */
export class SpriteRender {
  private readonly bodyPool: SpritePool;
  private readonly headPool: SpritePool;
  private readonly enemyPool: SpritePool;
  private readonly bulletPool: SpritePool;
  private readonly enemyBulletPool: SpritePool;
  private readonly cagePool: SpritePool;
  private readonly overlay: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.overlay = scene.add.graphics().setDepth(6);
    this.enemyPool = new SpritePool(scene, 'dot', 10);
    this.cagePool = new SpritePool(scene, 'cage', 11);
    this.bulletPool = new SpritePool(scene, 'bullet', 12);
    this.enemyBulletPool = new SpritePool(scene, 'dot', 13);
    this.bodyPool = new SpritePool(scene, 'body', 20);
    this.headPool = new SpritePool(scene, 'head', 21);
  }

  /** Events since the last frame. Nothing here yet; the hook is the contract. */
  onEvents(_events: readonly SimEvent[]): void {}

  /** Forget any per-run animation state. */
  reset(): void {}

  render(w: SpriteWorld): void {
    this.renderEnemies(w);
    this.renderBullets(w);
    this.renderEnemyFire(w);
    this.renderSquad(w);
    this.renderOverlay(w);
  }

  private renderEnemies(w: SpriteWorld): void {
    this.enemyPool.begin();
    this.cagePool.begin();
    for (const e of w.enemies.items) {
      if (!e.active) continue;
      const s = this.enemyPool.claim();
      s.setPosition(e.x, e.y)
        .setDisplaySize(e.radius * 2, e.radius * 2)
        .setTint(e.type.color)
        .setAlpha(0.55 + 0.45 * (e.hp / e.maxHp));
    }
    for (const c of w.enemies.cages) {
      if (!c.active) continue;
      this.cagePool.claim()
        .setPosition(c.x, c.y)
        .setDisplaySize(CAGE.radius * 2, CAGE.radius * 2)
        .setTint(COLORS.cage);
    }
    this.enemyPool.end();
    this.cagePool.end();
  }

  /**
   * Draws the bounded subset `fire` marked, tinted by how much of the stream
   * each one stands for.
   *
   * The simulation is untouched here: every bullet in `items` is still flying
   * and still colliding, drawn or not. Skipping the undrawn ones is the whole
   * mechanism - at high GUNS and RATE the true stream is thousands of shots a
   * second and the playfield went solid cream.
   */
  private renderBullets(w: SpriteWorld): void {
    this.bulletPool.begin();
    for (const b of w.bullets.items) {
      if (!b.active || !b.drawn) continue;
      this.bulletPool.claim().setPosition(b.x, b.y).setTint(bulletTint(b.density));
    }
    this.bulletPool.end();
  }

  private renderEnemyFire(w: SpriteWorld): void {
    this.enemyBulletPool.begin();
    for (const b of w.enemyFire.items) {
      if (!b.active) continue;
      this.enemyBulletPool.claim()
        .setPosition(b.x, b.y)
        .setDisplaySize(ENEMY_FIRE.radius * 2, ENEMY_FIRE.radius * 2)
        .setTint(COLORS.enemyBullet);
    }
    this.enemyBulletPool.end();
  }

  private renderSquad(w: SpriteWorld): void {
    this.bodyPool.begin();
    this.headPool.begin();
    for (const u of w.squad.units) {
      const tier = tierRow(u.tier);
      // Slot 0 is the centre of the formation and the unit that actually
      // selects a gate. Drawing it larger is the only cue that says so.
      const lead = u.slot === 0;
      const scale = lead ? SQUAD.leaderScale : 1;
      this.bodyPool.claim()
        .setPosition(u.x, u.y + (lead ? 3 : 2))
        .setScale(scale)
        .setTint(tier.shirt);
      this.headPool.claim()
        .setPosition(u.x, u.y - 10 * scale)
        .setScale(scale)
        .setTint(SKIN);
    }
    this.bodyPool.end();
    this.headPool.end();
  }

  private renderOverlay(w: SpriteWorld): void {
    this.overlay.clear();
    // Shield facing. A directional shield the player cannot see is just an
    // unexplained damage number, so draw where it actually points.
    for (const e of w.enemies.items) {
      if (!e.active || !e.type.frontArmor) continue;
      const nx = -e.fy, ny = e.fx;
      const r = e.radius + 3;
      this.overlay.lineStyle(3, COLORS.shield, 0.85);
      this.overlay.lineBetween(
        e.x + e.fx * r - nx * e.radius, e.y + e.fy * r - ny * e.radius,
        e.x + e.fx * r + nx * e.radius, e.y + e.fy * r + ny * e.radius,
      );
    }
    // Health bars for anything big enough to be worth aiming at.
    for (const e of w.enemies.items) {
      if (!e.active || e.radius < 14 || e.hp >= e.maxHp) continue;
      const width = e.radius * 2;
      this.overlay.fillStyle(0x000000, 0.5);
      this.overlay.fillRect(e.x - width / 2, e.y - e.radius - 9, width, 4);
      this.overlay.fillStyle(0xff5566, 0.95);
      this.overlay.fillRect(e.x - width / 2, e.y - e.radius - 9, width * (e.hp / e.maxHp), 4);
    }
  }
}
