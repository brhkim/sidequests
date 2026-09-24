import Phaser from 'phaser';
import { ARENA, CAGE, COLORS, RENDER } from '../../config';
import type { Enemies } from '../../systems/Enemies';
import type { EnemyBullets } from '../../systems/EnemyBullets';
import type { Gates } from '../../systems/Gates';
import type { Squad } from '../../systems/Squad';
import { cageReward } from '../../systems/Progression';
import type { SimEvent } from '../../systems/SimEvents';
import { SpritePool } from '../../systems/SpritePool';
import { FieldFx } from '../fx/FieldFx';
import { FONT, hex } from '../hud/types';
import { compact } from '../../format';
import { HW } from '../art/cards';
import { LIGHT } from '../theme';
import { GateCards } from './GateCards';
import { Highway } from './Highway';
import { Receptors, type ReceptorTarget } from './Receptors';

/** What the field layer reads, once per frame. Simulation state it may look at
 * and never write. `marked` is the set of `pair:index` keys wearing the SENSE
 * mark this frame, computed by the scene from the shared scoring. */
export interface FieldWorld {
  readonly gates: Gates;
  readonly enemies: Enemies;
  readonly squad: Squad;
  readonly marked: ReadonlySet<string>;
  /** Simulated seconds, for the SENSE pulse and the beat lines. Never the wall clock. */
  readonly elapsed: number;
  /** Only read when `RENDER.landingDashes` is on; the scene need not pass it. */
  readonly enemyFire?: EnemyBullets;
}

/** A body below this line is about to breach; its tick brightens as it nears. */
const TICK_FROM = 772;

/**
 * The playfield as a rhythm-game note highway: the road and its beat lines
 * (`Highway`), the descending notes with their SENSE mark (`GateCards`), the
 * receptors on the judgment line that say which note the squad will take
 * (`Receptors`), the breach ticks and the cage health bars with what each
 * cage is worth, and - through `FieldFx` - the feedback that happens at a
 * place on the field. Everything here is rendering; nothing may reach back
 * into the simulation.
 */
export class FieldRender {
  private readonly highway: Highway;
  private readonly cards: GateCards;
  private readonly receptors: Receptors;
  private readonly fx: FieldFx;
  /** Breach ticks: a lit bar on the fail line under every body about to cross it. */
  private readonly ticks: SpritePool;
  /** Cage bars (and landing dashes, when on). Below the bodies (10). */
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly rewards: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.highway = new Highway(scene);
    this.ticks = new SpritePool(scene, HW.tick, 6);
    this.overlay = scene.add.graphics().setDepth(6);
    this.cards = new GateCards(scene);
    this.receptors = new Receptors(scene);
    this.fx = new FieldFx(scene);
  }

  /** Events since the last frame, for the field-space feedback. */
  onEvents(events: readonly SimEvent[]): void { this.fx.onEvents(events); }

  /** Forget any per-run animation state. */
  reset(): void {
    this.fx.reset();
    this.highway.reset();
  }

  render(w: FieldWorld): void {
    this.highway.update(w.elapsed, w.enemies.wave.index, w.squad.upgrades);
    const target = this.findTarget(w);
    this.cards.render(w.gates.items, w.marked, target, w.elapsed);
    this.receptors.render(w.gates.items, w.squad.x, w.squad.y, target);
    this.renderOverlay(w);
  }

  /**
   * Which gate the squad is about to take. The selection rule - the CENTRE of
   * the formation is what passes through a gate - is invisible otherwise.
   */
  private findTarget(w: FieldWorld): ReceptorTarget | null {
    let target: ReceptorTarget | null = null;
    for (const g of w.gates.items) {
      if (!g.active || g.y > w.squad.y) continue;
      if (Math.abs(g.x - w.squad.x) > g.width / 2) continue;
      if (target === null || g.y > target.y) {
        target = { pair: g.pair, index: g.index, x: g.x, y: g.y, width: g.width, color: g.type.color };
      }
    }
    return target;
  }

  /**
   * What is about to hit the army. A lit tick on the fail line under every
   * body in the ground band, brightening as it nears; cage bars with the
   * reward the cage would pay right now; and, if `RENDER.landingDashes` is
   * on, a dash on the lane where each enemy bullet will cross it.
   */
  private renderOverlay(w: FieldWorld): void {
    const o = this.overlay;
    o.clear();
    this.ticks.begin();
    for (const e of w.enemies.items) {
      if (!e.active || e.y <= TICK_FROM) continue;
      const a = Math.min(1, 0.35 + 0.65 * (e.y - TICK_FROM) / (ARENA.breachY - TICK_FROM));
      this.ticks.claim().setPosition(e.x, ARENA.breachY + 1).setOrigin(0.5, 1).setTint(LIGHT.fail).setAlpha(a);
    }
    this.ticks.end();
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
      const bw = CAGE.radius * 2;
      o.fillStyle(0x000000, 0.55).fillRoundedRect(c.x - CAGE.radius - 1, barY - 1, bw + 2, 7, 3);
      o.fillStyle(COLORS.cage, 0.95).fillRoundedRect(c.x - CAGE.radius, barY, Math.max(4, bw * (c.hp / c.maxHp)), 5, 2.5);
      const t = this.rewards[used] ?? this.makeReward();
      const text = `+${compact(reward)}`;
      if (t.text !== text) t.setText(text);
      t.setPosition(c.x, barY - 3).setVisible(true);
      used++;
    }
    for (let i = used; i < this.rewards.length; i++) this.rewards[i].setVisible(false);
  }

  /** A cage's reward sits with its cage, under the note stack (11.6): a card passing over the cage hides both. */
  private makeReward(): Phaser.GameObjects.Text {
    const t = this.scene.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '14px', fontStyle: '800', color: hex(COLORS.cage),
      stroke: '#07070d', strokeThickness: 4,
    }).setOrigin(0.5, 1).setDepth(11.5);
    this.rewards.push(t);
    return t;
  }
}
