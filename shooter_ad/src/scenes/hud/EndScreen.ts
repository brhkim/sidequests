import Phaser from 'phaser';
import { COLORS, VIEW } from '../../config';
import { CAPTION, compact, FONT, GRADE_COLOR, hex, MONO, SMALL } from './types';
import type { MatchMode } from '../../systems/MatchCode';

export interface EndPayload {
  /** What ended the run. A Titan landing is not the same failure as attrition. */
  readonly cause?: 'overrun' | 'titan';
  readonly wave: number;
  readonly kills: number;
  readonly optimal: number;
  /** Highest damage output the run reached. */
  readonly peakDps: number;
  /** Picks by grade, then RISK picks and missed offers in their own columns. */
  readonly tally: { top: number; mid: number; low: number; risk: number; miss: number };
  readonly decisions: number;
  readonly code: string;
  readonly version: string;
  readonly mode: MatchMode;
}

/**
 * Where the replay control is. GameScene hit-tests it in `bindInput` - the
 * end screen used to restart on a tap ANYWHERE, which destroyed the
 * screenshot on the first touch, and a screenshot is the whole medium.
 */
export const REPLAY_BUTTON = { x: VIEW.width / 2, y: 836, width: 300, height: 56 } as const;

const LINK = '#6be8d4';

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
 * without the curve it was measured against. Nothing here is a kicker: every
 * caption sits UNDER the value it names, and the cause of death is the
 * screen's HEADING - the same 28px step PAUSED uses - not a tracked label
 * over the number. Waves survived stays the headline number, with the
 * decision score beneath it (notes.md); PRODUCT.md records the choice.
 */
export class EndScreen {
  private readonly root: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly wave: Phaser.GameObjects.Text;
  private readonly optimal: Phaser.GameObjects.Text;
  private readonly peak: Phaser.GameObjects.Text;
  private readonly tally: Phaser.GameObjects.Text[] = [];
  private readonly detail: Phaser.GameObjects.Text;
  private readonly code: Phaser.GameObjects.Text;
  private readonly codeCaption: Phaser.GameObjects.Text;
  private readonly copyLabel: Phaser.GameObjects.Text;
  private readonly version: Phaser.GameObjects.Text;
  private link = '';

  constructor(private readonly scene: Phaser.Scene, onNewMatch: () => void) {
    const cx = VIEW.width / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { parts.push(o); return o; };
    const text = (y: number, size: number, color: string, bold = true, tracking = 0) =>
      add(scene.add.text(cx, y, '', {
        fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', align: 'center',
      }).setOrigin(0.5).setLetterSpacing(tracking));

    // Fully opaque, deliberately. At 0.93 the bullet stream and both HUD bars
    // bled through, which is wrong for something built to be screenshotted.
    add(scene.add.rectangle(cx, VIEW.height / 2, VIEW.width, VIEW.height, 0x05070f, 1));

    this.title = text(96, 28, '#ff5566');

    // The headline. Integer, instantly comparable, and captures both pick
    // quality and positioning - which a pure decision score would not.
    this.wave = text(196, 112, COLORS.text);
    text(274, 13, CAPTION, true, 2).setText('WAVES SURVIVED');
    // The two secondary captions sit at Small, untracked: one tracked label
    // marks the lead, three identical ones mark nothing.

    // Two scores side by side: the purest measure of the skill the game
    // tests, and the number the skill was for. Peak DPS is the author's
    // ask - the sum is only worth doing if the answer is on the board.
    this.optimal = add(scene.add.text(cx - 110, 346, '', {
      fontFamily: FONT, fontSize: '44px', color: COLORS.text, fontStyle: 'bold',
    }).setOrigin(0.5));
    add(scene.add.text(cx - 110, 384, 'OF OPTIMAL PLAY', {
      fontFamily: FONT, fontSize: '16px', color: SMALL,
    }).setOrigin(0.5));
    this.peak = add(scene.add.text(cx + 110, 346, '', {
      fontFamily: FONT, fontSize: '44px', color: COLORS.text, fontStyle: 'bold',
    }).setOrigin(0.5));
    add(scene.add.text(cx + 110, 384, 'PEAK DPS', {
      fontFamily: FONT, fontSize: '16px', color: SMALL,
    }).setOrigin(0.5));

    // The scorecard in miniature, each count in its grade's colour: what makes
    // two runs on one seed worth arguing about. RISK and MISS have their own
    // columns - a gamble and a gate driven past are not a wrong sum.
    for (const dx of [-168, -84, 0, 84, 168]) {
      this.tally.push(add(scene.add.text(cx + dx, 440, '', {
        fontFamily: FONT, fontSize: '26px', fontStyle: 'bold',
      }).setOrigin(0.5)));
    }
    for (const dx of [-126, -42, 42, 126]) {
      add(scene.add.text(cx + dx, 440, '·', {
        fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: SMALL,
      }).setOrigin(0.5));
    }
    text(474, 14, SMALL, false).setText('PERFECT  ·  GOOD  ·  BAD  ·  RISK  ·  MISS');

    this.detail = text(520, 16, CAPTION, false);

    add(scene.add.rectangle(cx, 572, 420, 1, 0x2a3350));

    // Large on purpose. This is the half of the screenshot that makes the run
    // playable by somebody else rather than merely a claim. The caption names
    // the difficulty, because a hard run is not the same match as a normal one
    // on the same seed and a reader should not have to decode base32 to see it.
    this.code = add(scene.add.text(cx, 620, '', {
      fontFamily: MONO, fontSize: '40px', color: '#9fe8ff', fontStyle: 'bold',
    }).setOrigin(0.5));
    this.codeCaption = text(664, 13, CAPTION, false);

    // Tappable lines get a fixed hit BAR behind them rather than the text's own
    // bounds: the label changes length when it changes state, and a text
    // sized target moves out from under the finger that just tapped it.
    this.copyLabel = text(712, 16, LINK, false).setText('tap here to copy link');
    const copyHit = add(scene.add.rectangle(cx, 712, 300, 44, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true }));
    copyHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      this.copyLink();
    });

    // Seeds only compare within a version. Without this people compare scores
    // from different games and conclude the leaderboard is broken.
    this.version = text(756, 12, SMALL, false);

    // Replay, as a BUTTON rather than a tap anywhere. Not interactive here:
    // GameScene owns the hit test (see REPLAY_BUTTON) and SPACE still works.
    add(scene.add.rectangle(cx, REPLAY_BUTTON.y, REPLAY_BUTTON.width, REPLAY_BUTTON.height, 0x3ecf7a, 0.2)
      .setStrokeStyle(2, 0x3ecf7a, 0.9));
    add(scene.add.text(cx, REPLAY_BUTTON.y, 'REPLAY THIS MATCH', {
      fontFamily: FONT, fontSize: '22px', color: '#3ecf7a', fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(1));
    text(900, 15, LINK, false).setText('or start a new match');
    const freshHit = add(scene.add.rectangle(cx, 900, 300, 44, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true }));
    freshHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      onNewMatch();
    });

    this.root = scene.add.container(0, 0, parts).setDepth(50).setVisible(false);
  }

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
    this.title.setText(p.cause === 'titan' ? 'THE TITAN LANDED' : 'OVERRUN');
    this.wave.setText(String(p.wave));

    const pct = Math.round(p.optimal * 100);
    const grade = pct >= 90 ? GRADE_COLOR.perfect : pct >= 70 ? GRADE_COLOR.good : GRADE_COLOR.bad;
    this.optimal.setText(`${pct}%`).setColor(hex(grade));

    this.peak.setText(compact(p.peakDps));

    const { top, mid, low, risk, miss } = p.tally;
    this.tally[0].setText(String(top)).setColor(hex(GRADE_COLOR.perfect));
    this.tally[1].setText(String(mid)).setColor(hex(GRADE_COLOR.good));
    this.tally[2].setText(String(low)).setColor(hex(GRADE_COLOR.bad));
    this.tally[3].setText(String(risk)).setColor(hex(GRADE_COLOR.risk));
    this.tally[4].setText(String(miss)).setColor(CAPTION);

    this.detail.setText(
      p.decisions > 0
        ? `${p.decisions} decisions  ·  ${p.kills} enemies destroyed`
        : `${p.kills} enemies destroyed`,
    );
    this.code.setText(p.code);
    const hard = p.mode === 'hard';
    this.codeCaption.setText(hard ? 'same match  ·  HARD  ·  type this in' : 'same match  ·  type this in');
    this.codeCaption.setColor(hard ? '#ff7b54' : CAPTION);
    this.version.setText(`v${p.version}  ·  scores compare within a version`);

    // Enters rather than cuts: the death beat has just darkened the field.
    this.scene.tweens.killTweensOf(this.root);
    this.root.setAlpha(0).setVisible(true);
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 200, ease: 'Quad.easeOut' });
  }

  hide(): void {
    this.scene.tweens.killTweensOf(this.root);
    this.root.setVisible(false).setAlpha(1);
  }
}
