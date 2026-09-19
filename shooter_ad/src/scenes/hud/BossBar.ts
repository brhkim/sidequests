import Phaser from 'phaser';
import { FONT } from './types';

const PURPLE = 0x6b2b8c;
const EDGE = 0xbf8fdc;
const Y = 90;
const TRACK_X = 110;
const TRACK_W = 320;

/**
 * The Titan's health, under the rail, for the length of its descent. It
 * arrives as a warning band that pulses `TITAN` three times, then settles
 * into a bar whose width is the boss's remaining HP - the one number that
 * says whether the deadline is being met. The band stops short of the pause
 * button on the right.
 */
export class BossBar {
  private readonly warn: Phaser.GameObjects.Rectangle;
  private readonly warnText: Phaser.GameObjects.Text;
  private readonly track: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private live = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.warn = scene.add.rectangle(218, Y, 436, 40, PURPLE, 0.35).setDepth(42).setVisible(false);
    this.warnText = scene.add.text(218, Y, 'TITAN', {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#e9d5ff',
    }).setOrigin(0.5).setLetterSpacing(6).setDepth(42).setVisible(false);
    this.track = scene.add.rectangle(TRACK_X, Y, TRACK_W, 8, 0x1b2236, 1)
      .setOrigin(0, 0.5).setDepth(42).setVisible(false);
    this.fill = scene.add.rectangle(TRACK_X, Y, TRACK_W, 8, PURPLE, 1)
      .setOrigin(0, 0.5).setStrokeStyle(1, EDGE, 1).setDepth(42).setVisible(false);
    this.label = scene.add.text(100, Y, 'TITAN', {
      fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#d9b8f0',
    }).setOrigin(1, 0.5).setLetterSpacing(1.5).setDepth(42).setVisible(false);
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
    this.track.setVisible(true);
    this.fill.setFillStyle(PURPLE, 1).setAlpha(1).setVisible(true);
    this.label.setVisible(true);
  }

  /** Each HUD frame: `hpFrac` of the live boss, or null once there is none. */
  update(titan: { hpFrac: number } | null): void {
    if (!titan) {
      if (this.live) this.hide();
      return;
    }
    if (!this.live) { this.live = true; this.showBar(); }
    this.fill.width = Math.max(0, TRACK_W * titan.hpFrac);
  }

  /** The kill: the fill goes white, then the whole bar fades. */
  down(): void {
    this.live = false;
    this.scene.tweens.killTweensOf([this.warn, this.warnText, this.fill]);
    this.warn.setVisible(false);
    this.warnText.setVisible(false);
    this.fill.setFillStyle(0xffffff, 1);
    this.scene.tweens.add({
      targets: [this.fill, this.track, this.label], alpha: 0, delay: 100, duration: 400,
      onComplete: () => this.hide(),
    });
  }

  hide(): void {
    this.live = false;
    this.scene.tweens.killTweensOf([this.warn, this.warnText, this.fill, this.track, this.label]);
    for (const o of [this.warn, this.warnText, this.fill, this.track, this.label]) {
      o.setVisible(false).setAlpha(1);
    }
  }
}
