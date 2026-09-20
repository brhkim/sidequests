import Phaser from 'phaser';
import { VIEW } from '../../config';
import { cardButton } from './CardTile';
import { PauseBonuses } from './PauseBonuses';
import { PauseDetails } from './PauseDetails';
import { CAPTION, FONT, SMALL, type HudPayload } from './types';

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

type Page = 'bonuses' | 'details';

interface Tab {
  page: Page;
  label: Phaser.GameObjects.Text;
  underline: Phaser.GameObjects.Rectangle;
}

/**
 * Pause, and the only place the game explains itself. Two pages:
 *
 * **BONUSES** (`PauseBonuses`) teaches the conversion against the player's
 * own pools and lists everything held. **DETAILS** (`PauseDetails`) is the
 * rail's DPS derived line by line from the strip's numbers.
 *
 * One button, RESUME. RESTART is a text link a full row away from it, in
 * red, so a thumb reaching for RESUME cannot throw the run away. The SOUND
 * line between them is the mute control; it asks, and the audio layer
 * answers with `setMuted`, so the label never claims a state audio is not in.
 *
 * Rejected: a worked table of before/after damage (true, but the player does
 * not care what 15.5 becomes, they care which of two labels is bigger); and
 * colouring the forms differently, which would answer the question for them.
 */
export class PauseScreen {
  private readonly root: Phaser.GameObjects.Container;
  private readonly bonuses: PauseBonuses;
  private readonly details: PauseDetails;
  private readonly tabs: Tab[] = [];
  private readonly sound: Phaser.GameObjects.Text;
  private page: Page = 'bonuses';

  constructor(
    scene: Phaser.Scene, onResume: () => void, onRestart: () => void, onMuteToggle: () => void,
  ) {
    const cx = VIEW.width / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { parts.push(o); return o; };
    // Fixed-width hit bars behind every tappable line, for the reason the
    // start screen's mode toggle has one: the target must not move under the
    // finger when the label changes, and nothing tappable is under 44px.
    const tap = (x: number, y: number, w: number, h: number, on: () => void) => {
      const hit = add(scene.add.rectangle(x, y, w, h, 0xffffff, 0.001).setInteractive({ useHandCursor: true }));
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => { p.event.stopPropagation(); on(); });
    };

    add(scene.add.rectangle(cx, VIEW.height / 2, VIEW.width, VIEW.height, 0x05070f, 1));

    add(scene.add.text(cx, 18, 'PAUSED', {
      fontFamily: FONT, fontSize: '28px', color: '#e8ecf8', fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    for (const [i, spec] of ([['bonuses', 'BONUSES'], ['details', 'DETAILS']] as const).entries()) {
      const x = cx + (i === 0 ? -90 : 90);
      const label = add(scene.add.text(x, 62, spec[1], {
        fontFamily: FONT, fontSize: '17px', color: CAPTION, fontStyle: 'bold',
      }).setOrigin(0.5, 0).setLetterSpacing(1.6));
      const underline = add(scene.add.rectangle(x, 84, 120, 2, 0x9fe8ff, 1).setOrigin(0.5, 0));
      tap(x, 70, 170, 44, () => this.showPage(spec[0]));
      this.tabs.push({ page: spec[0], label, underline });
    }

    this.bonuses = new PauseBonuses(scene);
    parts.push(this.bonuses.root);
    this.details = new PauseDetails(scene);
    parts.push(this.details.root);

    // The one button, in the card's shape like every primary action.
    const resume = cardButton(scene, cx, 740, 300, 56, 0x3ecf7a, 'RESUME');
    for (const p of resume.parts) add(p);
    resume.hit.setInteractive({ useHandCursor: true });
    resume.hit.on('pointerdown', (p: Phaser.Input.Pointer) => { p.event.stopPropagation(); onResume(); });

    this.sound = add(scene.add.text(cx, 800, 'SOUND ON — tap to mute', {
      fontFamily: FONT, fontSize: '15px', color: CAPTION,
    }).setOrigin(0.5));
    tap(cx, 800, 300, 44, onMuteToggle);

    add(scene.add.text(cx, 846, 'RESTART', {
      fontFamily: FONT, fontSize: '17px', color: '#ff4757', fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(1.5));
    tap(cx, 846, 300, 44, onRestart);

    add(scene.add.text(cx, 900, 'P or ESC also pauses and resumes', {
      fontFamily: FONT, fontSize: '15px', color: SMALL,
    }).setOrigin(0.5));

    // Hidden until asked for. A container is VISIBLE by default, and an opaque
    // full-screen panel at depth 55 that nobody requested covers the entire
    // game - which is exactly the bug the start screen shipped.
    this.root = scene.add.container(0, 0, parts).setDepth(55).setVisible(false);
    this.showPage('bonuses');
  }

  private showPage(page: Page): void {
    this.page = page;
    this.bonuses.root.setVisible(page === 'bonuses');
    this.details.root.setVisible(page === 'details');
    for (const t of this.tabs) {
      const on = t.page === page;
      t.label.setColor(on ? '#e8ecf8' : CAPTION);
      t.underline.setVisible(on);
    }
  }

  /** The audio strand answers `mutetoggle` with the truth; the label follows it. */
  setMuted(muted: boolean): void {
    this.sound.setText(muted ? 'SOUND OFF — tap to unmute' : 'SOUND ON — tap to mute');
  }

  update(h: HudPayload): void {
    this.bonuses.update(h);
    this.details.update(h);
  }

  show(h: HudPayload): void {
    this.update(h);
    this.root.setVisible(true);
  }

  hide(): void { this.root.setVisible(false); }

  get visible(): boolean { return this.root.visible; }

  get currentPage(): Page { return this.page; }
}
