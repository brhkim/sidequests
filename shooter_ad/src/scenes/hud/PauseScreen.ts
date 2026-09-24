import Phaser from 'phaser';
import { VIEW } from '../../config';
import { SCREEN_PIXEL } from '../art/screens';
import { INK, MOTION, SURFACE, TYPE } from '../theme';
import { cardButton, segmented, type CardButton } from './CardTile';
import { PauseBonuses } from './PauseBonuses';
import { PauseDetails } from './PauseDetails';
import { PauseGuide } from './PauseGuide';
import { ScreenBackdrop } from './ScreenWipe';
import { FONT, GRADE_COLOR, LINK, type HudPayload } from './types';

/**
 * Where the pause control lives. GameScene hit-tests this rectangle itself
 * rather than letting an interactive object in the UI scene do it, because a
 * tap that reaches BOTH scenes pauses the game and simultaneously orders the
 * squad to walk to x=486 - which it then does the moment you resume.
 */
// In the rail's right-hand 80px (`TopRail.RAIL_PAUSE_WIDTH`), above the
// standing bar. It sat on the field at y 100 until the strip moved up under
// the rail; below both it landed on the right-hand gate card.
export const PAUSE_BUTTON = { x: 500, y: 33, width: 68, height: 44 } as const;

type Page = 'guide' | 'bonuses' | 'details';
/** Pause, or the same pages opened from the start screen before a run. */
export type PauseMode = 'pause' | 'guide';

const DEPTH = { pause: 55, guide: 65 } as const;
/** The controls' row: RESUME, then SOUND, MUSIC and RESTART a row beneath it; what is playing; the keys. */
const ROW = { primary: 748, secondary: 812, playing: 856, hint: 882, third: 150, gap: 10 } as const;
const PITCH = ROW.third + ROW.gap;

/**
 * Pause, and the only place the game explains itself. Three pages:
 *
 * **BASICS** (`PauseGuide`) is the game for somebody who has never seen
 * it, one tappable topic at a time. **BONUSES** (`PauseBonuses`) teaches
 * the conversion against the player's own pools and shows everything held
 * as notes. **DETAILS** (`PauseDetails`) is the rail's DPS derived line by
 * line from the strip's numbers.
 *
 * The same screen opens from the start screen's HOW TO PLAY (`mode:
 * 'guide'`): the heading says so, the primary button reads BACK, and there
 * is no run to restart. One set of explainers, reachable before and during
 * a run (the author's ask, 2026-09-20).
 *
 * One filled button, RESUME. RESTART is a red button a row beneath it,
 * beside SOUND and MUSIC, so a thumb reaching for RESUME cannot throw the
 * run away. SOUND switches the effects and MUSIC the music, separately
 * (2026-09-24, the author's ask); each asks, and the audio layer answers
 * with `setMuted` / `setMusic`, so a label never claims a state audio is
 * not in. Under them, what is playing.
 *
 * It enters with the lane wipe (`ScreenWipe`); a tab change swaps the page
 * with a short fade. Nothing runs per frame while it is up or hidden.
 */
export class PauseScreen {
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: ScreenBackdrop;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly guide: PauseGuide;
  private readonly bonuses: PauseBonuses;
  private readonly details: PauseDetails;
  private readonly tabs: ReturnType<typeof segmented<Page>>;
  private readonly primary: CardButton;
  private readonly sound: CardButton;
  private readonly music: CardButton;
  private readonly restart: CardButton;
  private readonly playing: Phaser.GameObjects.Text;
  private readonly keysHint: Phaser.GameObjects.Text;
  private page: Page = 'bonuses';
  private musicOn = true;
  private track = '';
  private mode: PauseMode = 'pause';

  constructor(
    private readonly scene: Phaser.Scene,
    /** RESUME on pause; BACK from the start screen's guide. */
    onPrimary: (mode: PauseMode) => void,
    onRestart: () => void, onMuteToggle: () => void, onMusicToggle: () => void,
  ) {
    const cx = VIEW.width / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { parts.push(o); return o; };
    const addAll = (os: Phaser.GameObjects.GameObject[]) => { for (const o of os) add(o); };

    this.backdrop = new ScreenBackdrop(scene, DEPTH.pause);

    this.heading = add(scene.add.text(cx, 28, 'PAUSED', {
      fontFamily: FONT, fontSize: `${TYPE.heading.size}px`, color: INK.primary, fontStyle: TYPE.heading.weight,
    }).setOrigin(0.5).setLetterSpacing(1.5));

    // Three tabs as a segmented row: the lit one is the page.
    this.tabs = segmented<Page>(scene, cx, 78, 162, 44, 6, [
      { key: 'guide', label: 'BASICS', color: 0x9fe8ff },
      { key: 'bonuses', label: 'BONUSES', color: 0x9fe8ff },
      { key: 'details', label: 'DETAILS', color: 0x9fe8ff },
    ], 14, (page) => this.showPage(page, true));
    addAll(this.tabs.parts);
    // The hairline every page hangs from, so the tab row does not read as
    // the first row of the guide's grid.
    add(scene.add.image(cx, 108, SCREEN_PIXEL).setDisplaySize(VIEW.width - 52, 1).setTint(SURFACE.hairline));

    this.guide = new PauseGuide(scene);
    parts.push(this.guide.root);
    this.bonuses = new PauseBonuses(scene);
    parts.push(this.bonuses.root);
    this.details = new PauseDetails(scene);
    parts.push(this.details.root);

    // The one filled button, then SOUND, MUSIC and RESTART as a row of three.
    this.primary = cardButton(scene, cx, ROW.primary, 300, 56, GRADE_COLOR.perfect, 'RESUME', 22)
      .bind(() => onPrimary(this.mode));
    addAll(this.primary.parts);
    this.sound = cardButton(scene, cx - PITCH, ROW.secondary, ROW.third, 44, LINK, 'SOUND ON', 15, 'secondary')
      .bind(onMuteToggle);
    addAll(this.sound.parts);
    this.music = cardButton(scene, cx, ROW.secondary, ROW.third, 44, LINK, 'MUSIC ON', 15, 'secondary')
      .bind(onMusicToggle);
    addAll(this.music.parts);
    this.restart = cardButton(scene, cx + PITCH, ROW.secondary, ROW.third, 44, 0xff4757, 'RESTART', 15, 'danger')
      .bind(onRestart);
    addAll(this.restart.parts);

    this.playing = add(scene.add.text(cx, ROW.playing, '', {
      fontFamily: FONT, fontSize: '14px', color: INK.caption, fontStyle: '600',
    }).setOrigin(0.5).setLetterSpacing(1.5));
    this.keysHint = add(scene.add.text(cx, ROW.hint, 'P or ESC pauses  ·  M sound  ·  N music', {
      fontFamily: FONT, fontSize: '14px', color: INK.caption, fontStyle: '500',
    }).setOrigin(0.5));

    // Hidden until asked for. A container is VISIBLE by default, and an opaque
    // full-screen panel that nobody requested covers the entire game.
    this.root = scene.add.container(0, 0, parts).setDepth(DEPTH.pause).setVisible(false);
    this.showPage('bonuses', false);
  }

  private showPage(page: Page, animate: boolean): void {
    const changed = page !== this.page;
    this.page = page;
    const roots = { guide: this.guide.root, bonuses: this.bonuses.root, details: this.details.root };
    for (const [key, root] of Object.entries(roots)) root.setVisible(key === page);
    this.tabs.set(page);
    const shown = roots[page];
    this.scene.tweens.killTweensOf(shown);
    if (animate && changed) {
      shown.setAlpha(0);
      this.scene.tweens.add({ targets: shown, alpha: 1, duration: MOTION.snap, ease: 'Quad.easeOut' });
    } else {
      shown.setAlpha(1);
    }
  }

  /** The audio strand answers `mutetoggle` with the truth; the label follows it. */
  setMuted(muted: boolean): void {
    this.sound.setLabel(muted ? 'SOUND OFF' : 'SOUND ON');
  }

  /** Same contract for the music: `music` from the audio strand. */
  setMusic(on: boolean): void {
    this.musicOn = on;
    this.music.setLabel(on ? 'MUSIC ON' : 'MUSIC OFF');
    this.drawPlaying();
  }

  /** The track the music is on, from `musictrack`. */
  setTrack(name: string): void {
    this.track = name;
    this.drawPlaying();
  }

  private drawPlaying(): void {
    const t = this.musicOn && this.track ? `NOW PLAYING  ·  ${this.track}` : '';
    if (this.playing.text !== t) this.playing.setText(t);
  }

  update(h: HudPayload): void {
    this.bonuses.update(h);
    this.details.update(h);
  }

  /**
   * `pause` opens on BONUSES - a paused player wants their own numbers -
   * and `guide` on BASICS, with the run controls put away.
   */
  show(h: HudPayload, mode: PauseMode = 'pause'): void {
    const cx = VIEW.width / 2;
    this.mode = mode;
    this.update(h);
    const guide = mode === 'guide';
    this.heading.setText(guide ? 'HOW TO PLAY' : 'PAUSED');
    this.primary.setLabel(guide ? 'BACK' : 'RESUME');
    // RESTART has no run to restart from the start screen; SOUND and
    // MUSIC then stand centred as a pair.
    this.restart.setVisible(!guide);
    this.sound.setX(guide ? cx - PITCH / 2 : cx - PITCH);
    this.music.setX(guide ? cx + PITCH / 2 : cx);
    this.keysHint.setVisible(!guide);
    this.showPage(guide ? 'guide' : 'bonuses', false);
    // Over the start screen (depth 60) when opened from it; under it when
    // a run is paused, so a start screen can never be hidden by a stale
    // pause panel.
    const depth = guide ? DEPTH.guide : DEPTH.pause;
    this.root.setDepth(depth);
    this.backdrop.setDepth(depth);
    if (!this.root.visible) this.backdrop.enter(this.root);
  }

  hide(): void { this.backdrop.hide(this.root); }

  get visible(): boolean { return this.root.visible; }

  get currentPage(): Page { return this.page; }
}
