import Phaser from 'phaser';
import { COLORS, VIEW } from '../../config';
import { hex } from './types';
import type { MatchMode } from '../../systems/MatchCode';

export interface EndPayload {
  /** What ended the run. A Titan landing is not the same failure as attrition. */
  readonly cause?: 'overrun' | 'titan';
  readonly wave: number;
  readonly kills: number;
  readonly optimal: number;
  readonly tally: { top: number; mid: number; low: number };
  readonly decisions: number;
  readonly code: string;
  readonly version: string;
  readonly mode: MatchMode;
}

const GREEN = 0x3ecf7a;
const AMBER = 0xffc93c;
const RED = 0xff4757;

/**
 * The end screen, laid out as the thing people actually share.
 *
 * It has two jobs that pull against each other - results page and social post -
 * and the resolution is to make the shareable version the DEFAULT rather than a
 * separate export. People screenshot runs; a screenshot loses the clipboard, so
 * the match code has to be on screen at a size readable off a photo, and the
 * first screenful has to be the part worth photographing.
 *
 * Order is deliberate: score, then how well you actually played, then the
 * evidence, then how to play the same match. A bare wave number means nothing
 * without the curve it was measured against.
 */
export class EndScreen {
  private readonly root: Phaser.GameObjects.Container;
  private readonly wave: Phaser.GameObjects.Text;
  private readonly optimal: Phaser.GameObjects.Text;
  private readonly tally: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private readonly code: Phaser.GameObjects.Text;
  private readonly codeLabel: Phaser.GameObjects.Text;
  private readonly version: Phaser.GameObjects.Text;
  private readonly copyLabel: Phaser.GameObjects.Text;
  private readonly title: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const cx = VIEW.width / 2;
    const font = 'system-ui, sans-serif';

    // Fully opaque, deliberately. At 0.93 the bullet stream and both HUD bars
    // bled through, which is fine for a results overlay and wrong for something
    // built to be screenshotted - the shareable image carried visual noise from
    // a context the viewer is no longer in.
    const panel = scene.add.rectangle(cx, VIEW.height / 2, VIEW.width, VIEW.height, 0x05070f, 1);

    this.title = scene.add.text(cx, 150, 'OVERRUN', {
      fontFamily: font, fontSize: '30px', color: '#ff5566', fontStyle: 'bold',
    }).setOrigin(0.5);

    // The headline. Integer, instantly comparable, and captures both pick
    // quality and positioning - which a pure decision score would not.
    this.wave = scene.add.text(cx, 232, '', {
      fontFamily: font, fontSize: '104px', color: COLORS.text, fontStyle: 'bold',
    }).setOrigin(0.5);
    const waveLabel = scene.add.text(cx, 300, 'WAVES SURVIVED', {
      fontFamily: font, fontSize: '15px', color: '#6f7a94', fontStyle: 'bold',
    }).setOrigin(0.5);

    // The purest measure of the skill the game actually tests.
    this.optimal = scene.add.text(cx, 366, '', {
      fontFamily: font, fontSize: '40px', fontStyle: 'bold',
    }).setOrigin(0.5);
    const optimalLabel = scene.add.text(cx, 404, 'OF OPTIMAL PLAY', {
      fontFamily: font, fontSize: '15px', color: '#6f7a94', fontStyle: 'bold',
    }).setOrigin(0.5);

    // The scorecard in miniature: what makes two runs on one seed worth arguing
    // about, rather than two numbers with no account of how they happened.
    this.tally = scene.add.text(cx, 462, '', {
      fontFamily: font, fontSize: '26px', fontStyle: 'bold',
    }).setOrigin(0.5);
    const tallyLabel = scene.add.text(cx, 494, 'BEST  ·  MIDDLE  ·  WORST PICKS', {
      fontFamily: font, fontSize: '13px', color: '#6f7a94', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.detail = scene.add.text(cx, 540, '', {
      fontFamily: font, fontSize: '16px', color: '#8f9ab5', align: 'center',
    }).setOrigin(0.5);

    const rule = scene.add.rectangle(cx, 600, VIEW.width - 120, 1, 0x2a3350);

    // The label carries the difficulty, because "SAME MATCH" is a promise and
    // a hard run is not the same match as a normal one on the same seed. The
    // code itself already differs in its last group, but a reader comparing two
    // screenshots should not have to decode base32 to notice.
    this.codeLabel = scene.add.text(cx, 634, '', {
      fontFamily: font, fontSize: '13px', color: '#6f7a94', fontStyle: 'bold',
    }).setOrigin(0.5);
    // Large on purpose. This is the half of the screenshot that makes the run
    // playable by somebody else rather than merely a claim.
    this.code = scene.add.text(cx, 676, '', {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '38px', color: '#9fe8ff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.copyLabel = scene.add.text(cx, 730, 'tap here to copy link', {
      fontFamily: font, fontSize: '16px', color: '#6be8d4',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.copyLabel.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // Stop the tap also restarting the run underneath.
      p.event.stopPropagation();
      this.copyLink();
    });

    // Seeds only compare within a version. Without this people compare scores
    // from different games and conclude the leaderboard is broken.
    this.version = scene.add.text(cx, 776, '', {
      fontFamily: font, fontSize: '12px', color: '#4d5670',
    }).setOrigin(0.5);

    const hint = scene.add.text(cx, 860, 'tap anywhere to play again', {
      fontFamily: font, fontSize: '17px', color: '#8f9ab5',
    }).setOrigin(0.5);

    this.root = scene.add.container(0, 0, [
      panel, this.title, this.wave, waveLabel, this.optimal, optimalLabel,
      this.tally, tallyLabel, this.detail, rule, this.codeLabel, this.code,
      this.copyLabel, this.version, hint,
    ]).setDepth(50).setVisible(false);
  }

  private link = '';

  /**
   * Clipboard access needs a secure context and is refused outright in a
   * sandboxed iframe, so this is the convenience path and never the only one -
   * the code is on screen at photo-readable size for exactly this reason.
   * A failure is expected, not exceptional, and says so without alarm.
   */
  private copyLink(): void {
    const done = (msg: string) => this.copyLabel.setText(msg);
    try {
      navigator.clipboard.writeText(this.link)
        .then(() => done('link copied'))
        .catch(() => done('type the code above'));
    } catch {
      done('type the code above');
    }
  }

  show(p: EndPayload, link: string): void {
    this.link = link;
    this.copyLabel.setText('tap here to copy link');
    this.wave.setText(String(p.wave));
    this.title.setText(p.cause === 'titan' ? 'THE TITAN LANDED' : 'OVERRUN');

    const pct = Math.round(p.optimal * 100);
    const grade = pct >= 90 ? GREEN : pct >= 70 ? AMBER : RED;
    this.optimal.setText(`${pct}%`).setColor(hex(grade));

    const { top, mid, low } = p.tally;
    this.tally.setText(`${top}  ·  ${mid}  ·  ${low}`)
      .setColor(hex(low > top ? RED : top >= mid + low ? GREEN : AMBER));

    this.detail.setText(
      p.decisions > 0
        ? `${p.decisions} decisions  ·  ${p.kills} enemies destroyed`
        : `${p.kills} enemies destroyed`,
    );
    this.code.setText(p.code);
    const hard = p.mode === 'hard';
    this.codeLabel.setText(hard ? 'SAME MATCH  ·  HARD' : 'SAME MATCH');
    this.codeLabel.setColor(hard ? '#ff7b54' : '#6f7a94');
    this.version.setText(`v${p.version}  ·  scores compare within a version`);
    this.root.setVisible(true);
  }

  hide(): void { this.root.setVisible(false); }
}
