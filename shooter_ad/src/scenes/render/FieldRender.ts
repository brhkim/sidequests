import Phaser from 'phaser';
import { ARENA, CAGE, COLORS, GATES, VIEW } from '../../config';
import { AXIS_COLOR } from '../../data/gates';
import type { Enemies } from '../../systems/Enemies';
import type { Gates } from '../../systems/Gates';
import type { Squad } from '../../systems/Squad';
import type { SimEvent } from '../../systems/SimEvents';
import { hex } from '../hud/types';
import { RAIL_HEIGHT } from '../hud/TopRail';

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
}

interface GateVisual {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  /** The SENSE mark: a ring round the offer's best option, and its caption. */
  ring: Phaser.GameObjects.Rectangle;
  tag: Phaser.GameObjects.Text;
}

/**
 * The playfield's furniture: the ground and breach line, the descending gate
 * cards with their SENSE mark, the selection guide, and the cage health
 * bars. Everything here is rendering; nothing may reach back into the
 * simulation. `onEvents` receives what the simulation did since the last
 * frame (see `systems/SimEvents.ts`) for field-space feedback.
 */
export class FieldRender {
  /**
   * The selection guide, on its own layer ABOVE the squad and every
   * projectile. On the shared overlay it sat under the bullet stream and was
   * unreadable exactly when it mattered - mid-wave, with an offer closing.
   */
  private readonly selection: Phaser.GameObjects.Graphics;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly gateVisuals: GateVisual[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.drawBackground();
    this.overlay = scene.add.graphics().setDepth(6);
    // 25: above the squad (21), below the HUD backing strip (30).
    this.selection = scene.add.graphics().setDepth(25);
  }

  /** Events since the last frame. Nothing here yet; the hook is the contract. */
  onEvents(_events: readonly SimEvent[]): void {}

  /** Forget any per-run animation state. */
  reset(): void {}

  render(w: FieldWorld): void {
    this.renderGates(w);
    this.renderCageBars(w);
    // Last, and on the topmost gameplay layer: the guide has to survive a
    // screen full of bullets.
    this.renderSelection(w);
  }

  private drawBackground(): void {
    const g = this.scene.add.graphics().setDepth(0);
    g.fillStyle(COLORS.bg, 1).fillRect(0, 0, VIEW.width, VIEW.height);
    g.fillStyle(COLORS.lane, 1).fillRect(0, ARENA.laneY - 120, VIEW.width, 260);
    g.lineStyle(2, COLORS.breach, 0.35);
    g.lineBetween(0, ARENA.breachY, VIEW.width, ARENA.breachY);
    // Backing strip so the HUD stays legible as enemies walk in from the top.
    const hud = this.scene.add.graphics().setDepth(30);
    hud.fillStyle(COLORS.bg, 0.86).fillRect(0, 0, VIEW.width, RAIL_HEIGHT);
    hud.fillStyle(COLORS.bg, 0.3).fillRect(0, RAIL_HEIGHT, VIEW.width, 12);
  }

  /**
   * Which gate the squad is about to take, drawn as a line from the leader up
   * to the offer.
   *
   * The selection rule - the CENTRE of the formation is what passes through a
   * gate - is invisible otherwise. A player watching a nineteen-unit ring drift
   * across three lanes has no way to know which one counts, and finds out only
   * after committing. The leader is also drawn larger; this says the same thing
   * a second way, at the moment it matters.
   */
  private renderSelection(w: FieldWorld): void {
    this.selection.clear();
    let target: { x: number; y: number; color: number } | null = null;
    for (const g of w.gates.items) {
      if (!g.active || g.y > w.squad.y) continue;
      if (Math.abs(g.x - w.squad.x) > g.width / 2) continue;
      if (target === null || g.y > target.y) {
        target = { x: g.x, y: g.y, color: g.type.color };
      }
    }
    if (target === null) return;

    // Fades in as the offer closes, so it guides without nagging.
    const nearness = Phaser.Math.Clamp(
      1 - (w.squad.y - target.y) / 520, 0.12, 0.55,
    );
    this.selection.lineStyle(3, target.color, nearness);
    this.selection.lineBetween(
      w.squad.x, w.squad.y - 18,
      // Never draw up into the rail, for the same reason gates fade in below it.
      w.squad.x, Math.max(target.y + GATES.height / 2, RAIL_HEIGHT + 6),
    );
    this.selection.lineStyle(3, target.color, nearness + 0.25);
    this.selection.strokeCircle(w.squad.x, w.squad.y - 2, 16);
  }

  /**
   * Gates, and the SENSE mark. On a sensed offer the option that is best RIGHT
   * NOW - priced by the same `scoreOffer` par and the death screen use - wears
   * a pulsing pale ring and a caption. It is recomputed every frame rather
   * than fixed at spawn, so if taking the previous gate changes which of
   * these three is best, the mark moves with the truth. The pulse reads the
   * simulated clock for its phase; it is rendering and touches nothing.
   */
  private renderGates(w: FieldWorld): void {
    const pulse = 0.55 + 0.45 * Math.sin(w.elapsed * 7);
    let used = 0;
    for (const g of w.gates.items) {
      if (!g.active) continue;
      let v = this.gateVisuals[used];
      if (!v) {
        v = {
          rect: this.scene.add.rectangle(0, 0, 10, GATES.height, 0xffffff, 0.22).setDepth(4),
          label: this.scene.add.text(0, 0, '', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: `${GATES.labelSize}px`,
            color: COLORS.text,
            fontStyle: 'bold',
          }).setOrigin(0.5).setDepth(5),
          ring: this.scene.add.rectangle(0, 0, 10, GATES.height + 14, 0xffffff, 0)
            .setStrokeStyle(4, AXIS_COLOR.sense, 1).setDepth(3).setVisible(false),
          tag: this.scene.add.text(0, 0, 'SENSE', {
            fontFamily: 'system-ui, sans-serif', fontSize: '11px',
            color: hex(AXIS_COLOR.sense), fontStyle: 'bold',
          }).setOrigin(0.5, 1).setLetterSpacing(2).setDepth(5).setVisible(false),
        };
        this.gateVisuals.push(v);
      }
      // Fade in clear of the top rail. Gates spawn above the screen and would
      // otherwise slide through the HUD numbers, putting two unrelated sets of
      // figures on top of each other exactly where the player reads par.
      const reveal = Phaser.Math.Clamp((g.y - RAIL_HEIGHT - 6) / 44, 0, 1);
      v.rect.setVisible(reveal > 0).setPosition(g.x, g.y)
        // Inset for the visual separation the hit test no longer has.
        .setSize(g.width - GATES.gap, GATES.height)
        .setFillStyle(g.type.color, 0.22 * reveal)
        .setStrokeStyle(3, g.type.color, 0.9 * reveal);
      v.label.setVisible(reveal > 0).setPosition(g.x, g.y).setAlpha(reveal);
      if (v.label.text !== g.type.label) v.label.setText(g.type.label);
      const isMarked = w.marked.has(`${g.pair}:${g.index}`);
      v.ring.setVisible(isMarked && reveal > 0).setPosition(g.x, g.y)
        .setSize(g.width - GATES.gap + 14, GATES.height + 14)
        .setStrokeStyle(4, AXIS_COLOR.sense, pulse * reveal);
      v.tag.setVisible(isMarked && reveal > 0)
        .setPosition(g.x, g.y - GATES.height / 2 - 10).setAlpha(reveal);
      used++;
    }
    for (let i = used; i < this.gateVisuals.length; i++) {
      this.gateVisuals[i].rect.setVisible(false);
      this.gateVisuals[i].label.setVisible(false);
      this.gateVisuals[i].ring.setVisible(false);
      this.gateVisuals[i].tag.setVisible(false);
    }
  }

  private renderCageBars(w: FieldWorld): void {
    this.overlay.clear();
    for (const c of w.enemies.cages) {
      if (!c.active) continue;
      this.overlay.fillStyle(0x000000, 0.5);
      this.overlay.fillRect(c.x - CAGE.radius, c.y - CAGE.radius - 9, CAGE.radius * 2, 4);
      this.overlay.fillStyle(COLORS.cage, 0.95);
      this.overlay.fillRect(
        c.x - CAGE.radius, c.y - CAGE.radius - 9,
        CAGE.radius * 2 * (c.hp / c.maxHp), 4,
      );
    }
  }
}
