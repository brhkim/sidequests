import Phaser from 'phaser';
import { TYPE } from '../theme';
import { TITAN_BAR, TITAN_ROW } from './HudLayout';
import { FONT } from './types';

/** The warning's length: the stage banner's TITAN holds this long, then the bar. */
export const TITAN_WARNING_MS = 1200;
const DEPTH = 42;
const TAG = 0xd9b8f0;
/** The white chunk that trails a hit, easing down to the live HP. */
const LAG_EASE = 0.08;

/**
 * The Titan's health for the length of its descent, in its own panel row
 * directly UNDER the strip (`HUD_ROWS.titanRow`), from `HudPayload.titan`:
 * a TITAN tag at the left, the bar across the rest, the fill cropped to the
 * boss's remaining HP with a white chunk trailing each hit so damage is seen
 * landing rather than only read. The warning that precedes it is the stage
 * banner's (`WaveBanner.titan`); the bar arrives when the warning has held.
 * The row exists only while a boss lives - otherwise that 18px is field.
 */
export class BossBar {
  private readonly row: Phaser.GameObjects.Image;
  private readonly track: Phaser.GameObjects.Image;
  private readonly lag: Phaser.GameObjects.Image;
  private readonly fill: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly parts: Phaser.GameObjects.GameObject[];
  private live = false;
  private shown = false;
  private hpPx = -1;
  private lagFrac = 1;
  private lagPx = -1;
  private warning: Phaser.Time.TimerEvent | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const mid = TITAN_ROW.y + TITAN_ROW.h / 2;
    this.row = scene.add.image(0, TITAN_ROW.y, 'hud-titanrow').setOrigin(0, 0);
    this.label = scene.add.text(12, mid, 'TITAN', {
      fontFamily: FONT, fontSize: `${TYPE.caption.size}px`, fontStyle: '800', color: '#ffffff',
    }).setOrigin(0, 0.5).setLetterSpacing(2).setTint(TAG);
    this.track = scene.add.image(TITAN_BAR.x, mid, 'hud-titan-track').setOrigin(0, 0.5);
    this.lag = scene.add.image(TITAN_BAR.x, mid, 'hud-titan-fill').setOrigin(0, 0.5)
      .setTint(0xffffff).setTintMode(Phaser.TintModes.FILL).setAlpha(0.85);
    this.fill = scene.add.image(TITAN_BAR.x, mid, 'hud-titan-fill').setOrigin(0, 0.5);
    this.parts = [this.row, this.label, this.track, this.lag, this.fill];
    for (const p of this.parts) (p as unknown as Phaser.GameObjects.Components.Depth).setDepth(DEPTH);
    this.setVisible(false);
  }

  /** The warning (the banner's), then the bar. */
  arrive(): void {
    this.live = true;
    this.warning?.remove(false);
    this.warning = this.scene.time.delayedCall(TITAN_WARNING_MS, () => {
      this.warning = null;
      this.showBar();
    });
  }

  private showBar(): void {
    if (!this.live || this.shown) return;
    this.shown = true;
    this.scene.tweens.killTweensOf(this.parts);
    this.fill.setTint(0xffffff).setTintMode(Phaser.TintModes.MULTIPLY);
    for (const p of this.parts) (p as Phaser.GameObjects.Image).setAlpha(p === this.lag ? 0.85 : 1);
    this.setVisible(true);
    // It snaps in on the beat: the bar grows out from the tag.
    this.fill.scaleX = 0;
    this.track.scaleX = 0;
    this.scene.tweens.add({ targets: [this.fill, this.track], scaleX: 1, duration: 260, ease: 'Cubic.easeOut' });
  }

  /** Each HUD frame: `hpFrac` of the live boss, or null once there is none. */
  update(titan: { hpFrac: number } | null): void {
    if (!titan) {
      if (this.live) this.hide();
      return;
    }
    if (!this.live) { this.live = true; this.showBar(); }
    const frac = Phaser.Math.Clamp(titan.hpFrac, 0, 1);
    const px = Math.round(TITAN_BAR.w * frac);
    if (px !== this.hpPx) {
      this.hpPx = px;
      this.fill.setCrop(0, 0, px, TITAN_BAR.h);
    }
    this.lagFrac = frac >= this.lagFrac ? frac : this.lagFrac + (frac - this.lagFrac) * LAG_EASE;
    const lagPx = Math.round(TITAN_BAR.w * this.lagFrac);
    if (lagPx !== this.lagPx) {
      this.lagPx = lagPx;
      this.lag.setCrop(0, 0, lagPx, TITAN_BAR.h);
    }
  }

  /** The kill: the fill goes white, then the whole row fades. */
  down(): void {
    this.live = false;
    this.warning?.remove(false);
    this.warning = null;
    this.scene.tweens.killTweensOf(this.parts);
    this.fill.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL).setCrop();
    this.scene.tweens.add({
      targets: this.parts, alpha: 0, delay: 120, duration: 400,
      onComplete: () => this.hide(),
    });
  }

  hide(): void {
    this.live = false;
    this.shown = false;
    this.warning?.remove(false);
    this.warning = null;
    this.scene.tweens.killTweensOf(this.parts);
    this.setVisible(false);
    this.hpPx = -1;
    this.lagPx = -1;
    this.lagFrac = 1;
    this.fill.setTintMode(Phaser.TintModes.MULTIPLY).setCrop();
    this.lag.setCrop();
    for (const p of this.parts) (p as Phaser.GameObjects.Image).setAlpha(1).setScale(1);
    this.lag.setAlpha(0.85);
  }

  private setVisible(v: boolean): void {
    for (const p of this.parts) (p as Phaser.GameObjects.Image).setVisible(v);
  }
}
