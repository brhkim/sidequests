import Phaser from 'phaser';
import { COLORS, VIEW } from '../../config';
import { CardTile, cardButton, type CardButton } from './CardTile';
import { CAPTION, compact, FONT, GRADE_COLOR, LINK, MONO, SMALL, WARNING } from './types';
import { standingColor } from './TopRail';
import type { MatchMode } from '../../systems/MatchCode';

export interface EndPayload {
  /** What ended the run. A Titan landing is not the same failure as attrition. */
  readonly cause?: 'overrun' | 'titan';
  readonly wave: number;
  readonly kills: number;
  readonly optimal: number;
  /** Highest damage output the run reached. */
  readonly peakDps: number;
  /** You against par, one point per wave and one at the end. */
  readonly series: readonly { t: number; wave: number; standing: number }[];
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

/** The standing plot's frame; the peak DPS stat sits to its right. */
const PLOT = { x: 62, y: 310, width: 270, height: 80 } as const;
const PEAK_X = 440;

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
 *
 * Captions are in plain words (the author, 2026-09-20): "of the best
 * picks" rather than "of optimal play", "peak damage / sec" rather than
 * "peak DPS". The grade words stay, because they are what the wash said
 * during the run. COPY LINK and NEW MATCH are card buttons.
 */
export class EndScreen {
  private readonly root: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly wave: Phaser.GameObjects.Text;
  private readonly plot: Phaser.GameObjects.Graphics;
  private readonly plotLabels: Phaser.GameObjects.Text[] = [];
  private readonly peak: Phaser.GameObjects.Text;
  private readonly tally: CardTile[] = [];
  private readonly detail: Phaser.GameObjects.Text;
  private readonly code: Phaser.GameObjects.Text;
  private readonly codeCaption: Phaser.GameObjects.Text;
  private readonly copy: CardButton;
  private readonly version: Phaser.GameObjects.Text;
  private link = '';
  private countTween: Phaser.Tweens.Tween | null = null;

  constructor(private readonly scene: Phaser.Scene, onNewMatch: () => void) {
    const cx = VIEW.width / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { parts.push(o); return o; };
    const addAll = (os: Phaser.GameObjects.GameObject[]) => { for (const o of os) add(o); };
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

    // The run against par, as a line: x is time, y is your DPS as a share
    // of par's, a dashed line at 100% and a dot per wave (1.5, the author's
    // ask, in place of "% of the growth on offer", which read 0% for a run
    // that was hit a lot late). Beside it, the number the skill was for:
    // peak DPS, on the three-figure ladder.
    this.plot = add(scene.add.graphics());
    for (let i = 0; i < 3; i++) {
      this.plotLabels.push(add(scene.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: '11px', color: SMALL, fontStyle: 'bold',
      }).setOrigin(1, 0.5)));
    }
    add(scene.add.text(PLOT.x + PLOT.width / 2, 400, 'YOU VS PAR, BY WAVE', {
      fontFamily: FONT, fontSize: '13px', color: SMALL,
    }).setOrigin(0.5));
    this.peak = add(scene.add.text(PEAK_X, 346, '', {
      fontFamily: FONT, fontSize: '36px', color: COLORS.text, fontStyle: 'bold',
    }).setOrigin(0.5));
    add(scene.add.text(PEAK_X, 384, 'PEAK DAMAGE / SEC', {
      fontFamily: FONT, fontSize: '13px', color: SMALL,
    }).setOrigin(0.5));

    // The scorecard: five card footprints in the grade colours, the pick
    // wash's own vocabulary, each with its count over its word, so the row
    // reads off a photo. INVEST and MISS have their own footprints - a
    // gamble and a gate driven past are not a wrong sum. A count of zero
    // sits dim.
    const words = ['PERFECT', 'GOOD', 'BAD', 'INVEST', 'MISS'] as const;
    const colors = [GRADE_COLOR.perfect, GRADE_COLOR.good, GRADE_COLOR.bad, GRADE_COLOR.risk, 0x8f9ab5];
    [-192, -96, 0, 96, 192].forEach((dx, i) => {
      const tile = new CardTile(scene, cx + dx, 446, colors[i], 88, 64);
      tile.set('0', words[i]);
      for (const p of tile.parts) add(p);
      this.tally.push(tile);
    });
    add(scene.add.text(cx, 490, 'every card you took, graded against the best of its three', {
      fontFamily: FONT, fontSize: '13px', color: SMALL,
    }).setOrigin(0.5));

    this.detail = text(522, 16, CAPTION, false);

    add(scene.add.rectangle(cx, 566, 420, 1, 0x2a3350));

    // Large on purpose. This is the half of the screenshot that makes the run
    // playable by somebody else rather than merely a claim. The caption names
    // the difficulty, because a hard run is not the same match as a normal one
    // on the same seed and a reader should not have to decode base32 to see it.
    this.code = add(scene.add.text(cx, 610, '', {
      fontFamily: MONO, fontSize: '40px', color: '#9fe8ff', fontStyle: 'bold',
    }).setOrigin(0.5));
    this.codeCaption = text(650, 14, CAPTION, false);

    // Copy, as a button. The label changes with the result, and the card
    // keeps its size under it.
    this.copy = cardButton(scene, cx, 700, 240, 44, LINK, 'COPY LINK', 15, 'secondary')
      .bind(() => this.copyLink());
    addAll(this.copy.parts);

    // Seeds only compare within a version. Without this people compare scores
    // from different games and conclude the leaderboard is broken.
    this.version = text(750, 13, SMALL, false);

    // Replay, as a BUTTON rather than a tap anywhere, in the card's shape
    // like every primary action. Not interactive here: GameScene owns the hit
    // test (see REPLAY_BUTTON) and SPACE still works.
    addAll(cardButton(scene, cx, REPLAY_BUTTON.y, REPLAY_BUTTON.width, REPLAY_BUTTON.height,
      0x3ecf7a, 'REPLAY THIS MATCH').parts);
    addAll(cardButton(scene, cx, 900, 300, 44, LINK, 'NEW MATCH', 15, 'secondary')
      .bind(onNewMatch).parts);

    this.root = scene.add.container(0, 0, parts).setDepth(50).setVisible(false);
  }

  /**
   * Clipboard access needs a secure context and is refused outright in a
   * sandboxed iframe, so this is the convenience path and never the only one -
   * the code is on screen at photo-readable size for exactly this reason.
   * A failure is expected, not exceptional, and says so without alarm.
   */
  private copyLink(): void {
    const done = (msg: string) => this.copy.setLabel(msg);
    try {
      navigator.clipboard.writeText(this.link)
        .then(() => done('LINK COPIED'))
        .catch(() => done('TYPE THE CODE ABOVE'));
    } catch {
      done('TYPE THE CODE ABOVE');
    }
  }

  /**
   * The standing line. The y axis runs from 0 to the larger of 150% and the
   * run's peak, so a player above par is drawn above the dashed par line
   * rather than clipped to it; x is simulated time. Labels: the top of the
   * axis, PAR at 100%, and 0.
   */
  private drawPlot(series: readonly { t: number; wave: number; standing: number }[]): void {
    const g = this.plot;
    g.clear();
    const pts = series.length > 0 ? series : [{ t: 0, wave: 1, standing: 1 }];
    const tMax = Math.max(1, pts[pts.length - 1].t);
    const peak = pts.reduce((m, p) => Math.max(m, p.standing), 0);
    const yMax = Math.max(1.5, Math.ceil(peak * 2) / 2);
    const x = (t: number) => PLOT.x + (t / tMax) * PLOT.width;
    const y = (s: number) => PLOT.y + PLOT.height - (Math.min(s, yMax) / yMax) * PLOT.height;
    // Frame and the two axes' baselines.
    g.fillStyle(0x0b1020, 1).fillRect(PLOT.x, PLOT.y, PLOT.width, PLOT.height);
    g.lineStyle(1, 0x2a3350, 1);
    g.strokeRect(PLOT.x, PLOT.y, PLOT.width, PLOT.height);
    // PAR: dashed at 100%.
    g.lineStyle(1, 0xc9d2ea, 0.8);
    for (let dx = 0; dx < PLOT.width; dx += 8) {
      g.lineBetween(PLOT.x + dx, y(1), PLOT.x + Math.min(dx + 4, PLOT.width), y(1));
    }
    // The player: a line through every point, a dot at each wave, in the
    // colour the rail gives that standing.
    const last = pts[pts.length - 1].standing;
    const color = Phaser.Display.Color.HexStringToColor(standingColor(last)).color;
    g.lineStyle(2, color, 1);
    g.beginPath();
    pts.forEach((p, i) => (i === 0 ? g.moveTo(x(p.t), y(p.standing)) : g.lineTo(x(p.t), y(p.standing))));
    g.strokePath();
    g.fillStyle(color, 1);
    for (const p of pts) g.fillCircle(x(p.t), y(p.standing), 2.5);
    const labels = [[yMax, `${Math.round(yMax * 100)}%`], [1, 'PAR'], [0, '0']] as const;
    labels.forEach(([v, text], i) => this.plotLabels[i].setText(text).setPosition(PLOT.x - 4, y(v)));
  }

  show(p: EndPayload, link: string): void {
    this.link = link;
    this.copy.setLabel('COPY LINK');
    this.title.setText(p.cause === 'titan' ? 'THE TITAN LANDED' : 'YOUR SQUAD WAS OVERRUN');
    // The headline counts up to its number: the screen's one authored
    // motion (the author's call, 2026-09-20). Scene clock, wall time, and
    // nothing the simulation touches - the run is already over.
    this.countTween?.remove();
    const counter = { n: 0 };
    this.wave.setText('0');
    this.countTween = this.scene.tweens.add({
      targets: counter, n: p.wave, duration: Math.min(900, 240 + p.wave * 60), ease: 'Quad.easeOut', delay: 120,
      onUpdate: () => this.wave.setText(String(Math.round(counter.n))),
      onComplete: () => { this.wave.setText(String(p.wave)); this.countTween = null; },
    });

    this.drawPlot(p.series);
    this.peak.setText(compact(p.peakDps));

    const { top, mid, low, risk, miss } = p.tally;
    const words = ['PERFECT', 'GOOD', 'BAD', 'INVEST', 'MISS'];
    [top, mid, low, risk, miss].forEach((n, i) => this.tally[i].set(String(n), words[i]).setHeld(n > 0));

    this.detail.setText(
      p.decisions > 0
        ? `${p.decisions} offer${p.decisions === 1 ? '' : 's'}  ·  ${p.kills} enemies destroyed`
        : `${p.kills} enemies destroyed`,
    );
    this.code.setText(p.code);
    const hard = p.mode === 'hard';
    this.codeCaption.setText(hard
      ? 'match code  ·  HARD  ·  type it in to play this exact run'
      : 'match code  ·  type it in to play this exact run');
    this.codeCaption.setColor(hard ? WARNING : CAPTION);
    this.version.setText(`v${p.version}  ·  scores compare within a version`);

    // Enters rather than cuts: the death beat has just darkened the field.
    this.scene.tweens.killTweensOf(this.root);
    this.root.setAlpha(0).setVisible(true);
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 200, ease: 'Quad.easeOut' });
  }

  hide(): void {
    this.scene.tweens.killTweensOf(this.root);
    this.countTween?.remove();
    this.countTween = null;
    this.root.setVisible(false).setAlpha(1);
  }
}
