import Phaser from 'phaser';
import { COLORS, VIEW } from '../config';
import { BonusStrip } from './hud/BonusStrip';
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
  private gameOver!: Phaser.GameObjects.Container;

  constructor() { super('UI'); }

  create(): void {
    this.rail = new TopRail(this);
    this.strip = new BonusStrip(this);

    this.toastText = this.add.text(VIEW.width / 2, 620, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '34px',
      color: '#ffe9a8', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    this.buildGameOver();

    this.game.events.on('hud', this.onHud, this);
    this.game.events.on('toast', this.onToast, this);
    this.game.events.on('gameover', this.onGameOver, this);
    this.game.events.on('restart', this.onRestart, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('hud', this.onHud, this);
      this.game.events.off('toast', this.onToast, this);
      this.game.events.off('gameover', this.onGameOver, this);
      this.game.events.off('restart', this.onRestart, this);
    });
  }

  private buildGameOver(): void {
    const panel = this.add.rectangle(
      VIEW.width / 2, VIEW.height / 2, VIEW.width, VIEW.height, 0x05070f, 0.86,
    );
    const title = this.add.text(VIEW.width / 2, VIEW.height / 2 - 70, 'OVERRUN', {
      fontFamily: 'system-ui, sans-serif', fontSize: '54px',
      color: '#ff5566', fontStyle: 'bold',
    }).setOrigin(0.5);
    const stats = this.add.text(VIEW.width / 2, VIEW.height / 2, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px',
      color: COLORS.text, align: 'center',
    }).setOrigin(0.5).setName('stats');
    const hint = this.add.text(VIEW.width / 2, VIEW.height / 2 + 80, 'tap to try again', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#8f9ab5',
    }).setOrigin(0.5);

    this.gameOver = this.add.container(0, 0, [panel, title, stats, hint])
      .setDepth(50).setVisible(false);
  }

  private onHud(h: HudPayload): void {
    this.rail.update(h);
    this.strip.update(h);
  }

  private onRestart(): void {
    this.gameOver.setVisible(false);
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

  private onGameOver(payload: { wave: number; kills: number }): void {
    const stats = this.gameOver.getByName('stats') as Phaser.GameObjects.Text;
    stats.setText(`reached wave ${payload.wave}\n${payload.kills} enemies destroyed`);
    this.gameOver.setVisible(true);
  }
}
