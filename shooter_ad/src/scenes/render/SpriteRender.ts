import Phaser from 'phaser';
import { COLORS, RENDER, SHIELD, SQUAD } from '../../config';
import { AXIS_COLOR } from '../../data/gates';
import { EnemyBullets } from '../../systems/EnemyBullets';
import { bulletTint, tierRow } from '../../data/tiers';
import type { Bullets } from '../../systems/Bullets';
import type { Enemies } from '../../systems/Enemies';
import type { Squad } from '../../systems/Squad';
import { SpritePool } from '../../systems/SpritePool';
import type { SimEvent } from '../../systems/SimEvents';
import { CREATURE_ART, FALLBACK_ART } from '../art/creatures';
import { Shards } from './Shards';

const SKIN = 0xf2c9a0;
/** Charges per SHIELD level; the ring draws one segment per charge. */
const SHIELD_BLOCKS = SHIELD.blocksPerLevel;
/** A body reaching the army leaves a dull mark, not a celebration. */
const IMPACT = 0x8c5a60;
const WHITE = 0xffffff;
const HALF_PI = Math.PI / 2;

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

/** `color` moved `f` of the way to white. Integer maths, no allocation. */
function bleach(color: number, f: number): number {
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  return ((r + (255 - r) * f) << 16) | ((g + (255 - g) * f) << 8) | (b + (255 - b) * f);
}

/**
 * Every pooled sprite on the playfield: enemy bodies and their accents, cages,
 * both bullet streams, the squad, the death pops and the per-enemy health
 * bars. Nothing in this file may reach back into the simulation: it reads
 * `SpriteWorld`, the events since the last frame, and `elapsed` for phase.
 *
 * Enemies are drawn from the table in `art/creatures.ts`, so there is no
 * per-type branch here. Hit feedback is a white flash (`hitFlash`, stamped by
 * the simulation in its own clock) and a bleach toward white by damage taken
 * - never an alpha fade, which made a wounded body vanish.
 */
export class SpriteRender {
  private readonly bigPool: SpritePool;
  private readonly bigAccentPool: SpritePool;
  private readonly enemyPool: SpritePool;
  private readonly accentPool: SpritePool;
  private readonly cageBackPool: SpritePool;
  private readonly cagePool: SpritePool;
  private readonly bulletPool: SpritePool;
  private readonly bodyPool: SpritePool;
  private readonly headPool: SpritePool;
  private readonly trailPool: SpritePool;
  private readonly enemyBulletPool: SpritePool;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly shards: Shards;
  /** The SHIELD ring around the leader; depth 19, under the squad, over bullets. */
  private readonly shieldRing: Phaser.GameObjects.Graphics;
  /** Simulated second of the last block, for the ring's flash. */
  private lastBlock = -1;
  /** Last rendered simulated time; the birth time of pops raised between frames. */
  private elapsed = 0;

  constructor(scene: Phaser.Scene) {
    this.bigPool = new SpritePool(scene, 'c-titan', 8);
    this.bigAccentPool = new SpritePool(scene, 'a-titan', 9);
    this.enemyPool = new SpritePool(scene, 'c-grunt', 10);
    this.accentPool = new SpritePool(scene, 'a-shielder', 11);
    this.cageBackPool = new SpritePool(scene, 'cage-inmates', 12);
    this.bulletPool = new SpritePool(scene, 'bullet', 12);
    this.cagePool = new SpritePool(scene, 'cage', 13);
    this.shards = new Shards(scene, 14);
    this.overlay = scene.add.graphics().setDepth(18);
    this.shieldRing = scene.add.graphics().setDepth(19);
    this.bodyPool = new SpritePool(scene, 'body', 20);
    this.headPool = new SpritePool(scene, 'head', 21);
    this.trailPool = new SpritePool(scene, 'ebullet', 22);
    this.enemyBulletPool = new SpritePool(scene, 'ebullet', 23);
  }

  /** Events since the last frame: kills and contacts become pops. */
  onEvents(events: readonly SimEvent[]): void {
    for (const ev of events) {
      if (ev.kind === 'kill') {
        const n = ev.titan ? RENDER.shardsPerTitan : RENDER.shardsPerKill;
        this.shards.pop(ev.x, ev.y, n, RENDER.shardLife, ev.color, 150, this.elapsed);
      } else if (ev.kind === 'contact' && !ev.titan) {
        this.shards.pop(ev.x, ev.y, RENDER.shardsPerContact, RENDER.contactLife, IMPACT, 70, this.elapsed);
      } else if (ev.kind === 'block') {
        this.lastBlock = this.elapsed;
        this.shards.pop(ev.x, ev.y, RENDER.shardsPerContact, RENDER.contactLife, AXIS_COLOR.shield, 90, this.elapsed);
      }
    }
  }

  /** Forget any per-run animation state. */
  reset(): void {
    this.shards.reset();
    this.elapsed = 0;
    this.lastBlock = -1;
    this.shieldRing.clear();
  }

  render(w: SpriteWorld): void {
    this.elapsed = w.elapsed;
    this.renderEnemies(w);
    this.renderCages(w);
    this.renderBullets(w);
    this.renderEnemyFire(w);
    this.renderShield(w);
    this.renderSquad(w);
    this.renderOverlay(w);
    this.shards.render(w.elapsed);
  }

  private renderEnemies(w: SpriteWorld): void {
    this.enemyPool.begin(); this.accentPool.begin();
    this.bigPool.begin(); this.bigAccentPool.begin();
    for (const e of w.enemies.items) {
      if (!e.active) continue;
      const art = CREATURE_ART[e.type.id] ?? FALLBACK_ART;
      const flash = e.hitFlash >= 0 && e.timer - e.hitFlash < RENDER.hitFlash;
      const tint = flash ? WHITE : bleach(e.type.color, RENDER.bleach * (1 - e.hp / e.maxHp));
      const rot = art.rotate ? Math.atan2(e.fy, e.fx) - HALF_PI : 0;
      const scale = art.pulse === 'swell' ? 0.5 * (1 + 0.05 * Math.sin(w.elapsed * 5 + e.phase)) : 0.5;
      (art.big ? this.bigPool : this.enemyPool).claim(art.body)
        .setPosition(e.x, e.y).setRotation(rot).setScale(scale).setTint(tint);
      if (!art.accent) continue;
      const a = (art.big ? this.bigAccentPool : this.accentPool).claim(art.accent)
        .setTint(flash ? WHITE : e.type.accent);
      if (art.aims) {
        // A gun tube pivoting at its breech, pointed where the shot will go.
        a.setOrigin(0.5, 0.1).setPosition(e.x, e.y + 2).setScale(0.5).setAlpha(1)
          .setRotation(Math.atan2(w.squad.y - e.y, w.squad.x - e.x) - HALF_PI);
      } else {
        a.setOrigin(0.5, 0.5).setPosition(e.x, e.y).setRotation(rot).setScale(scale)
          .setAlpha(art.pulse === 'fuse' ? 0.5 + 0.5 * Math.sin(w.elapsed * 18 + e.phase) : 1);
      }
    }
    this.enemyPool.end(); this.accentPool.end();
    this.bigPool.end(); this.bigAccentPool.end();
  }

  private renderCages(w: SpriteWorld): void {
    this.cageBackPool.begin(); this.cagePool.begin();
    for (const c of w.enemies.cages) {
      if (!c.active) continue;
      const flash = c.hitFlash >= 0 && w.elapsed - c.hitFlash < RENDER.hitFlash;
      this.cageBackPool.claim().setPosition(c.x, c.y).setScale(0.5).setTint(SKIN).setAlpha(0.45);
      this.cagePool.claim().setPosition(c.x, c.y).setScale(0.5).setTint(flash ? WHITE : COLORS.cage);
    }
    this.cageBackPool.end(); this.cagePool.end();
  }

  /**
   * Draws the bounded subset `fire` marked, tinted by how much of the stream
   * each one stands for. The simulation is untouched here: every bullet in
   * `items` is still flying and still colliding, drawn or not.
   */
  private renderBullets(w: SpriteWorld): void {
    this.bulletPool.begin();
    for (const b of w.bullets.items) {
      if (!b.active || !b.drawn) continue;
      this.bulletPool.claim().setPosition(b.x, b.y).setTint(bulletTint(b.density));
    }
    this.bulletPool.end();
  }

  /**
   * Darts along their velocity, with a faint copy a few pixels behind; a
   * Mortar's shell is the round `eshell` in scarlet, with the same trail.
   */
  private renderEnemyFire(w: SpriteWorld): void {
    this.enemyBulletPool.begin(); this.trailPool.begin();
    for (const b of w.enemyFire.items) {
      if (!b.active) continue;
      const rot = Math.atan2(b.vy, b.vx) - HALF_PI;
      const key = b.shell ? 'eshell' : 'ebullet';
      const tint = b.shell ? COLORS.enemyShell : COLORS.enemyBullet;
      this.enemyBulletPool.claim(key).setPosition(b.x, b.y).setRotation(rot)
        .setScale(0.5).setTint(tint);
      if (!RENDER.bulletTrail) continue;
      this.trailPool.claim(key).setPosition(b.x - b.vx * 0.035, b.y - b.vy * 0.035)
        .setRotation(rot).setScale(0.35).setAlpha(0.45).setTint(tint);
    }
    this.enemyBulletPool.end(); this.trailPool.end();
  }

  /**
   * The SHIELD: an arc ring around the formation, one segment per charge
   * the pool can hold, lit where a charge is ready and dim where it is
   * refilling. It flashes white for `RENDER.hitFlash` after a block. Reads
   * the squad's pool and `elapsed`; nothing here is written back.
   */
  private renderShield(w: SpriteWorld): void {
    const g = this.shieldRing;
    g.clear();
    const level = w.squad.upgrades.shield;
    if (level <= 0) return;
    const capacity = level * SHIELD_BLOCKS;
    const ready = w.squad.shield.ready;
    const flash = this.lastBlock >= 0 && w.elapsed - this.lastBlock < RENDER.hitFlash * 2;
    const color = flash ? WHITE : AXIS_COLOR.shield;
    const lead = w.squad.units[0];
    const cx = lead ? lead.x : w.squad.x;
    const cy = lead ? lead.y : w.squad.y;
    const radius = SQUAD.unitSpacing * 2.6;
    const gap = 0.12;
    const span = (Math.PI * 2) / capacity;
    for (let i = 0; i < capacity; i++) {
      const lit = i < ready;
      g.lineStyle(lit ? 4 : 2, color, lit ? 0.9 : 0.3);
      const a0 = -Math.PI / 2 + i * span + gap / 2;
      g.beginPath();
      g.arc(cx, cy, radius, a0, a0 + span - gap);
      g.strokePath();
    }
  }

  private renderSquad(w: SpriteWorld): void {
    this.bodyPool.begin(); this.headPool.begin();
    for (const u of w.squad.units) {
      const tier = tierRow(u.tier);
      // Slot 0 is the centre of the formation and the unit that actually
      // selects a gate: drawn larger, and the only head with a visor.
      const lead = u.slot === 0;
      const scale = (lead ? SQUAD.leaderScale : 1) * 0.5;
      this.bodyPool.claim().setPosition(u.x, u.y + (lead ? 3 : 2)).setScale(scale).setTint(tier.shirt);
      this.headPool.claim(lead ? 'head-lead' : 'head')
        .setPosition(u.x, u.y - 20 * scale).setScale(scale).setTint(SKIN);
    }
    this.bodyPool.end(); this.headPool.end();
  }

  /** Health bars for anything big enough to be worth aiming at. */
  private renderOverlay(w: SpriteWorld): void {
    this.overlay.clear();
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
