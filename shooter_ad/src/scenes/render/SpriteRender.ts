import Phaser from 'phaser';
import { COLORS, ECHO, RENDER, SHIELD, SQUAD } from '../../config';
import { AXIS_COLOR } from '../../data/gates';
import { EnemyBullets } from '../../systems/EnemyBullets';
import { bulletTint, tierRow } from '../../data/tiers';
import { echoColumns, type EchoColumn } from '../../systems/Progression';
import type { Bullets } from '../../systems/Bullets';
import type { Enemies } from '../../systems/Enemies';
import type { Squad } from '../../systems/Squad';
import type { SimEvent } from '../../systems/SimEvents';
import { CREATURE_ART, FALLBACK_ART, TUBE_PIVOT } from '../art/creatures';
import { GLOSS_ORIGIN } from '../art/draw';
import { shieldOrigin } from '../art/fx';
import { FxPool, type FxShape } from './FxPool';
import { Shards } from './Shards';
import { SpriteLayer } from './SpriteLayer';

const SKIN = 0xf2c9a0;
/** Charges per SHIELD level; the ring draws one segment per charge. */
const SHIELD_BLOCKS = SHIELD.blocksPerLevel;
/** A body reaching the army leaves a dull mark, not a celebration. */
const IMPACT = 0x8c5a60;
const WHITE = 0xffffff;
const HALF_PI = Math.PI / 2;
/** A cage's hit flash: its own colours lifted, like a body's. */
const CAGE_SKIN_LIT = bleach(SKIN, 0.5);
const CAGE_LIT = bleach(COLORS.cage, 0.5);
const ADD = Phaser.BlendModes.ADD;
/**
 * Dark things (shadows, the bar backing) draw at MULTIPLY, which for black
 * with alpha looks exactly like NORMAL - and, being a blend switch, starts
 * a fresh batch, so the next NORMAL layer binds the field atlas to texture
 * unit 0 (`art/draw` `packAtlas` says why that matters).
 */
const MULTIPLY = Phaser.BlendModes.MULTIPLY;

/**
 * Depths, bottom to top. The order of the old map is kept; what is new slots
 * between. Additive layers are grouped (the stream with the kill pops, the
 * ECHO ghosts alone) so a frame pays for as few blend switches as possible.
 * The field workstream owns 0-6 (ground, cards), 15 (labels), 25 and 27.
 */
const DEPTH = {
  shadow: 7, aura: 7.5, titan: 8, titanGloss: 8.5, titanAccent: 9, body: 10, gloss: 10.5, accent: 11,
  inmates: 12, stream: 12.5, pops: 12.6, cage: 13, shards: 14, puffs: 14.3,
  ghosts: 17, ghostHeads: 17.1, barBack: 18, bar: 18.1, squadShadow: 18.9,
  shield: 19, soldier: 20, head: 21, trail: 22, enemyFire: 23,
} as const;

/**
 * Under sustained fire every body's stamp is always fresh, so a 0.07s flash
 * held a wave-41 swarm permanently white and its colours - the fastest cue to
 * what a body is - never showed. A body now flashes at most once per this
 * many of its own seconds (0.07 / 0.5: lit under 15% of the time under a
 * stream), and the flash is a LIFT of its own colour (`FLASH_LIFT` of the way
 * to white), never pure white: a flashing Brute is still red. The kill pop
 * stays the brightest thing a body ever does.
 */
const FLASH_REPEAT = 0.5;
const FLASH_LIFT = 0.5;
/**
 * How far a body bleaches toward white at zero HP, as a share of
 * `RENDER.bleach`: enough to see a body is hurt, never enough to wash its
 * hue out (the health bar carries the exact figure on anything big).
 */
const WOUND_BLEACH = 0.55;

/**
 * The pops, as shapes: diameters in multiples of the size handed to `pop`.
 * An ordinary kill's ring is a small, soft pulse gone before its shards:
 * wide (4.4x) and bright (0.95), it lingered in empty lanes like a reticle.
 */
const KILL_RING: FxShape = { texture: 'fx-ring-kill', from: 1.4, to: 2.6, alpha: 0.55 };
const KILL_FLASH: FxShape = { texture: 'fx-glow', from: 3.4, to: 2.2, alpha: 0.9 };
const TITAN_RING: FxShape = { texture: 'fx-ring', from: 1.6, to: 6.5, alpha: 1 };
const TITAN_FLASH: FxShape = { texture: 'fx-glow', from: 3.5, to: 6, alpha: 1 };
const PUFF: FxShape = { texture: 'fx-puff', from: 1.3, to: 2.6, alpha: 0.9 };
const PING: FxShape = { texture: 'fx-ring', from: 1, to: 2.8, alpha: 1 };

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
 * Every pooled sprite on the playfield: contact shadows, enemy bodies and
 * their accents, the Titan's aura, cages, both bullet streams, the squad and
 * its ECHO ghosts, the SHIELD ring, the health bars and the death and impact
 * pops. Nothing in this file may reach back into the simulation: it reads
 * `SpriteWorld`, the events since the last frame, and `elapsed` for phase.
 *
 * Every body is a baked multiply texture (`art/draw` `Finish`) - the colour
 * exactly on the lit back, in shade below - with an untinted gloss above it.
 * Enemies are drawn from the table in `art/creatures.ts`, so there is no
 * per-type branch here. Hit feedback is a flash that lifts the body's own
 * colour (`hitFlash`, stamped by the simulation in its own clock; never pure
 * white, which erased the type under a stream) and a modest bleach toward
 * white by damage taken - never an alpha fade, which made a wounded body
 * vanish.
 */
export class SpriteRender {
  private readonly shadows: SpriteLayer;
  private readonly aura: SpriteLayer;
  private readonly bigPool: SpriteLayer;
  private readonly bigAccentPool: SpriteLayer;
  private readonly glossPool: SpriteLayer;
  private readonly bigGlossPool: SpriteLayer;
  /** Each body texture's gloss key, or null: looked up once, not concatenated per frame. */
  private readonly glossOf = new Map<string, string | null>();
  private readonly enemyPool: SpriteLayer;
  private readonly accentPool: SpriteLayer;
  private readonly cageBackPool: SpriteLayer;
  private readonly cagePool: SpriteLayer;
  private readonly bulletPool: SpriteLayer;
  private readonly squadShadows: SpriteLayer;
  private readonly ghostPool: SpriteLayer;
  private readonly ghostHeadPool: SpriteLayer;
  private readonly bodyPool: SpriteLayer;
  private readonly headPool: SpriteLayer;
  private readonly trailPool: SpriteLayer;
  private readonly enemyBulletPool: SpriteLayer;
  private readonly barBacks: SpriteLayer;
  private readonly bars: SpriteLayer;
  private readonly shieldPool: SpriteLayer;
  private readonly shards: Shards;
  private readonly pops: FxPool;
  private readonly puffs: FxPool;
  /** Simulated second of the last block, for the ring's flash. */
  private lastBlock = -1;
  /** Last rendered simulated time; the birth time of pops raised between frames. */
  private elapsed = 0;
  /** Per enemy slot: the body-clock second its current flash began, and whose. */
  private readonly flashStart: number[] = [];
  private readonly flashSeed: number[] = [];
  /** `echoColumns` for the level held, recomputed only when it changes. */
  private echoLevel = -1;
  private echoes: readonly EchoColumn[] = [];
  /** Shirt colour per rank row, filled on first sight. */
  private readonly shirts: number[] = [];

  constructor(scene: Phaser.Scene) {
    this.shadows = new SpriteLayer(scene, 'fx-shadow', DEPTH.shadow, { blend: MULTIPLY });
    this.aura = new SpriteLayer(scene, 'fx-glow', DEPTH.aura);
    this.bigPool = new SpriteLayer(scene, 'c-titan', DEPTH.titan);
    this.bigAccentPool = new SpriteLayer(scene, 'a-titan', DEPTH.titanAccent);
    this.bigGlossPool = new SpriteLayer(scene, 'c-titan-gloss', DEPTH.titanGloss);
    this.glossPool = new SpriteLayer(scene, 'c-grunt-gloss', DEPTH.gloss);
    for (const art of [...Object.values(CREATURE_ART), FALLBACK_ART]) {
      const key = `${art.body}-gloss`;
      this.glossOf.set(art.body, GLOSS_ORIGIN[key] ? key : null);
    }
    this.enemyPool = new SpriteLayer(scene, 'c-grunt', DEPTH.body);
    this.accentPool = new SpriteLayer(scene, 'a-shielder', DEPTH.accent);
    this.cageBackPool = new SpriteLayer(scene, 'cage-inmates', DEPTH.inmates);
    this.bulletPool = new SpriteLayer(scene, 'bullet-streak', DEPTH.stream, { blend: ADD });
    this.pops = new FxPool(scene, DEPTH.pops, 48, ADD);
    this.cagePool = new SpriteLayer(scene, 'cage', DEPTH.cage);
    this.shards = new Shards(scene, DEPTH.shards);
    this.puffs = new FxPool(scene, DEPTH.puffs, 16, Phaser.BlendModes.NORMAL);
    this.squadShadows = new SpriteLayer(scene, 'fx-shadow', DEPTH.squadShadow, { blend: MULTIPLY });
    this.ghostPool = new SpriteLayer(scene, 'sq-holo-body', DEPTH.ghosts, { blend: ADD });
    this.ghostHeadPool = new SpriteLayer(scene, 'sq-holo-head', DEPTH.ghostHeads, { blend: ADD });
    this.barBacks = new SpriteLayer(scene, 'fx-bar-back', DEPTH.barBack, { blend: MULTIPLY });
    this.bars = new SpriteLayer(scene, 'fx-bar', DEPTH.bar);
    this.shieldPool = new SpriteLayer(scene, 'fx-shield-2', DEPTH.shield);
    this.bodyPool = new SpriteLayer(scene, 'body', DEPTH.soldier);
    this.headPool = new SpriteLayer(scene, 'head', DEPTH.head);
    this.trailPool = new SpriteLayer(scene, 'ebullet', DEPTH.trail);
    this.enemyBulletPool = new SpriteLayer(scene, 'ebullet', DEPTH.enemyFire);
  }

  /** Events since the last frame: kills, contacts and blocks become pops. */
  onEvents(events: readonly SimEvent[]): void {
    const now = this.elapsed;
    for (const ev of events) {
      if (ev.kind === 'kill') {
        if (ev.titan) {
          this.shards.pop(ev.x, ev.y, RENDER.shardsPerTitan, RENDER.shardLife * 1.8, ev.color, 230, now);
          this.pops.pop(TITAN_FLASH, ev.x, ev.y, ev.radius, 0.3, bleach(ev.color, 0.4), now);
          for (let k = 0; k < 3; k++) {
            this.pops.pop(TITAN_RING, ev.x, ev.y, ev.radius, 0.5, k === 1 ? WHITE : ev.color, now + k * 0.09);
          }
        } else {
          this.shards.pop(ev.x, ev.y, RENDER.shardsPerKill, RENDER.shardLife, ev.color, 150, now);
          this.pops.pop(KILL_FLASH, ev.x, ev.y, ev.radius, 0.1, bleach(ev.color, 0.5), now);
          this.pops.pop(KILL_RING, ev.x, ev.y, ev.radius, 0.2, ev.color, now);
        }
      } else if (ev.kind === 'contact' && !ev.titan) {
        this.shards.pop(ev.x, ev.y, RENDER.shardsPerContact, RENDER.contactLife, IMPACT, 70, now);
        this.puffs.pop(PUFF, ev.x, ev.y, 22, 0.32, IMPACT, now);
      } else if (ev.kind === 'block') {
        this.lastBlock = now;
        this.shards.pop(ev.x, ev.y, RENDER.shardsPerContact, RENDER.contactLife, AXIS_COLOR.shield, 90, now);
        this.pops.pop(PING, ev.x, ev.y, ev.shell ? 16 : 12, 0.22, AXIS_COLOR.shield, now);
      }
    }
  }

  /** Forget any per-run animation state. */
  reset(): void {
    this.shards.reset();
    this.pops.reset();
    this.puffs.reset();
    this.elapsed = 0;
    this.lastBlock = -1;
    this.flashStart.length = 0;
    this.flashSeed.length = 0;
  }

  render(w: SpriteWorld): void {
    this.elapsed = w.elapsed;
    this.shadows.begin();
    this.renderEnemies(w);
    this.renderCages(w);
    this.shadows.end();
    this.renderBullets(w);
    this.renderEnemyFire(w);
    this.renderShield(w);
    this.renderSquad(w);
    this.renderBars(w);
    this.shards.render(w.elapsed);
    this.pops.render(w.elapsed);
    this.puffs.render(w.elapsed);
  }

  /** A soft dark ellipse under a body, a little below it: it sits on the road. */
  private shadow(x: number, y: number, r: number, alpha: number): void {
    this.shadows.claim().setPosition(x, y + r * 0.42).setScale((r * 2.5) / 64, (r * 1.25) / 32).setAlpha(alpha);
  }

  /**
   * Whether slot `i`'s body shows its white flash this frame: the first hit
   * always does, and a body under a stream flashes once per `FLASH_REPEAT`.
   * Keyed by slot and checked against the body's own seed and clock, so a
   * recycled slot starts clean. Rendering state only.
   */
  private flashing(i: number, e: Enemies['items'][number]): boolean {
    if (e.hitFlash < 0 || e.timer - e.hitFlash >= RENDER.hitFlash) return false;
    let start = this.flashStart[i];
    if (start === undefined || this.flashSeed[i] !== e.seed || start > e.timer || e.timer - start >= FLASH_REPEAT) {
      start = e.hitFlash;
      this.flashStart[i] = start;
      this.flashSeed[i] = e.seed;
    }
    return e.timer - start < RENDER.hitFlash;
  }

  private renderEnemies(w: SpriteWorld): void {
    this.enemyPool.begin(); this.accentPool.begin();
    this.bigPool.begin(); this.bigAccentPool.begin(); this.aura.begin();
    this.glossPool.begin(); this.bigGlossPool.begin();
    const items = w.enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      const art = CREATURE_ART[e.type.id] ?? FALLBACK_ART;
      const flash = this.flashing(i, e);
      const tint = flash
        ? bleach(e.type.color, FLASH_LIFT)
        : bleach(e.type.color, RENDER.bleach * WOUND_BLEACH * (1 - e.hp / e.maxHp));
      const rot = art.rotate ? Math.atan2(e.fy, e.fx) - HALF_PI : 0;
      const scale = art.pulse === 'swell' ? 0.5 * (1 + 0.05 * Math.sin(w.elapsed * 5 + e.phase)) : 0.5;
      if (art.big) {
        // The boss: a wider, darker shadow and a slow breathing aura in its
        // own colour, so it owns the lane before a single number is read.
        this.shadow(e.x, e.y, e.radius * 1.15, 0.9);
        const breath = 0.5 + 0.5 * Math.sin(w.elapsed * 2.4 + e.phase);
        this.aura.claim().setPosition(e.x, e.y + e.radius * 0.1)
          .setScale((e.radius * (5 + 0.4 * breath)) / 64).setAlpha(0.3 + 0.12 * breath).setTint(e.type.color);
      }
      // Ordinary bodies cast no contact shadow: black at MULTIPLY on the
      // #10111c road measured invisible, and at a wave-41 swarm it was ~60
      // sprites of fill for nothing. The Titan's and the squad's stay.
      (art.big ? this.bigPool : this.enemyPool).claim(art.body)
        .setPosition(e.x, e.y).setRotation(rot).setScale(scale).setTint(tint);
      // The highlight a multiply tint cannot show: white, untinted, pinned to
      // the body's centre so it turns and swells with it. It stays through a
      // flash: the flash lifts the colour, it does not replace the body.
      const gloss = this.glossOf.get(art.body);
      if (gloss) {
        const o = GLOSS_ORIGIN[gloss];
        (art.big ? this.bigGlossPool : this.glossPool).claim(gloss).setOrigin(o.x, o.y)
          .setPosition(e.x, e.y).setRotation(rot).setScale(scale);
      }
      if (!art.accent) continue;
      const a = (art.big ? this.bigAccentPool : this.accentPool).claim(art.accent)
        .setTint(flash ? bleach(e.type.accent, FLASH_LIFT) : e.type.accent);
      if (art.aims) {
        // A gun tube pivoting at its breech, pointed where the shot will go.
        a.setOrigin(0.5, TUBE_PIVOT).setPosition(e.x, e.y + 2).setScale(0.5).setAlpha(1)
          .setRotation(Math.atan2(w.squad.y - e.y, w.squad.x - e.x) - HALF_PI);
      } else {
        a.setOrigin(0.5, 0.5).setPosition(e.x, e.y).setRotation(rot).setScale(scale)
          .setAlpha(art.pulse === 'fuse' ? 0.5 + 0.5 * Math.sin(w.elapsed * 18 + e.phase) : 1);
      }
    }
    this.enemyPool.end(); this.accentPool.end();
    this.bigPool.end(); this.bigAccentPool.end(); this.aura.end();
    this.glossPool.end(); this.bigGlossPool.end();
  }

  private renderCages(w: SpriteWorld): void {
    this.cageBackPool.begin(); this.cagePool.begin();
    for (const c of w.enemies.cages) {
      if (!c.active) continue;
      const flash = c.hitFlash >= 0 && w.elapsed - c.hitFlash < RENDER.hitFlash;
      this.shadow(c.x, c.y + 2, 18, 0.8);
      this.cageBackPool.claim().setPosition(c.x, c.y).setScale(0.5).setTint(flash ? CAGE_SKIN_LIT : SKIN);
      this.cagePool.claim().setPosition(c.x, c.y).setScale(0.5).setTint(flash ? CAGE_LIT : COLORS.cage);
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
      this.bulletPool.claim().setPosition(b.x, b.y).setScale(0.5).setTint(bulletTint(b.density));
    }
    this.bulletPool.end();
  }

  /**
   * Darts along their velocity, with a faint copy a few pixels behind; a
   * Mortar's shell is the round `eshell` in scarlet, with the same trail.
   * Both carry a baked halo of their own colour at normal blend, above the
   * squad they hit.
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
   * The SHIELD: a segmented energy ring around the leader, one baked arc per
   * charge the pool can hold, rotated into place. A ready charge is lit, the
   * one refilling brightens as it fills, the rest are dim; the whole ring
   * flashes white for two hit-flashes after a block. Reads the squad's pool
   * and `elapsed`; nothing here is written back.
   */
  private renderShield(w: SpriteWorld): void {
    this.shieldPool.begin();
    const level = w.squad.upgrades.shield;
    const capacity = level * SHIELD_BLOCKS;
    if (level > 0 && shieldOrigin[capacity]) {
      const key = `fx-shield-${capacity}`;
      const origin = shieldOrigin[capacity];
      const charges = w.squad.shield.charges;
      const ready = w.squad.shield.ready;
      const flash = this.lastBlock >= 0 && w.elapsed - this.lastBlock < RENDER.hitFlash * 2;
      const lead = w.squad.units[0];
      const cx = lead ? lead.x : w.squad.x;
      const cy = lead ? lead.y : w.squad.y;
      const span = (Math.PI * 2) / capacity;
      for (let i = 0; i < capacity; i++) {
        const alpha = i < ready ? 1 : i === ready ? 0.2 + 0.35 * (charges - ready) : 0.2;
        this.shieldPool.claim(key).setOrigin(origin.x, origin.y).setPosition(cx, cy)
          .setRotation((i + 0.5) * span).setAlpha(flash ? 1 : alpha)
          .setTint(flash ? WHITE : AXIS_COLOR.shield);
      }
    }
    this.shieldPool.end();
  }

  private shirt(tier: number): number {
    let c = this.shirts[tier];
    if (c === undefined) { c = tierRow(tier).shirt; this.shirts[tier] = c; }
    return c;
  }

  private renderSquad(w: SpriteWorld): void {
    this.bodyPool.begin(); this.headPool.begin(); this.squadShadows.begin();
    this.ghostPool.begin(); this.ghostHeadPool.begin();
    for (const u of w.squad.units) {
      // Slot 0 is the centre of the formation and the unit that actually
      // selects a gate: drawn larger, and the only head with a visor.
      const lead = u.slot === 0;
      const scale = (lead ? SQUAD.leaderScale : 1) * 0.5;
      this.squadShadows.claim().setPosition(u.x, u.y + 22 * scale)
        .setScale((30 * scale) / 64, (13 * scale) / 32).setAlpha(0.8);
      this.bodyPool.claim().setPosition(u.x, u.y + (lead ? 3 : 2)).setScale(scale).setTint(this.shirt(u.tier));
      this.headPool.claim(lead ? 'head-lead' : 'head')
        .setPosition(u.x, u.y - 20 * scale).setScale(scale).setTint(SKIN);
    }
    // The echoes: the same ring `ECHO.offset` to either side in the army's
    // own shirts - a half echo at half size around its own leader, a full one
    // at full size (the author's rule, 1.5). Drawn as holograms: scanlined,
    // additive, at `echoAlpha` with a faint flicker off the simulated clock,
    // and no shadow - a ghost is light on the road, not a body standing on
    // it. A ghost driven past the edge is simply drawn there (Phaser culls
    // it), which is what its bullets do too.
    const level = w.squad.upgrades.echo;
    if (level !== this.echoLevel) { this.echoLevel = level; this.echoes = echoColumns(level); }
    const leader = w.squad.units[0];
    for (const e of this.echoes) {
      const cx = leader.x + e.side * ECHO.offset;
      const alpha = RENDER.echoAlpha * (0.86 + 0.14 * Math.sin(w.elapsed * 11 + e.side * 2));
      for (const u of w.squad.units) {
        const lead = u.slot === 0;
        const scale = (lead ? SQUAD.leaderScale : 1) * 0.5 * e.strength;
        const ux = cx + (u.x - leader.x) * e.strength;
        const uy = leader.y + (u.y - leader.y) * e.strength;
        this.ghostPool.claim().setPosition(ux, uy + (lead ? 3 : 2) * e.strength).setScale(scale)
          .setTint(this.shirt(u.tier)).setAlpha(alpha);
        this.ghostHeadPool.claim(lead ? 'sq-holo-head-lead' : 'sq-holo-head')
          .setPosition(ux, uy - 20 * scale).setScale(scale).setTint(SKIN).setAlpha(alpha);
      }
    }
    this.bodyPool.end(); this.headPool.end(); this.squadShadows.end();
    this.ghostPool.end(); this.ghostHeadPool.end();
  }

  /** Health bars for anything big enough to be worth aiming at: rounded, on a dark backing. */
  private renderBars(w: SpriteWorld): void {
    this.barBacks.begin(); this.bars.begin();
    for (const e of w.enemies.items) {
      if (!e.active || e.radius < 14 || e.hp >= e.maxHp) continue;
      const width = e.radius * 2;
      const y = e.y - e.radius - 7;
      this.barBacks.claim().setPosition(e.x, y).setScale((width + 3) / 70, 0.5);
      this.bars.claim().setOrigin(0, 0.5).setPosition(e.x - width / 2, y)
        .setScale((width * Math.max(0, e.hp / e.maxHp)) / 64, 0.5).setTint(0xff5566);
    }
    this.barBacks.end(); this.bars.end();
  }
}
