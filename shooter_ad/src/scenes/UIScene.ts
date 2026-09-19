import Phaser from 'phaser';
import { VIEW } from '../config';
import { BonusStrip } from './hud/BonusStrip';
import { EndScreen, type EndPayload } from './hud/EndScreen';
import { PauseScreen, PAUSE_BUTTON } from './hud/PauseScreen';
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
  private pause!: PauseScreen;
  /** The last frame the game published. The pause screen reads from it, because
   *  a paused GameScene stops publishing. */
  private lastHud: HudPayload | null = null;

  constructor() { super('UI'); }

  create(): void {
    this.rail = new TopRail(this);
    this.strip = new BonusStrip(this);

    this.toastText = this.add.text(VIEW.width / 2, 620, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '34px',
      color: '#ffe9a8', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    this.end = new EndScreen(this, () => {
      this.end.hide();
      this.game.events.emit('newmatchrequest');
    });
    this.start = new StartScreen(
      this,
      () => {
        this.start.hide();
        this.game.events.emit('startmatch');
      },
      // GameScene owns the mode - it is what sets the run-wide value every
      // wave-keyed difficulty number reads - so this asks rather than decides,
      // and the screen redraws from the `showstart` that comes back.
      (mode) => this.game.events.emit('modechange', mode),
      // Same ownership for the seed: a typed code or a request for a fresh
      // one is a request, and the code that comes back is the truth.
      (match) => this.game.events.emit('matchrequest', match),
    );

    this.pause = new PauseScreen(
      this,
      () => this.game.events.emit('setpaused', false),
      () => this.game.events.emit('restartrequest'),
    );
    this.drawPauseButton();

    this.game.events.on('hud', this.onHud, this);
    this.game.events.on('toast', this.onToast, this);
    this.game.events.on('gameover', this.onGameOver, this);
    this.game.events.on('showstart', this.onShowStart, this);
    // GameScene.create has already run by now and is waiting for this before it
    // announces the match - see the note there.
    this.game.events.emit('uiready');
    this.game.events.on('restart', this.onRestart, this);
    this.game.events.on('paused', this.onPaused, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('hud', this.onHud, this);
      this.game.events.off('toast', this.onToast, this);
      this.game.events.off('gameover', this.onGameOver, this);
      this.game.events.off('showstart', this.onShowStart, this);
      this.game.events.off('restart', this.onRestart, this);
      this.game.events.off('paused', this.onPaused, this);
    });
  }

  /**
   * The pause control, drawn here rather than in the rail because the rail's
   * five columns are full. GameScene owns the hit test - see PAUSE_BUTTON -
   * so one tap cannot both pause and order the squad across the lane.
   */
  private drawPauseButton(): void {
    const { x, y, width, height } = PAUSE_BUTTON;
    this.add.rectangle(x, y, width, height, 0x0b0f1c, 0.72)
      .setStrokeStyle(1, 0x6f7a94, 0.7).setDepth(40);
    this.add.text(x, y, 'PAUSE', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px',
      color: '#8f9ab5', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(40).setLetterSpacing(1);
  }

  private onHud(h: HudPayload): void {
    this.lastHud = h;
    this.rail.update(h);
    this.strip.update(h);
  }

  private onPaused(paused: boolean): void {
    if (paused && this.lastHud) this.pause.show(this.lastHud);
    else this.pause.hide();
  }

  private onRestart(): void {
    this.end.hide();
    this.pause.hide();
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
