import Phaser from 'phaser';
import { VIEW } from '../../config';
import { cardButton, segmented, type CardButton } from './CardTile';
import { PauseBonuses } from './PauseBonuses';
import { PauseDetails } from './PauseDetails';
import { PauseGuide } from './PauseGuide';
import { FONT, LINK, SMALL, type HudPayload } from './types';

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

/**
 * Pause, and the only place the game explains itself. Three pages:
 *
 * **HOW TO PLAY** (`PauseGuide`) is the game for somebody who has never
 * seen it, one tappable topic at a time. **BONUSES** (`PauseBonuses`)
 * teaches the conversion against the player's own pools and lists
 * everything held. **DETAILS** (`PauseDetails`) is the rail's DPS derived
 * line by line from the strip's numbers.
 *
 * The same screen opens from the start screen's HOW TO PLAY (`mode:
 * 'guide'`): the heading says so, the primary button reads BACK, and there
 * is no run to restart. One set of explainers, reachable before and during
 * a run (the author's ask, 2026-09-20).
 *
 * One filled button, RESUME. RESTART is a red card a row beneath it, beside
 * SOUND, so a thumb reaching for RESUME cannot throw the run away. The
 * SOUND button is the mute control; it asks, and the audio layer answers
 * with `setMuted`, so the label never claims a state audio is not in.
 *
 * Rejected: a worked table of before/after damage (true, but the player does
 * not care what 15.5 becomes, they care which of two labels is bigger); and
 * colouring the forms differently, which would answer the question for them.
 */
export class PauseScreen {
  private readonly root: Phaser.GameObjects.Container;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly guide: PauseGuide;
  private readonly bonuses: PauseBonuses;
  private readonly details: PauseDetails;
  private readonly tabs: ReturnType<typeof segmented<Page>>;
  private readonly primary: CardButton;
  private readonly sound: CardButton;
  private readonly restart: CardButton;
  private readonly keysHint: Phaser.GameObjects.Text;
  private page: Page = 'bonuses';
  private mode: PauseMode = 'pause';

  constructor(
    scene: Phaser.Scene,
    /** RESUME on pause; BACK from the start screen's guide. */
    onPrimary: (mode: PauseMode) => void,
    onRestart: () => void, onMuteToggle: () => void,
  ) {
    const cx = VIEW.width / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { parts.push(o); return o; };
    const addAll = (os: Phaser.GameObjects.GameObject[]) => { for (const o of os) add(o); };

    add(scene.add.rectangle(cx, VIEW.height / 2, VIEW.width, VIEW.height, 0x05070f, 1));

    this.heading = add(scene.add.text(cx, 14, 'PAUSED', {
      fontFamily: FONT, fontSize: '28px', color: '#e8ecf8', fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    // Three tabs as a segmented row: the lit card is the page.
    this.tabs = segmented<Page>(scene, cx, 74, 164, 40, 4, [
      { key: 'guide', label: 'BASICS', color: 0x9fe8ff },
      { key: 'bonuses', label: 'BONUSES', color: 0x9fe8ff },
      { key: 'details', label: 'DETAILS', color: 0x9fe8ff },
    ], 14, (page) => this.showPage(page));
    addAll(this.tabs.parts);
    // The hairline every page hangs from, so the tab row does not read as
    // the first row of the guide's grid.
    add(scene.add.rectangle(cx, 100, VIEW.width - 52, 1, 0x2a3350));

    this.guide = new PauseGuide(scene);
    parts.push(this.guide.root);
    this.bonuses = new PauseBonuses(scene);
    parts.push(this.bonuses.root);
    this.details = new PauseDetails(scene);
    parts.push(this.details.root);

    // The one filled button, in the card's shape like every primary action,
    // then SOUND and RESTART as a row of two beneath it.
    this.primary = cardButton(scene, cx, 740, 300, 56, 0x3ecf7a, 'RESUME')
      .bind(() => onPrimary(this.mode));
    addAll(this.primary.parts);
    this.sound = cardButton(scene, cx - 96, 806, 184, 44, LINK, 'SOUND ON', 15, 'secondary')
      .bind(onMuteToggle);
    addAll(this.sound.parts);
    this.restart = cardButton(scene, cx + 96, 806, 184, 44, 0xff4757, 'RESTART', 15, 'danger')
      .bind(onRestart);
    addAll(this.restart.parts);

    this.keysHint = add(scene.add.text(cx, 856, 'P or ESC also pauses and resumes  ·  M mutes', {
      fontFamily: FONT, fontSize: '14px', color: SMALL,
    }).setOrigin(0.5));

    // Hidden until asked for. A container is VISIBLE by default, and an opaque
    // full-screen panel at depth 55 that nobody requested covers the entire
    // game - which is exactly the bug the start screen shipped.
    this.root = scene.add.container(0, 0, parts).setDepth(55).setVisible(false);
    this.showPage('bonuses');
  }

  private showPage(page: Page): void {
    this.page = page;
    this.guide.root.setVisible(page === 'guide');
    this.bonuses.root.setVisible(page === 'bonuses');
    this.details.root.setVisible(page === 'details');
    this.tabs.set(page);
  }

  /** The audio strand answers `mutetoggle` with the truth; the label follows it. */
  setMuted(muted: boolean): void {
    this.sound.setLabel(muted ? 'SOUND OFF' : 'SOUND ON');
  }

  update(h: HudPayload): void {
    this.bonuses.update(h);
    this.details.update(h);
  }

  /**
   * `pause` opens on BONUSES - a paused player wants their own numbers -
   * and `guide` on HOW TO PLAY, with the run controls put away.
   */
  show(h: HudPayload, mode: PauseMode = 'pause'): void {
    const cx = VIEW.width / 2;
    this.mode = mode;
    this.update(h);
    const guide = mode === 'guide';
    this.heading.setText(guide ? 'HOW TO PLAY' : 'PAUSED');
    this.primary.setLabel(guide ? 'BACK' : 'RESUME');
    // RESTART has no run to restart from the start screen; the row keeps
    // SOUND centred on its own.
    this.restart.hit.setVisible(!guide);
    for (const p of this.restart.parts) (p as Phaser.GameObjects.Rectangle).setVisible(!guide);
    // Every part of the button shares one x; the row's slot, or the centre.
    for (const p of this.sound.parts) (p as Phaser.GameObjects.Rectangle).x = guide ? cx : cx - 96;
    this.keysHint.setVisible(!guide);
    this.showPage(guide ? 'guide' : 'bonuses');
    // Over the start screen (depth 60) when opened from it; under it when
    // a run is paused, so a start screen can never be hidden by a stale
    // pause panel.
    this.root.setDepth(guide ? 65 : 55);
    this.root.setVisible(true);
  }

  hide(): void { this.root.setVisible(false); }

  get visible(): boolean { return this.root.visible; }

  get currentPage(): Page { return this.page; }
}
