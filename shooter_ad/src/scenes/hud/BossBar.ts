import Phaser from 'phaser';
import { HUD_ROWS, VIEW } from '../../config';
import { STRIP_HEIGHT } from './BonusStrip';
import { RAIL_HEIGHT } from './TopRail';
import { FONT } from './types';

const PURPLE = 0x6b2b8c;
const EDGE = 0xbf8fdc;
/** Where the two panels end: the strip's bottom hairline. */
const PANELS_BOTTOM = RAIL_HEIGHT + STRIP_HEIGHT;
/** The bar: full width, its own row DIRECTLY UNDER both panels, on the field. */
const BAR_H = 10;
/** The row's backing, a third panel while the boss lives: cards emerge from under the strip. */
const ROW_H = HUD_ROWS.titanRow;
const BAR_Y = PANELS_BOTTOM + ROW_H / 2;
/** The warning band's row, under the bar, over the top of the field. */
const WARN_Y = PANELS_BOTTOM + 40;

/**
 * The Titan's health for the length of its descent. It arrives as a warning
 * band that pulses `TITAN` three times over the top of the field, then
 * settles into a full-width bar in its own row directly UNDER the strip -
 * below both panels, on the field's top edge - whose width is the boss's
 * remaining HP. It sat between the rail and the strip (in the 12px fade
 * under the standing bar) until 2026-09-20, where the author read it as
 * lost in the middle of the two panels; before that at y=90 beside PAUSE,
 * on top of whichever offer was at the head of its descent. A small TITAN
 * tag rides the bar's left end.
 */
export class BossBar {
  private readonly warn: Phaser.GameObjects.Rectangle;
  private readonly warnText: Phaser.GameObjects.Text;
  private readonly row: Phaser.GameObjects.Rectangle;
  private readonly track: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly tagBack: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private live = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.warn = scene.add.rectangle(218, WARN_Y, 436, 40, PURPLE, 0.35).setDepth(42).setVisible(false);
    this.warnText = scene.add.text(218, WARN_Y, 'TITAN', {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#e9d5ff',
    }).setOrigin(0.5).setLetterSpacing(6).setDepth(42).setVisible(false);
    this.row = scene.add.rectangle(0, PANELS_BOTTOM, VIEW.width, ROW_H, 0x0b0f1c, 0.96)
      .setOrigin(0, 0).setDepth(42).setVisible(false);
    this.track = scene.add.rectangle(0, BAR_Y, VIEW.width, BAR_H, 0x1b2236, 1)
      .setOrigin(0, 0.5).setDepth(42).setVisible(false);
    this.fill = scene.add.rectangle(0, BAR_Y, VIEW.width, BAR_H, PURPLE, 1)
      .setOrigin(0, 0.5).setStrokeStyle(1, EDGE, 1).setDepth(42).setVisible(false);
    this.tagBack = scene.add.rectangle(4, BAR_Y, 54, BAR_H - 2, 0x0b0f1c, 0.96)
      .setOrigin(0, 0.5).setDepth(42).setVisible(false);
    this.label = scene.add.text(31, BAR_Y, 'TITAN', {
      fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#d9b8f0',
    }).setOrigin(0.5, 0.5).setLetterSpacing(1.5).setDepth(42).setVisible(false);
  }

  /** The warning, then the bar. */
  arrive(): void {
    this.live = true;
    this.scene.tweens.killTweensOf([this.warn, this.warnText, this.fill]);
    this.warn.setAlpha(1).setVisible(true);
    this.warnText.setAlpha(1).setVisible(true);
    this.scene.tweens.add({
      targets: [this.warn, this.warnText], alpha: 0.25,
      duration: 200, yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
      onComplete: () => { this.warn.setVisible(false); this.warnText.setVisible(false); this.showBar(); },
    });
  }

  private showBar(): void {
    if (!this.live) return;
    this.row.setVisible(true);
    this.track.setVisible(true);
    this.fill.setFillStyle(PURPLE, 1).setAlpha(1).setVisible(true);
    this.tagBack.setVisible(true);
    this.label.setVisible(true);
  }

  /** Each HUD frame: `hpFrac` of the live boss, or null once there is none. */
  update(titan: { hpFrac: number } | null): void {
    if (!titan) {
      if (this.live) this.hide();
      return;
    }
    if (!this.live) { this.live = true; this.showBar(); }
    this.fill.width = Math.max(0, VIEW.width * titan.hpFrac);
  }

  /** The kill: the fill goes white, then the whole bar fades. */
  down(): void {
    this.live = false;
    this.scene.tweens.killTweensOf([this.warn, this.warnText, this.fill]);
    this.warn.setVisible(false);
    this.warnText.setVisible(false);
    this.fill.setFillStyle(0xffffff, 1);
    this.scene.tweens.add({
      targets: [this.fill, this.track, this.tagBack, this.label, this.row], alpha: 0, delay: 100, duration: 400,
      onComplete: () => this.hide(),
    });
  }

  hide(): void {
    this.live = false;
    const all = [this.warn, this.warnText, this.fill, this.track, this.tagBack, this.label, this.row];
    this.scene.tweens.killTweensOf(all);
    for (const o of all) {
      o.setVisible(false).setAlpha(1);
    }
  }
}
