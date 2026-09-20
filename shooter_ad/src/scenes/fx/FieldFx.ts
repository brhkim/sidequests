import Phaser from 'phaser';
import { ARENA, COLORS, GATES, RENDER, VIEW } from '../../config';
import { AXIS_COLOR } from '../../data/gates';
import type { SimEvent } from '../../systems/SimEvents';
import { FONT, GRADE_COLOR, GRADE_WORD, type Grade } from '../hud/types';
import { FloatingLabels } from './FloatingLabels';

const WASHES = 4;
const RED = 0xff4757;

/**
 * Feedback that happens AT a place on the field: the grade wash over a gate
 * you just drove through, `MISS` at the lane line when an offer passes
 * untaken, `+N ARMY` over an opened cage, `-N` where a body touched the ring,
 * and the beat of darkness a run ends on. HUD-space feedback (edge flashes,
 * the boss bar, the wave banner) lives in UIScene, which does not shake.
 *
 * The pick wash is the ONE authored motion moment: it holds, then lifts. It
 * replaces the 420ms halo, which was a circle the size of a unit on a card
 * three times wider and read as a hit rather than a verdict.
 *
 * Everything here is driven by `SimEvent`s and tweens; nothing reads back.
 */
export class FieldFx {
  private readonly labels: FloatingLabels;
  private readonly washes: { rect: Phaser.GameObjects.Rectangle; word: Phaser.GameObjects.Text }[] = [];
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly horizon: Phaser.GameObjects.Rectangle;
  private nextWash = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.labels = new FloatingLabels(scene, 6, 27);
    for (let i = 0; i < WASHES; i++) {
      this.washes.push({
        rect: scene.add.rectangle(0, 0, 10, GATES.height, 0xffffff, 0.55)
          .setDepth(27).setVisible(false),
        word: scene.add.text(0, 0, '', {
          fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#05070f',
        }).setOrigin(0.5).setLetterSpacing(3).setDepth(27).setVisible(false),
      });
    }
    // 29: over everything on the field, under the HUD backing (30).
    this.dim = scene.add.rectangle(VIEW.width / 2, VIEW.height / 2, VIEW.width, VIEW.height, 0x05070f, 1)
      .setDepth(29).setAlpha(0).setVisible(false);
    this.horizon = scene.add.rectangle(VIEW.width / 2, ARENA.breachY, VIEW.width, 6, COLORS.breach, 1)
      .setDepth(28).setAlpha(0).setVisible(false);
  }

  onEvents(events: readonly SimEvent[]): void {
    for (const e of events) {
      switch (e.kind) {
        case 'pick': this.pick(e.x, e.y, e.width, e.grade); break;
        case 'miss':
          // 60px up: the lane line is where the ring's heads are, and the word
          // used to spawn on them.
          this.labels.spawn(e.x, e.y - 60, 'MISS', RED, { size: 18, tracking: 3, rise: 24, duration: 800, hold: 200 });
          break;
        case 'rescue':
          this.labels.spawn(e.x, e.y - 20, `+${e.amount} ARMY`, AXIS_COLOR.army, { size: 20, stroke: 4, rise: 40, duration: 800 });
          break;
        case 'contact':
          if (!e.titan) this.labels.spawn(e.x, e.y - 12, `-${e.cost}`, RED, { size: 16, rise: 26, duration: 700 });
          break;
        case 'over': this.death(e.cause); break;
        default: break;
      }
    }
  }

  /**
   * The grade, in the card's own footprint: a wash in the grade colour with
   * the word on it. Holds for `pickHold` so it can be read, then lifts 24px
   * and fades over `pickFade`.
   */
  private pick(x: number, y: number, width: number, grade: Grade): void {
    const w = this.washes[this.nextWash];
    this.nextWash = (this.nextWash + 1) % WASHES;
    this.scene.tweens.killTweensOf([w.rect, w.word]);
    const color = GRADE_COLOR[grade];
    w.rect.setPosition(x, y).setSize(width - GATES.gap, GATES.height)
      .setFillStyle(color, 0.55).setStrokeStyle(3, color, 1).setAlpha(1).setVisible(true);
    w.word.setPosition(x, y).setText(GRADE_WORD[grade]).setAlpha(1).setVisible(true);
    const { pickHold, pickFade } = RENDER.moments;
    this.scene.tweens.add({
      targets: [w.rect, w.word], y: y - 24, alpha: 0,
      delay: pickHold, duration: pickFade, ease: 'Quad.easeOut',
      onComplete: () => { w.rect.setVisible(false); w.word.setVisible(false); },
    });
  }

  /**
   * The death beat: the field goes dark over `deathBeat`, and UIScene holds
   * the end screen back for the same interval, so the last frame of the run
   * is seen before the results replace it. A Titan landing also flashes the
   * horizon - the line it just crossed is the reason.
   */
  private death(cause: 'overrun' | 'titan'): void {
    this.scene.tweens.killTweensOf([this.dim, this.horizon]);
    this.dim.setAlpha(0).setVisible(true);
    this.scene.tweens.add({
      targets: this.dim, alpha: 0.7,
      duration: RENDER.moments.deathBeat - 60, ease: 'Quad.easeOut',
    });
    if (cause === 'titan') {
      this.horizon.setAlpha(0.9).setVisible(true);
      this.scene.tweens.add({
        targets: this.horizon, alpha: 0, duration: RENDER.moments.deathBeat, ease: 'Quad.easeOut',
        onComplete: () => this.horizon.setVisible(false),
      });
    }
  }

  reset(): void {
    this.labels.reset();
    for (const w of this.washes) {
      this.scene.tweens.killTweensOf([w.rect, w.word]);
      w.rect.setVisible(false);
      w.word.setVisible(false);
    }
    this.scene.tweens.killTweensOf([this.dim, this.horizon]);
    this.dim.setAlpha(0).setVisible(false);
    this.horizon.setAlpha(0).setVisible(false);
  }
}
