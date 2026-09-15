import Phaser from 'phaser';
import { COLORS, VIEW } from '../../config';

export interface StartPayload {
  readonly code: string;
  readonly version: string;
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

  constructor(scene: Phaser.Scene, onStart: () => void) {
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

    const button = scene.add.rectangle(cx, 580, 260, 62, 0x3ecf7a, 0.16)
      .setStrokeStyle(2, 0x3ecf7a, 0.9)
      .setInteractive({ useHandCursor: true });
    const buttonText = scene.add.text(cx, 580, 'START MATCH', {
      fontFamily: font, fontSize: '22px', color: '#3ecf7a', fontStyle: 'bold',
    }).setOrigin(0.5);
    button.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      onStart();
    });

    this.version = scene.add.text(cx, 660, '', {
      fontFamily: font, fontSize: '12px', color: '#4d5670',
    }).setOrigin(0.5);

    this.root = scene.add.container(0, 0, [
      panel, title, pitch, this.heading, this.code, button, buttonText, this.version,
    ]).setDepth(60);
  }

  show(p: StartPayload): void {
    this.heading.setText(p.invited ? 'YOU WERE SENT THIS MATCH' : 'YOUR MATCH');
    this.code.setText(p.code);
    this.version.setText(`v${p.version}`);
    this.root.setVisible(true);
  }

  hide(): void { this.root.setVisible(false); }
}
