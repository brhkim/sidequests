import Phaser from 'phaser';
import { RENDER } from '../config';
import type { SimEvent } from '../systems/SimEvents';
import { BonusStrip } from './hud/BonusStrip';
import { BossBar } from './hud/BossBar';
import { EdgeFlash } from './hud/EdgeFlash';
import { EndScreen, type EndPayload } from './hud/EndScreen';
import { PauseScreen, PAUSE_BUTTON } from './hud/PauseScreen';
import { StartScreen, type StartPayload } from './hud/StartScreen';
import { TopRail } from './hud/TopRail';
import { cardButton } from './hud/CardTile';
import { GRADE_COLOR, type HudPayload } from './hud/types';
import { WaveBanner } from './hud/WaveBanner';

const RED = 0xff5566;
const BREACH = 0xff4d5e;
const FIRE = 0xff8a5c;
const GREEN = 0x3ecf7a;
/** Fire hits arrive several a step; one flash and one `-N` per this window. */
const FIRE_BATCH_MS = 250;

/**
 * HUD in its own scene so it never inherits the game camera's shake, and so
 * gameplay never has to reason about text layout.
 *
 * Two readouts, both load-bearing rather than decorative: the top rail carries
 * your DPS against par so falling behind is visible while it happens, and the
 * strip beneath the red line carries the bonus pools without which the
 * raw-versus-multiplicative choice cannot be worked out at all.
 *
 * Feedback arrives as the typed `moment` stream (`systems/SimEvents.ts`), one
 * array per frame, and is dispatched here to the HUD-space modules: the edge
 * flash for damage, the boss bar, the wave banner, and cell flashes on the
 * rail and strip. Field-space feedback is `FieldFx`, in the game scene.
 */
export class UIScene extends Phaser.Scene {
  private rail!: TopRail;
  private strip!: BonusStrip;
  private edge!: EdgeFlash;
  private boss!: BossBar;
  private banner!: WaveBanner;
  private end!: EndScreen;
  private start!: StartScreen;
  private pause!: PauseScreen;
  /** The last frame the game published. The pause screen reads from it, because
   *  a paused GameScene stops publishing. */
  private lastHud: HudPayload | null = null;
  private endTimer: Phaser.Time.TimerEvent | null = null;
  private fireCost = 0;
  private fireTimer: Phaser.Time.TimerEvent | null = null;

  constructor() { super('UI'); }

  create(): void {
    this.rail = new TopRail(this);
    this.strip = new BonusStrip(this);
    this.edge = new EdgeFlash(this);
    this.boss = new BossBar(this);
    this.banner = new WaveBanner(this);

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
      // HOW TO PLAY: the pause screen's pages over the start screen, from
      // the start-state frame GameScene publishes with `showstart`.
      () => { if (this.lastHud) this.pause.show(this.lastHud, 'guide'); },
    );

    this.pause = new PauseScreen(
      this,
      // RESUME asks the game to unpause; BACK from the guide only closes
      // the screen, because nothing was paused.
      (mode) => { if (mode === 'guide') this.pause.hide(); else this.game.events.emit('setpaused', false); },
      () => this.game.events.emit('restartrequest'),
      // Audio owns the truth about mute; it answers with `muted`.
      () => this.game.events.emit('mutetoggle'),
    );
    this.drawPauseButton();

    const on: [string, (...args: never[]) => void][] = [
      ['hud', this.onHud], ['moment', this.onMoment], ['gameover', this.onGameOver],
      ['showstart', this.onShowStart], ['restart', this.onRestart], ['paused', this.onPaused],
      ['muted', this.onMuted],
    ];
    for (const [name, fn] of on) this.game.events.on(name, fn, this);
    // GameScene.create has already run by now and is waiting for this before it
    // announces the match - see the note there.
    this.game.events.emit('uiready');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const [name, fn] of on) this.game.events.off(name, fn, this);
    });
  }

  /**
   * The pause control, drawn here rather than in the rail because the rail's
   * four columns are full. GameScene owns the hit test - see PAUSE_BUTTON -
   * so one tap cannot both pause and order the squad across the lane.
   */
  private drawPauseButton(): void {
    const { x, y, width, height } = PAUSE_BUTTON;
    // The card shape every other button has, on the panel's own backing so
    // the stream never reads through it; not bound - GameScene hit-tests it.
    this.add.rectangle(x, y, width, height, 0x0b0f1c, 0.96).setDepth(40);
    for (const p of cardButton(this, x, y, width, height, 0x8f9ab5, 'PAUSE', 14, 'secondary').parts) {
      (p as Phaser.GameObjects.Rectangle).setDepth(40);
    }
  }

  private onHud(h: HudPayload): void {
    this.lastHud = h;
    this.rail.update(h);
    this.strip.update(h);
    this.boss.update(h.titan);
  }

  private onMoment(events: readonly SimEvent[]): void {
    for (const e of events) {
      switch (e.kind) {
        case 'pick': this.strip.prime(GRADE_COLOR[e.grade]); break;
        case 'contact':
        case 'breach':
          if (e.titan) break;
          this.edge.flash(BREACH, Phaser.Math.Clamp(0.15 + 0.6 * e.share, 0.15, 0.75),
            e.kind === 'contact' ? 240 : RENDER.moments.edgeFade);
          this.strip.prime(RED);
          // A contact's `-N` is at the point of contact, on the field.
          if (e.kind === 'breach') this.strip.float(`-${e.cost}`, RED);
          break;
        case 'fire':
          this.edge.flash(FIRE, Phaser.Math.Clamp(0.12 + 0.4 * e.share, 0.12, 0.6), 280);
          this.strip.prime(FIRE);
          this.batchFire(e.cost);
          break;
        case 'rescue': case 'wave': this.strip.prime(GREEN); break;
        case 'titan':
          if (e.phase === 'arrive') this.boss.arrive();
          if (e.phase === 'down') { this.boss.down(); this.banner.titanDown(); }
          break;
        case 'over':
          if (e.cause === 'overrun') this.edge.flash(RED, 0.85, RENDER.moments.deathBeat);
          break;
        default: break;
      }
      if (e.kind === 'wave') this.banner.wave(e.index);
    }
  }

  private batchFire(cost: number): void {
    this.fireCost += cost;
    if (this.fireTimer) return;
    this.fireTimer = this.time.delayedCall(FIRE_BATCH_MS, () => {
      this.fireTimer = null;
      this.strip.flashCell(0, FIRE);
      this.strip.float(`-${this.fireCost}`, FIRE);
      this.fireCost = 0;
    });
  }

  private onPaused(paused: boolean): void {
    if (paused && this.lastHud) this.pause.show(this.lastHud);
    else this.pause.hide();
  }

  private onMuted(muted: boolean): void { this.pause.setMuted(muted); }

  private onRestart(): void {
    this.endTimer?.remove(false);
    this.endTimer = null;
    this.fireTimer?.remove(false);
    this.fireTimer = null;
    this.fireCost = 0;
    this.end.hide();
    this.pause.hide();
    this.strip.reset();
    this.rail.reset();
    this.edge.reset();
    this.banner.reset();
    this.boss.hide();
  }

  private onShowStart(payload: StartPayload): void {
    this.start.show(payload);
  }

  /** Held back for the death beat, so the last frame of the run is seen. */
  private onGameOver(payload: EndPayload & { link: string }): void {
    this.endTimer?.remove(false);
    this.endTimer = this.time.delayedCall(RENDER.moments.deathBeat, () => {
      this.endTimer = null;
      this.end.show(payload, payload.link);
    });
  }
}
