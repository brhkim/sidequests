import Phaser from 'phaser';
import { COLORS, VIEW } from '../../config';
import { decodeMatch, type Match, type MatchMode } from '../../systems/MatchCode';

export interface StartPayload {
  readonly code: string;
  readonly version: string;
  readonly mode: MatchMode;
  /** True when the match came from a shared link rather than a fresh run. */
  readonly invited: boolean;
}

const FONT = 'system-ui, sans-serif';

/**
 * The screen a shared link lands on, and the only place a match is chosen.
 *
 * It deliberately does NOT auto-start. Somebody following a stranger's link
 * should see what they are about to play before it starts - a run that begins
 * while you are still reading the code is a run you immediately restart, and
 * the first second of a shared match is the one that decides whether the link
 * was worth following. Same single tap either way; better first second.
 *
 * It is also where the match code gets confirmed, which matters because the
 * code is the shareable unit and a player who never sees one will not think to
 * pass it on - and where one gets ENTERED, because the medium is a screenshot
 * and a screenshot loses the link. A code you can read off a photo but cannot
 * type in anywhere is decoration.
 *
 * The pitch is the author's, near enough verbatim. It says what the game is
 * FOR before the first offer arrives, because a player who does not know they
 * are being tested on arithmetic reads every offer as noise.
 */
export class StartScreen {
  private readonly root: Phaser.GameObjects.Container;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly code: Phaser.GameObjects.Text;
  private readonly version: Phaser.GameObjects.Text;
  private readonly mode: Phaser.GameObjects.Text;
  private readonly enterHint: Phaser.GameObjects.Text;
  /** What the button would start right now, which the code above reflects. */
  private current: MatchMode = 'normal';

  constructor(
    scene: Phaser.Scene,
    onStart: () => void,
    onModeChange: (mode: MatchMode) => void,
    /** `null` asks for a fresh random match; a `Match` is one the player typed. */
    onMatchRequest: (match: Match | null) => void,
  ) {
    const cx = VIEW.width / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { parts.push(o); return o; };

    add(scene.add.rectangle(cx, VIEW.height / 2, VIEW.width, VIEW.height, 0x05070f, 1));

    add(scene.add.text(cx, 118, 'DPS GOLF', {
      fontFamily: FONT, fontSize: '54px', color: COLORS.text, fontStyle: 'bold',
    }).setOrigin(0.5));

    // The pitch. Four beats, each on its own line group so the eye can take
    // them one at a time: the job, the threat, the warning, the escalation.
    const line = (y: number, text: string, color: string, size = 17) =>
      add(scene.add.text(cx, y, text, {
        fontFamily: FONT, fontSize: `${size}px`, color, align: 'center',
      }).setOrigin(0.5, 0).setLineSpacing(5));
    line(166, 'Pick the best bonuses, avoid damage,\nand kill the Titan before it reaches\nthe end — or you lose.', '#c9d2ea');
    line(250, 'Oh, and sub-optimal play is SEVERELY punished.', '#ff7b54');
    line(280, 'The math only gets harder.\nThe bonuses only scroll at you faster.', '#8f9ab5');
    line(334, 'Have fun!', '#3ecf7a', 18);

    this.heading = add(scene.add.text(cx, 392, '', {
      fontFamily: FONT, fontSize: '13px', color: '#6f7a94', fontStyle: 'bold',
    }).setOrigin(0.5));

    this.code = add(scene.add.text(cx, 432, '', {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '34px', color: '#9fe8ff', fontStyle: 'bold',
    }).setOrigin(0.5));

    // Two small controls under the code: type a friend's code, or roll a new
    // one. Both go through GameScene, which owns the seed, and the screen
    // redraws from the `showstart` that comes back.
    this.enterHint = add(scene.add.text(cx - 70, 470, 'enter a code', {
      fontFamily: FONT, fontSize: '14px', color: '#6be8d4',
    }).setOrigin(0.5));
    const enterHit = add(scene.add.rectangle(cx - 70, 470, 130, 34, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true }));
    enterHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      this.promptForCode(onMatchRequest);
    });
    add(scene.add.text(cx + 70, 470, 'new match', {
      fontFamily: FONT, fontSize: '14px', color: '#6be8d4',
    }).setOrigin(0.5));
    const newHit = add(scene.add.rectangle(cx + 70, 470, 130, 34, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true }));
    newHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      onMatchRequest(null);
    });

    // Difficulty, above the button rather than below it, and TAPPABLE.
    //
    // Two jobs in one control. A shared code carries its mode, so somebody
    // following a link is about to play a difficulty they did not pick, and the
    // moment to learn that is before tapping rather than from a run that feels
    // wrong for reasons they cannot name. And this screen is the only place a
    // mode can be chosen at all - a hard mode reachable solely by hand-editing
    // a query string is a mode no player will ever see.
    //
    // Switching REWRITES the code above it, because a hard run is not the same
    // match as a normal one on the same seed. What is on screen stays the truth
    // about what the button will start.
    this.mode = add(scene.add.text(cx, 540, '', {
      fontFamily: FONT, fontSize: '15px', color: '#8f9ab5', fontStyle: 'bold',
    }).setOrigin(0.5));
    // The hit area is a fixed bar rather than the text's own bounds: the label
    // changes length when the mode does, so a text-sized target would move out
    // from under the finger that just tapped it.
    const modeHit = add(scene.add.rectangle(cx, 540, VIEW.width - 60, 40, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true }));
    modeHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      onModeChange(this.current === 'hard' ? 'normal' : 'hard');
    });
    add(scene.add.text(cx, 568, 'tap to change difficulty', {
      fontFamily: FONT, fontSize: '12px', color: '#4d5670',
    }).setOrigin(0.5));

    const button = add(scene.add.rectangle(cx, 640, 260, 62, 0x3ecf7a, 0.16)
      .setStrokeStyle(2, 0x3ecf7a, 0.9)
      .setInteractive({ useHandCursor: true }));
    add(scene.add.text(cx, 640, 'START MATCH', {
      fontFamily: FONT, fontSize: '22px', color: '#3ecf7a', fontStyle: 'bold',
    }).setOrigin(0.5));
    button.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      onStart();
    });

    add(scene.add.text(cx, 712, 'pause the run for how every bonus works', {
      fontFamily: FONT, fontSize: '12px', color: '#4d5670',
    }).setOrigin(0.5));

    this.version = add(scene.add.text(cx, 740, '', {
      fontFamily: FONT, fontSize: '12px', color: '#4d5670',
    }).setOrigin(0.5));

    // Hidden until `show`. A container is visible by default, and an opaque
    // panel at depth 60 that nobody asked for covers the entire game - which is
    // exactly what happened on every `?seed=` run, where GameScene returns
    // before emitting 'showstart' and this was therefore never shown OR hidden.
    this.root = scene.add.container(0, 0, parts).setDepth(60).setVisible(false);
  }

  /**
   * A native prompt rather than an on-screen keyboard: it brings up the
   * phone's own keyboard, the code is eight characters, and `decodeMatch`
   * already forgives case, punctuation and the glyphs people misread off a
   * photo. A refusal (a sandboxed frame, or a closed prompt) leaves the current
   * match exactly as it was; a bad code says so under the code, briefly.
   */
  private promptForCode(onMatchRequest: (match: Match | null) => void): void {
    let typed: string | null = null;
    try {
      typed = window.prompt('Match code (e.g. 7K2P-9XQ4-N)');
    } catch {
      typed = null;
    }
    if (typed === null || typed.trim() === '') return;
    const match = decodeMatch(typed);
    if (match) {
      onMatchRequest(match);
      return;
    }
    this.enterHint.setText('not a match code').setColor('#ff7b54');
    this.enterHint.scene.time.delayedCall(1600, () => {
      this.enterHint.setText('enter a code').setColor('#6be8d4');
    });
  }

  show(p: StartPayload): void {
    this.heading.setText(p.invited ? 'YOU WERE SENT THIS MATCH' : 'YOUR MATCH');
    this.code.setText(p.code);
    // Named on both screens, never left implicit. Hard mode changes how fast
    // offers descend and how awkward their numbers are - both invisible until
    // you are already inside a run.
    this.current = p.mode;
    const hard = p.mode === 'hard';
    this.mode.setText(hard ? 'HARD — FAST OFFERS, AWKWARD NUMBERS' : 'NORMAL');
    this.mode.setColor(hard ? '#ff7b54' : '#8f9ab5');
    this.version.setText(`v${p.version}`);
    this.root.setVisible(true);
  }

  hide(): void { this.root.setVisible(false); }
}
