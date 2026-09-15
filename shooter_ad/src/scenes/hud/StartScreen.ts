import Phaser from 'phaser';
import { COLORS, VIEW } from '../../config';
import type { MatchMode } from '../../systems/MatchCode';

export interface StartPayload {
  readonly code: string;
  readonly version: string;
  readonly mode: MatchMode;
  /** True when the match came from a shared link rather than a fresh run. */
  readonly invited: boolean;
}

/**
 * The screen a shared link lands on.
 *
 * It deliberately does NOT auto-start. Somebody following a stranger's link
 * should see what they are about to play before it starts - a run that begins
 * while you are still reading the code is a run you immediately restart, and
 * the first second of a shared match is the one that decides whether the link
 * was worth following. Same single tap either way; better first second.
 *
 * It is also where the match code gets confirmed, which matters because the
 * code is the shareable unit and a player who never sees one will not think to
 * pass it on.
 */
export class StartScreen {
  private readonly root: Phaser.GameObjects.Container;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly code: Phaser.GameObjects.Text;
  private readonly version: Phaser.GameObjects.Text;
  private readonly mode: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  /** What the button would start right now, which the code above reflects. */
  private current: MatchMode = 'normal';

  constructor(
    scene: Phaser.Scene,
    onStart: () => void,
    onModeChange: (mode: MatchMode) => void,
  ) {
    const cx = VIEW.width / 2;
    const font = 'system-ui, sans-serif';

    const panel = scene.add.rectangle(cx, VIEW.height / 2, VIEW.width, VIEW.height, 0x05070f, 1);

    const title = scene.add.text(cx, 250, 'DPS GOLF', {
      fontFamily: font, fontSize: '56px', color: COLORS.text, fontStyle: 'bold',
    }).setOrigin(0.5);

    // One line, because the mechanic is the whole game and a player who does
    // not know it is being tested reads every offer as noise.
    const pitch = scene.add.text(
      cx, 316, 'three bonuses, a few seconds,\npick the one worth most',
      { fontFamily: font, fontSize: '19px', color: '#8f9ab5', align: 'center' },
    ).setOrigin(0.5).setLineSpacing(6);

    this.heading = scene.add.text(cx, 430, '', {
      fontFamily: font, fontSize: '13px', color: '#6f7a94', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.code = scene.add.text(cx, 472, '', {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '34px', color: '#9fe8ff', fontStyle: 'bold',
    }).setOrigin(0.5);

    const button = scene.add.rectangle(cx, 624, 260, 62, 0x3ecf7a, 0.16)
      .setStrokeStyle(2, 0x3ecf7a, 0.9)
      .setInteractive({ useHandCursor: true });
    const buttonText = scene.add.text(cx, 624, 'START MATCH', {
      fontFamily: font, fontSize: '22px', color: '#3ecf7a', fontStyle: 'bold',
    }).setOrigin(0.5);
    button.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      onStart();
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
    this.mode = scene.add.text(cx, 528, '', {
      fontFamily: font, fontSize: '15px', color: '#8f9ab5', fontStyle: 'bold',
    }).setOrigin(0.5);
    // The hit area is a fixed bar rather than the text's own bounds: the label
    // changes length when the mode does, so a text-sized target would move out
    // from under the finger that just tapped it.
    const modeHit = scene.add.rectangle(cx, 528, VIEW.width - 60, 40, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    modeHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      onModeChange(this.current === 'hard' ? 'normal' : 'hard');
    });

    this.hint = scene.add.text(cx, 556, 'tap to change difficulty', {
      fontFamily: font, fontSize: '12px', color: '#4d5670',
    }).setOrigin(0.5);

    this.version = scene.add.text(cx, 704, '', {
      fontFamily: font, fontSize: '12px', color: '#4d5670',
    }).setOrigin(0.5);

    // Hidden until `show`. A container is visible by default, and an opaque
    // panel at depth 60 that nobody asked for covers the entire game - which is
    // exactly what happened on every `?seed=` run, where GameScene returns
    // before emitting 'showstart' and this was therefore never shown OR hidden.
    this.root = scene.add.container(0, 0, [
      panel, title, pitch, this.heading, this.code, this.mode, modeHit, this.hint,
      button, buttonText, this.version,
    ]).setDepth(60).setVisible(false);
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
