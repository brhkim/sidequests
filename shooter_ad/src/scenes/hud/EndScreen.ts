import Phaser from 'phaser';
import { VIEW } from '../../config';
import type { MatchMode } from '../../systems/MatchCode';
import { SCREEN_PIXEL, SCREEN_TEX } from '../art/screens';
import { INK, LIGHT, MOTION, SURFACE, TYPE } from '../theme';
import { cardButton, type CardButton } from './CardTile';
import { slice } from './ScreenButton';
import { ScreenBackdrop } from './ScreenWipe';
import { standingColor } from './TopRail';
import { compact, FONT, GRADE_COLOR, GRADE_WORD, hex, LINK, MONO, WARNING } from './types';

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

const DEPTH = 50;
/** The standing plot's frame; peak damage / sec sits to its right. */
const PLOT = { x: 68, y: 468, width: 262, height: 78 } as const;
const PEAK_X = 432;
/** The results table: five rows, word left, a share bar, the count right. */
const TABLE = { top: 262, row: 32, word: 64, barX: 192, barW: 196, count: 476 } as const;
const MISS_COLOR = 0x8f9ab5;
const ROWS = [
  { word: GRADE_WORD.perfect, color: GRADE_COLOR.perfect },
  { word: GRADE_WORD.good, color: GRADE_COLOR.good },
  { word: GRADE_WORD.bad, color: GRADE_COLOR.bad },
  { word: GRADE_WORD.risk, color: GRADE_COLOR.risk },
  { word: 'MISS', color: MISS_COLOR },
] as const;
/** When the table starts after the headline starts counting, and the gap between rows. */
const TABLE_DELAY = 260;
const ROW_STAGGER = 70;
const ROW_COUNT_MS = 280;

interface TallyRow {
  word: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Image;
  track: Phaser.GameObjects.Image;
  n: number;
}

/**
 * The end screen: a rhythm game's results screen, laid out as the thing
 * people actually share.
 *
 * It has two jobs that pull against each other - results page and social
 * post - and the resolution is to make the shareable version the DEFAULT:
 * people screenshot runs; a screenshot loses the clipboard, so the match
 * code is on screen at a size readable off a photo.
 *
 * Order is deliberate: how the run ended (the heading, slanted like a
 * grade word - the last judgment of the run), then the score - waves
 * survived, THE headline, the author's intent in notes.md - then the
 * judgment tally as a results table (PERFECT / GOOD / BAD / INVEST / MISS
 * with big counts in their grade colours and a bar for each one's share),
 * then the evidence (you against par by wave, peak damage / sec), then how
 * to play the same match.
 *
 * The entrance is choreographed after the death beat, on the UI scene's
 * clock: the lanes wipe in, the heading snaps, the headline counts up, then
 * the table's rows land one by one and count. Nothing the simulation
 * touches; the run is already over. Nothing runs once it has landed.
 */
export class EndScreen {
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: ScreenBackdrop;
  private readonly title: Phaser.GameObjects.Text;
  private readonly wave: Phaser.GameObjects.Text;
  private readonly plot: Phaser.GameObjects.Graphics;
  private readonly plotLabels: Phaser.GameObjects.Text[] = [];
  private readonly peak: Phaser.GameObjects.Text;
  private readonly rows: TallyRow[] = [];
  private readonly detail: Phaser.GameObjects.Text;
  private readonly code: Phaser.GameObjects.Text;
  private readonly codeCaption: Phaser.GameObjects.Text;
  private readonly copy: CardButton;
  private readonly version: Phaser.GameObjects.Text;
  private link = '';
  private waveTarget = 0;

  constructor(private readonly scene: Phaser.Scene, onNewMatch: () => void) {
    const cx = VIEW.width / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { parts.push(o); return o; };
    const addAll = (os: Phaser.GameObjects.GameObject[]) => { for (const o of os) add(o); };
    const text = (x: number, y: number, size: number, color: string, weight = '500', tracking = 0) =>
      add(scene.add.text(x, y, '', {
        fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: weight, align: 'center',
      }).setOrigin(0.5).setLetterSpacing(tracking));
    const px = (x: number, y: number, w: number, h: number, color: number) =>
      add(scene.add.image(x, y, SCREEN_PIXEL).setDisplaySize(w, h).setTint(color));

    this.backdrop = new ScreenBackdrop(scene, DEPTH);

    // How it ended: the heading, in the fail line's red, slanted like the
    // grade words it follows.
    // Slanted type overhangs its measured box; the padding keeps the last
    // letter from being cut off the canvas the Text draws into.
    this.title = text(cx, 56, TYPE.heading.size, hex(LIGHT.fail), 'italic 800', 1).setPadding(8, 0, 8, 0);

    // The headline. Integer, instantly comparable, and captures both pick
    // quality and positioning - which a pure decision score would not.
    this.wave = text(cx, 146, TYPE.headline.size, INK.primary, TYPE.headline.weight);
    text(cx, 218, 14, INK.caption, '700', 2.4).setText('WAVES SURVIVED');

    // The results table. INVEST and MISS have their own rows - a gamble and
    // a card driven past are not a wrong sum. A count of zero sits dim.
    ROWS.forEach((r, i) => {
      const y = TABLE.top + i * TABLE.row;
      const word = add(scene.add.text(TABLE.word, y, r.word, {
        fontFamily: FONT, fontSize: '21px', color: hex(r.color), fontStyle: 'italic 800',
      }).setOrigin(0, 0.5).setLetterSpacing(1).setPadding(0, 0, 8, 0));
      const track = px(TABLE.barX, y, TABLE.barW, 6, SURFACE.hairline).setOrigin(0, 0.5);
      const bar = px(TABLE.barX, y, 0, 6, r.color).setOrigin(0, 0.5);
      const count = add(scene.add.text(TABLE.count, y, '0', {
        fontFamily: FONT, fontSize: '27px', color: hex(r.color), fontStyle: '800',
      }).setOrigin(1, 0.5));
      this.rows.push({ word, count, bar, track, n: 0 });
    });
    text(cx, 424, 13, INK.caption).setText('every card you took, graded against the best of its three');
    this.detail = text(cx, 446, 15, INK.secondary);

    // The run against par, as a line: x is time, y is your DPS as a share
    // of par's, a dashed line at 100% and a dot per wave (1.5, the author's
    // ask). Beside it, the number the skill was for: peak damage / sec.
    add(slice(scene, SCREEN_TEX.panel, PLOT.x + PLOT.width / 2, PLOT.y + PLOT.height / 2, PLOT.width + 12, PLOT.height + 12)
      .setTint(SURFACE.panel));
    this.plot = add(scene.add.graphics());
    for (let i = 0; i < 3; i++) {
      this.plotLabels.push(add(scene.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: '13px', color: INK.caption, fontStyle: '600',
      }).setOrigin(1, 0.5)));
    }
    text(PLOT.x + PLOT.width / 2, PLOT.y + PLOT.height + 20, 13, INK.caption, '600', 1.2).setText('YOU VS PAR, BY WAVE');
    this.peak = text(PEAK_X, PLOT.y + 28, 38, INK.primary, '800');
    text(PEAK_X, PLOT.y + 64, 13, INK.caption, '600', 0.8).setText('PEAK DAMAGE / SEC');

    px(cx, 590, 440, 1, SURFACE.hairline);

    // Large on purpose. This is the half of the screenshot that makes the run
    // playable by somebody else rather than merely a claim. The caption names
    // the difficulty, because a hard run is not the same match as a normal one
    // on the same seed and a reader should not have to decode base32 to see it.
    this.code = add(scene.add.text(cx, 624, '', {
      fontFamily: MONO, fontSize: '40px', color: '#9fe8ff', fontStyle: 'bold',
    }).setOrigin(0.5));
    this.codeCaption = text(cx, 658, 14, INK.caption);

    // Copy, as a button. The label changes with the result; the button
    // keeps its size under it.
    this.copy = cardButton(scene, cx, 702, 240, 44, LINK, 'COPY LINK', 15, 'secondary')
      .bind(() => this.copyLink());
    addAll(this.copy.parts);

    // Seeds only compare within a version. Without this people compare scores
    // from different games and conclude the leaderboard is broken.
    this.version = text(cx, 748, 13, INK.small, '600');

    // Replay, the one filled button. Not interactive here at all: GameScene
    // owns the hit test (see REPLAY_BUTTON) and SPACE still works. An
    // interactive object here - even one only wired for the pressed look -
    // takes the tap in this scene and GameScene never sees it.
    addAll(cardButton(scene, cx, REPLAY_BUTTON.y, REPLAY_BUTTON.width, REPLAY_BUTTON.height,
      GRADE_COLOR.perfect, 'REPLAY THIS MATCH', 22).parts);
    addAll(cardButton(scene, cx, 900, 300, 44, LINK, 'NEW MATCH', 15, 'secondary')
      .bind(onNewMatch).parts);

    this.root = scene.add.container(0, 0, parts).setDepth(DEPTH).setVisible(false);
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
   * The standing line, drawn once per show. The y axis runs from 0 to the
   * larger of 150% and the run's peak, so a player above par is drawn above
   * the dashed par line rather than clipped to it; x is simulated time.
   * Labels: the top of the axis, PAR at 100%, and 0.
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
    // Baseline and PAR, in the highway's own light: PAR dashed at 100%.
    g.lineStyle(1, SURFACE.hairline, 1).lineBetween(PLOT.x, y(0), PLOT.x + PLOT.width, y(0));
    g.lineStyle(1, LIGHT.rail, 0.6);
    for (let dx = 0; dx < PLOT.width; dx += 8) {
      g.lineBetween(PLOT.x + dx, y(1), PLOT.x + Math.min(dx + 4, PLOT.width), y(1));
    }
    // The player: a soft fill under the line, the line, a dot per wave, and
    // the last point ringed - in the colour the rail gives that standing.
    const last = pts[pts.length - 1].standing;
    const color = Phaser.Display.Color.HexStringToColor(standingColor(last)).color;
    if (pts.length > 1) {
      g.fillStyle(color, 0.14);
      g.beginPath();
      g.moveTo(x(pts[0].t), y(0));
      for (const p of pts) g.lineTo(x(p.t), y(p.standing));
      g.lineTo(x(pts[pts.length - 1].t), y(0));
      g.closePath();
      g.fillPath();
    }
    g.lineStyle(2.5, color, 1);
    g.beginPath();
    pts.forEach((p, i) => (i === 0 ? g.moveTo(x(p.t), y(p.standing)) : g.lineTo(x(p.t), y(p.standing))));
    g.strokePath();
    g.fillStyle(color, 1);
    for (const p of pts) g.fillCircle(x(p.t), y(p.standing), 2.5);
    const end = pts[pts.length - 1];
    g.lineStyle(2, color, 0.9).strokeCircle(x(end.t), y(end.standing), 5.5);
    const labels = [[yMax, `${Math.round(yMax * 100)}%`], [1, 'PAR'], [0, '0']] as const;
    labels.forEach(([v, s], i) => this.plotLabels[i].setText(s).setPosition(PLOT.x - 8, y(v)));
  }

  show(p: EndPayload, link: string): void {
    this.link = link;
    this.copy.setLabel('COPY LINK');
    this.title.setText(p.cause === 'titan' ? 'THE TITAN LANDED' : 'YOUR SQUAD WAS OVERRUN');

    this.drawPlot(p.series);
    this.peak.setText(compact(p.peakDps));
    const { top, mid, low, risk, miss } = p.tally;
    const counts = [top, mid, low, risk, miss];
    const most = Math.max(1, ...counts);
    this.rows.forEach((r, i) => { r.n = counts[i]; r.count.setText('0'); r.bar.displayWidth = 0; });
    this.barScale = TABLE.barW / most;

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
    this.codeCaption.setColor(hard ? WARNING : INK.caption);
    this.version.setText(`v${p.version}  ·  scores compare within a version`);

    // The choreography's starting frame: heading, headline and rows held
    // back until the lanes have wiped in.
    this.stopMotion();
    this.waveTarget = p.wave;
    this.wave.setText('0').setAlpha(0);
    this.title.setAlpha(0);
    for (const r of this.rows) this.rowAlpha(r, 0);
    this.backdrop.enter(this.root, () => this.choreograph());
  }

  private barScale = 1;
  /** The plain state objects the entrance tweens drive, so a re-show can stop them. */
  private readonly counters: object[] = [];

  private rowAlpha(r: TallyRow, a: number): void {
    const dim = r.n > 0 ? 1 : 0.5;
    r.word.setAlpha(a * dim);
    r.count.setAlpha(a * dim);
    r.bar.setAlpha(a);
    r.track.setAlpha(a);
  }

  /**
   * After the wipe: the heading snaps in, the headline counts up to its
   * number and punches when it lands, and the table's rows land one by one,
   * each counting up and drawing its bar. Every tween is on the UI scene's
   * clock and ends; `setText` only when the shown figure changes.
   */
  private choreograph(): void {
    const s = this.scene;
    this.title.setAlpha(1).setScale(1.2);
    s.tweens.add({ targets: this.title, scale: 1, duration: MOTION.snap, ease: MOTION.snapEase });

    this.wave.setAlpha(1);
    const counter = { n: 0 };
    this.counters.push(counter);
    let shown = 0;
    s.tweens.add({
      targets: counter, n: this.waveTarget, duration: Math.min(900, 240 + this.waveTarget * 60), ease: 'Quad.easeOut',
      onUpdate: () => {
        const v = Math.round(counter.n);
        if (v !== shown) { shown = v; this.wave.setText(String(v)); }
      },
      onComplete: () => {
        this.wave.setText(String(this.waveTarget)).setScale(MOTION.punchScale);
        s.tweens.add({ targets: this.wave, scale: 1, duration: MOTION.punch, ease: MOTION.punchEase });
      },
    });

    this.rows.forEach((r, i) => {
      const x0 = TABLE.word;
      const state = { a: 0, n: 0 };
      this.counters.push(state);
      let last = 0;
      s.tweens.add({
        targets: state, a: 1, n: r.n, duration: ROW_COUNT_MS, delay: TABLE_DELAY + i * ROW_STAGGER,
        ease: 'Quad.easeOut',
        onStart: () => r.word.setX(x0 - 14),
        onUpdate: () => {
          const k = Math.min(1, state.a / 0.5);
          // The row snaps in over its first half (a small overshoot), then counts.
          r.word.x = x0 - 14 * (1 - Phaser.Math.Easing.Back.Out(k));
          this.rowAlpha(r, k);
          const v = Math.round(state.n);
          if (v !== last) { last = v; r.count.setText(String(v)); }
          r.bar.displayWidth = this.barScale * state.n;
        },
        onComplete: () => {
          r.word.x = x0;
          this.rowAlpha(r, 1);
          r.count.setText(String(r.n));
          r.bar.displayWidth = this.barScale * r.n;
        },
      });
    });
  }

  /** A re-show (or a hide) must not let an old entrance write over the new run's figures. */
  private stopMotion(): void {
    this.scene.tweens.killTweensOf([this.title, this.wave, ...this.counters]);
    this.counters.length = 0;
  }

  hide(): void {
    this.stopMotion();
    this.backdrop.hide(this.root);
  }
}
