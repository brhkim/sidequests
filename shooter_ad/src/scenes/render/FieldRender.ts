import Phaser from 'phaser';
import { ARENA, CAGE, COLORS, GATES, RENDER, VIEW } from '../../config';
import type { Enemies } from '../../systems/Enemies';
import type { EnemyBullets } from '../../systems/EnemyBullets';
import type { Gates } from '../../systems/Gates';
import type { Squad } from '../../systems/Squad';
import { cageReward } from '../../systems/Progression';
import type { SimEvent } from '../../systems/SimEvents';
import { FieldFx } from '../fx/FieldFx';
import { FONT, hex } from '../hud/types';
import { compact } from '../../format';
import { RAIL_HEIGHT } from '../hud/TopRail';
import { GateCards, type GateTarget } from './GateCards';

/** What the field layer reads, once per frame. Simulation state it may look at
 * and never write. `marked` is the set of `pair:index` keys wearing the SENSE
 * mark this frame, computed by the scene from the shared scoring. */
export interface FieldWorld {
  readonly gates: Gates;
  readonly enemies: Enemies;
  readonly squad: Squad;
  readonly marked: ReadonlySet<string>;
  /** Simulated seconds, for the SENSE pulse. Never the wall clock. */
  readonly elapsed: number;
  /** Only read when `RENDER.landingDashes` is on; the scene need not pass it. */
  readonly enemyFire?: EnemyBullets;
}

/** Ground band: where contact happens, drawn as a floor rather than a strip. */
/** Where the ground band begins: a full ring's front rank, 60px above the lane. */
const GROUND_TOP = ARENA.laneY - 60;
/** A body below this line is about to breach; its tick brightens as it nears. */
const TICK_FROM = 772;

/**
 * The playfield's furniture: the ground and breach horizon, the descending
 * gate cards with their SENSE mark, the selection guide, the cage health bars
 * with what each cage is worth, and - through `FieldFx` - the feedback that
 * happens at a place on the field. Everything here is rendering; nothing may
 * reach back into the simulation.
 */
export class FieldRender {
  private readonly cards: GateCards;
  private readonly fx: FieldFx;
  /** Breach ticks, landing dashes and cage bars. Below the bodies (10). */
  private readonly overlay: Phaser.GameObjects.Graphics;
  /**
   * The selection guide, on its own layer ABOVE the squad and every
   * projectile. On the shared overlay it sat under the bullet stream and was
   * unreadable exactly when it mattered - mid-wave, with an offer closing.
   */
  private readonly selection: Phaser.GameObjects.Graphics;
  private readonly rewards: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.drawBackground();
    this.overlay = scene.add.graphics().setDepth(6);
    this.selection = scene.add.graphics().setDepth(25);
    this.cards = new GateCards(scene);
    this.fx = new FieldFx(scene);
  }

  /** Events since the last frame, for the field-space feedback. */
  onEvents(events: readonly SimEvent[]): void { this.fx.onEvents(events); }

  /** Forget any per-run animation state. */
  reset(): void { this.fx.reset(); }

  render(w: FieldWorld): void {
    const target = this.findTarget(w);
    this.cards.render(w.gates.items, w.marked, target, w.elapsed);
    this.renderOverlay(w);
    // Last, and on the topmost gameplay layer: the guide has to survive a
    // screen full of bullets.
    this.renderSelection(w, target);
  }

  /**
   * The ground is a band, not a line: from where a full ring's front rank
   * sits (contact) down to the breach horizon. The horizon itself glows
   * faintly upward so a body approaching it is seen against something.
   */
  private drawBackground(): void {
    const g = this.scene.add.graphics().setDepth(0);
    g.fillStyle(COLORS.bg, 1).fillRect(0, 0, VIEW.width, VIEW.height);
    g.fillStyle(COLORS.lane, 1).fillRect(0, ARENA.laneY - 120, VIEW.width, 260);
    const ground = this.scene.add.graphics().setDepth(1);
    ground.fillStyle(0x171d2e, 1).fillRect(0, GROUND_TOP, VIEW.width, ARENA.breachY - GROUND_TOP);
    // Below the line, where the bonus strip used to sit: a darker step of
    // ground, so the bottom of the screen reads as beyond the line and not as
    // a hole. The thumb lives here on a phone.
    ground.fillStyle(0x0e1220, 1).fillRect(0, ARENA.breachY + 1, VIEW.width, VIEW.height - ARENA.breachY - 1);
    ground.fillStyle(0x2a3350, 1).fillRect(0, GROUND_TOP, VIEW.width, 1);
    [0.05, 0.035, 0.02].forEach((a, i) => {
      ground.fillStyle(COLORS.breach, a).fillRect(0, ARENA.breachY - 6 * (i + 1), VIEW.width, 6);
    });
    ground.fillStyle(COLORS.breach, 0.6).fillRect(0, ARENA.breachY - 1, VIEW.width, 2);
    // Backing strip so the HUD stays legible as enemies walk in from the top.
    // Near-opaque (0.96, what the strip uses): at 0.86 the stream, the cage and
    // a Runner all read through the DPS and PAR numbers.
    const hud = this.scene.add.graphics().setDepth(30);
    hud.fillStyle(COLORS.bg, 0.96).fillRect(0, 0, VIEW.width, RAIL_HEIGHT);
    hud.fillStyle(COLORS.bg, 0.3).fillRect(0, RAIL_HEIGHT, VIEW.width, 12);
  }

  /**
   * Which gate the squad is about to take. The selection rule - the CENTRE of
   * the formation is what passes through a gate - is invisible otherwise.
   */
  private findTarget(w: FieldWorld): (GateTarget & { x: number; y: number; color: number }) | null {
    let target: (GateTarget & { x: number; y: number; color: number }) | null = null;
    for (const g of w.gates.items) {
      if (!g.active || g.y > w.squad.y) continue;
      if (Math.abs(g.x - w.squad.x) > g.width / 2) continue;
      if (target === null || g.y > target.y) {
        target = { pair: g.pair, index: g.index, x: g.x, y: g.y, color: g.type.color };
      }
    }
    return target;
  }

  /**
   * The targeted card is lit by `GateCards`; this adds the two bottom-corner
   * brackets on it, a short stub above the leader, and the leader ring. All
   * fade in as the offer closes, so it guides without nagging.
   */
  private renderSelection(w: FieldWorld, t: ReturnType<FieldRender['findTarget']>): void {
    this.selection.clear();
    if (t === null) return;
    const nearness = Phaser.Math.Clamp(1 - (w.squad.y - t.y) / 520, 0.12, 0.55);
    const width = w.gates.items.find((g) => g.active && g.pair === t.pair)?.width ?? 170;
    const hw = width / 2 - GATES.gap / 2;
    const bottom = t.y + GATES.height / 2;
    this.selection.lineStyle(3, 0xffffff, Math.min(0.9, nearness + 0.35));
    for (const side of [-1, 1]) {
      const cx = t.x + side * hw;
      this.selection.beginPath();
      this.selection.moveTo(cx, bottom - 14);
      this.selection.lineTo(cx, bottom);
      this.selection.lineTo(cx - side * 14, bottom);
      this.selection.strokePath();
    }
    this.selection.lineStyle(3, t.color, Math.min(0.6, nearness + 0.05));
    this.selection.lineBetween(w.squad.x, w.squad.y - 18, w.squad.x, w.squad.y - 42);
    this.selection.lineStyle(3, t.color, nearness + 0.25);
    this.selection.strokeCircle(w.squad.x, w.squad.y - 2, 16);
  }

  /**
   * What is about to hit the army. A tick on the horizon under every body in
   * the ground band, brightening as it nears the line; cage bars with the
   * reward the cage would pay right now; and, if `RENDER.landingDashes` is
   * on, a dash on the lane where each enemy bullet will cross it.
   */
  private renderOverlay(w: FieldWorld): void {
    const o = this.overlay;
    o.clear();
    for (const e of w.enemies.items) {
      if (!e.active || e.y <= TICK_FROM) continue;
      const a = Math.min(1, 0.4 + 0.6 * (e.y - TICK_FROM) / (ARENA.breachY - TICK_FROM));
      o.fillStyle(COLORS.breach, a).fillRect(e.x - 1.5, ARENA.breachY - 10, 3, 10);
    }
    if (RENDER.landingDashes && w.enemyFire) {
      for (const b of w.enemyFire.items) {
        if (!b.active || b.vy <= 0 || b.y >= ARENA.laneY) continue;
        const crossX = b.x + b.vx * (ARENA.laneY - b.y) / b.vy;
        const progress = Phaser.Math.Clamp(b.y / ARENA.laneY, 0, 1);
        o.fillStyle(COLORS.enemyBullet, 0.15 + 0.5 * progress)
          .fillRect(crossX - 5, ARENA.laneY + 21, 10, 2);
      }
    }
    const reward = cageReward(w.squad.power);
    let used = 0;
    for (const c of w.enemies.cages) {
      if (!c.active) continue;
      const barY = c.y - CAGE.radius - 10;
      o.fillStyle(0x000000, 0.5).fillRect(c.x - CAGE.radius, barY, CAGE.radius * 2, 5);
      o.fillStyle(COLORS.cage, 0.95).fillRect(c.x - CAGE.radius, barY, CAGE.radius * 2 * (c.hp / c.maxHp), 5);
      const t = this.rewards[used] ?? this.makeReward();
      const text = `+${compact(reward)}`;
      if (t.text !== text) t.setText(text);
      t.setPosition(c.x, barY - 3).setVisible(true);
      used++;
    }
    for (let i = used; i < this.rewards.length; i++) this.rewards[i].setVisible(false);
  }

  private makeReward(): Phaser.GameObjects.Text {
    const t = this.scene.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: hex(COLORS.cage),
    }).setOrigin(0.5, 1).setStroke('#05070f', 3).setDepth(15);
    this.rewards.push(t);
    return t;
  }
}
