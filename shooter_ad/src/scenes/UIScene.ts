import Phaser from 'phaser';
import { VIEW } from '../config';
import { BonusStrip } from './hud/BonusStrip';
import { EndScreen, type EndPayload } from './hud/EndScreen';
import { StartScreen, type StartPayload } from './hud/StartScreen';
import { TopRail } from './hud/TopRail';
import type { HudPayload } from './hud/types';

/**
 * HUD in its own scene so it never inherits the game camera's shake, and so
 * gameplay never has to reason about text layout.
 *
 * Two readouts, both load-bearing rather than decorative: the top rail carries
 * your DPS against par so falling behind is visible while it happens, and the
 * strip beneath the red line carries the bonus pools without which the
 * raw-versus-multiplicative choice cannot be worked out at all.
 */
export class UIScene extends Phaser.Scene {
  private rail!: TopRail;
  private strip!: BonusStrip;
  private toastText!: Phaser.GameObjects.Text;
  private end!: EndScreen;
  private start!: StartScreen;

  constructor() { super('UI'); }

  create(): void {
    this.rail = new TopRail(this);
    this.strip = new BonusStrip(this);

    this.toastText = this.add.text(VIEW.width / 2, 620, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '34px',
      color: '#ffe9a8', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    this.end = new EndScreen(this);
    this.start = new StartScreen(this, () => {
      this.start.hide();
      this.game.events.emit('startmatch');
    });

    this.game.events.on('hud', this.onHud, this);
    this.game.events.on('toast', this.onToast, this);
    this.game.events.on('gameover', this.onGameOver, this);
    this.game.events.on('showstart', this.onShowStart, this);
    this.game.events.on('restart', this.onRestart, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('hud', this.onHud, this);
      this.game.events.off('toast', this.onToast, this);
      this.game.events.off('gameover', this.onGameOver, this);
      this.game.events.off('showstart', this.onShowStart, this);
      this.game.events.off('restart', this.onRestart, this);
    });
  }



  private onHud(h: HudPayload): void {
    this.rail.update(h);
    this.strip.update(h);
  }

  private onRestart(): void {
    this.end.hide();
    this.strip.reset();
  }

  private onToast(text: string): void {
    this.toastText.setText(text).setAlpha(1).setScale(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({
      targets: this.toastText,
      alpha: 0, scale: 1.25, y: 580,
      duration: 900, ease: 'Quad.easeOut',
      onStart: () => this.toastText.setY(620),
    });
  }

  private onShowStart(payload: StartPayload): void {
    this.start.show(payload);
  }

  private onGameOver(payload: EndPayload & { link: string }): void {
    this.end.show(payload, payload.link);
  }

}
