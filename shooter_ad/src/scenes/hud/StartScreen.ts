import Phaser from 'phaser';
import { SQUAD, VIEW } from '../../config';
import { AXIS_COLOR, type BonusAxis } from '../../data/gates';
import { tierRow } from '../../data/tiers';
import { decodeMatch, type Match, type MatchMode } from '../../systems/MatchCode';
import { SCREEN_PIXEL, SCREEN_TEX } from '../art/screens';
import { INK, LIGHT, SURFACE, TYPE } from '../theme';
import { CardTile, cardButton, segmented } from './CardTile';
import { slice } from './ScreenButton';
import { ScreenBackdrop } from './ScreenWipe';
import { FONT, GRADE_COLOR, LINK, WARNING, hex } from './types';

export interface StartPayload {
  readonly code: string;
  readonly version: string;
  readonly mode: MatchMode;
  /** True when the match came from a shared link rather than a fresh run. */
  readonly invited: boolean;
}

const SKIN = 0xf2c9a0;
const DEPTH = 60;

interface DemoCard { magnitude: string; axis: BonusAxis; word: string }

/**
 * The demo offers: real conversions, the kind the game asks every 7.5s, one
 * per pass of the descent so the screen shows the whole vocabulary rather
 * than one offer on a loop (the author's ask, 2026-09-20). Each is a real
 * decision: the two forms of one axis against a third kind of pick, a
 * damage card against an army card, an INVEST card beside two damage cards.
 */
const DEMO_OFFERS: readonly (readonly DemoCard[])[] = [
  [{ magnitude: '+25%', axis: 'damage', word: 'DMG' }, { magnitude: '×1.25', axis: 'damage', word: 'DMG' }, { magnitude: '+1', axis: 'guns', word: 'GUNS' }],
  [{ magnitude: '+40%', axis: 'rate', word: 'RATE' }, { magnitude: '×1.2', axis: 'army', word: 'ARMY' }, { magnitude: '+1', axis: 'pierce', word: 'PIERCE' }],
  [{ magnitude: '×1.1', axis: 'damage', word: 'DMG' }, { magnitude: '+12', axis: 'army', word: 'ARMY' }, { magnitude: '+', axis: 'time', word: 'TIME' }],
  [{ magnitude: '+30%', axis: 'rate', word: 'RATE' }, { magnitude: '×1.3', axis: 'rate', word: 'RATE' }, { magnitude: '+', axis: 'sense', word: 'SENSE' }],
  [{ magnitude: '×1.5', axis: 'army', word: 'ARMY' }, { magnitude: '+2', axis: 'guns', word: 'GUNS' }, { magnitude: '+', axis: 'move', word: 'MOVE' }],
  [{ magnitude: '+15%', axis: 'damage', word: 'DMG' }, { magnitude: '×1.15', axis: 'rate', word: 'RATE' }, { magnitude: '+', axis: 'shield', word: 'SHIELD' }],
];

/**
 * The demo highway: three lanes from under the pitch's first beat down to a
 * judgment line with the squad standing on it. A pass is 2.6s; the notes
 * travel 150px to the line in 2.1s (~73px/s, near the field's ~96px/s at
 * wave 1 - under ~40px/s it read as a hover in the 2026-09-20 finish
 * review). The one in the squad's lane is taken when it meets the squad's
 * heads - it swells and bursts, and the receptor under the squad lights in
 * its colour - and the other two run on down to the line and fade under it.
 * The next offer is dealt while the lanes are empty.
 */
const HW = {
  top: 178,
  line: 410,
  noteW: 150,
  noteH: 76,
  ms: 2600,
  /** The fraction of a pass at which a side note's bottom edge meets the line. */
  arrive: 0.8,
  /** Fade in over the first tenth. */
  fadeIn: 0.1,
  /** How far the squad's heads stand above the line: where the taken note stops. */
  squadTop: 52,
  /** The taken note's burst, as a fraction of a pass. */
  burst: 0.2,
} as const;
const DEMO_FROM = HW.top + HW.noteH / 2 + 4;
const DEMO_TO = HW.line - HW.noteH / 2;
const SPEED = (DEMO_TO - DEMO_FROM) / HW.arrive;
const TAKE_Y = HW.line - HW.squadTop - HW.noteH / 2;
const TAKE_T = (TAKE_Y - DEMO_FROM) / SPEED;
const LANE_X = [90, 270, 450] as const;
const BEAT_LINES = 3;

/** The controls, as rows: two columns of 200 either side of centre, or one of 412. */
const COL = { left: VIEW.width / 2 - 106, right: VIEW.width / 2 + 106, half: 200, full: 412 } as const;

/**
 * The screen a shared link lands on, and the only place a match is chosen.
 *
 * It is the highway's first beat, not a menu (the author's call, 2026-09-20,
 * rebuilt in the highway world 2026-09-24): three real offer notes descend
 * three lanes toward the judgment line where a real squad stands, and the
 * one in its lane is taken - so somebody following a stranger's link sees
 * what the game IS before the pitch is read, and the pitch is still the
 * author's, verbatim, around it.
 *
 * Every control is a button (the author, 2026-09-20: "buttons should look
 * like buttons"): ENTER A CODE and NEW MATCH under the code, the difficulty
 * as two segments with the chosen one lit, START MATCH the one filled and
 * glowing action, and HOW TO PLAY beneath it, which opens the pause
 * screen's pages before a run exists.
 *
 * It deliberately does NOT auto-start. A run that begins while you are still
 * reading the code is a run you immediately restart. The match code is
 * confirmed here because the code is the shareable unit, and ENTERED here
 * because the medium is a screenshot and a screenshot loses the link.
 * Difficulty is tappable: a shared code carries its mode, and switching
 * rewrites the code, because a hard run is not the same match as a normal
 * one on the same seed.
 *
 * Motion: the lane wipe on entry and the demo's descent, both on the scene
 * clock; nothing on this screen simulates, and a hidden screen runs no tween.
 */
export class StartScreen {
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: ScreenBackdrop;
  private readonly code: Phaser.GameObjects.Text;
  private readonly caption: Phaser.GameObjects.Text;
  private readonly version: Phaser.GameObjects.Text;
  private readonly modeHint: Phaser.GameObjects.Text;
  private readonly modeControl: ReturnType<typeof segmented<MatchMode>>;
  private readonly enter: ReturnType<typeof cardButton>;
  private readonly demo: CardTile[] = [];
  private readonly beats: Phaser.GameObjects.Image[] = [];
  private readonly receptor: Phaser.GameObjects.NineSlice;
  private readonly receptorFlash: Phaser.GameObjects.NineSlice;
  private readonly burst: Phaser.GameObjects.NineSlice;
  private demoTween: Phaser.Tweens.Tween | null = null;
  private demoIndex = 0;
  /** What the button would start right now, which the code above reflects. */
  private current: MatchMode = 'normal';

  constructor(
    private readonly scene: Phaser.Scene,
    onStart: () => void,
    onModeChange: (mode: MatchMode) => void,
    /** `null` asks for a fresh random match; a `Match` is one the player typed. */
    onMatchRequest: (match: Match | null) => void,
    onGuide: () => void,
  ) {
    const cx = VIEW.width / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { parts.push(o); return o; };
    const addAll = (os: Phaser.GameObjects.GameObject[]) => { for (const o of os) add(o); };
    const px = (x: number, y: number, w: number, h: number, color: number, alpha: number) =>
      add(scene.add.image(x, y, SCREEN_PIXEL).setDisplaySize(w, h).setTint(color).setAlpha(alpha));

    this.backdrop = new ScreenBackdrop(scene, DEPTH);

    // The title, in the display step.
    add(scene.add.text(cx, 58, 'DPS GOLF', {
      fontFamily: FONT, fontSize: `${TYPE.display.size}px`, color: INK.primary, fontStyle: TYPE.display.weight,
    }).setOrigin(0.5).setLetterSpacing(3).setShadow(0, 3, 'rgba(0,0,0,0.6)', 8));

    // The pitch. The author's words; four beats, the first above the
    // highway and the rest beneath its judgment line, so the notes fall
    // between the job and the warning.
    const line = (y: number, text: string, color: string, size = 17, weight = '500') =>
      add(scene.add.text(cx, y, text, {
        fontFamily: FONT, fontSize: `${size}px`, color, align: 'center', fontStyle: weight,
      }).setOrigin(0.5, 0).setLineSpacing(4));
    line(96, 'Pick the best bonuses, avoid damage,\nand kill the Titan before it reaches\nthe end — or you lose.', INK.secondary);

    // The demo highway: two lit rails, beat lines streaming down at the
    // demo's speed, the notes, then the judgment line over them.
    for (const x of [180, 360]) px(x, (HW.top + HW.line) / 2, 2, HW.line - HW.top, LIGHT.rail, 0.2);
    for (let i = 0; i < BEAT_LINES; i++) {
      this.beats.push(px(cx, HW.top, VIEW.width, 1, LIGHT.rail, 0.1));
    }
    DEMO_OFFERS[0].forEach((d, i) => {
      const tile = new CardTile(scene, LANE_X[i], DEMO_FROM, AXIS_COLOR[d.axis], HW.noteW, HW.noteH);
      tile.set(d.magnitude, d.word);
      addAll(tile.parts);
      this.demo.push(tile);
    });
    add(slice(scene, SCREEN_TEX.glow, cx, HW.line, VIEW.width, 4).setTint(LIGHT.judgment).setAlpha(0.2));
    px(cx, HW.line, VIEW.width, 3, LIGHT.judgment, 0.95);
    // Receptors: a flat pad per lane on the line, the note's width; the
    // squad's lights in the colour of the note it takes, with a bloom.
    for (const x of LANE_X) {
      add(slice(scene, SCREEN_TEX.panel, x, HW.line, HW.noteW, 9).setTint(LIGHT.rail).setAlpha(0.16));
    }
    this.receptorFlash = add(slice(scene, SCREEN_TEX.glow, cx, HW.line, HW.noteW, 10).setAlpha(0));
    this.receptor = add(slice(scene, SCREEN_TEX.panel, cx, HW.line, HW.noteW, 9).setAlpha(0));
    this.burst = add(slice(scene, SCREEN_TEX.rim, cx, TAKE_Y, HW.noteW, HW.noteH).setAlpha(0));

    // The squad, standing on the line in the centre lane: three bodies from
    // the real textures, the leader larger with the visor, at Grey.
    const shirt = tierRow(0).shirt;
    for (const [dx, lead] of [[-30, false], [0, true], [30, false]] as const) {
      const s = (lead ? SQUAD.leaderScale : 1) * 0.6;
      const bodyY = HW.line - 20 * s - 2;
      add(scene.add.image(cx + dx, bodyY, 'body').setScale(s).setTint(shirt));
      add(scene.add.image(cx + dx, bodyY - 24 * s, lead ? 'head-lead' : 'head').setScale(s).setTint(SKIN));
    }

    line(436, 'Oh, and sub-optimal play is SEVERELY punished.', WARNING, 17, '600');
    line(464, 'The math only gets harder.\nThe bonuses only scroll at you faster.', INK.secondary);
    line(518, 'Have fun!', hex(GRADE_COLOR.perfect), 18, '700');

    // The match: the code, what it is, and the two ways to change it. Both
    // controls go through GameScene, which owns the seed, and the screen
    // redraws from the `showstart` that comes back.
    px(cx, 560, COL.full, 1, SURFACE.hairline, 1);
    this.code = add(scene.add.text(cx, 594, '', {
      fontFamily: FONT, fontSize: '42px', color: '#9fe8ff', fontStyle: '800',
    }).setOrigin(0.5).setLetterSpacing(3));
    this.caption = add(scene.add.text(cx, 628, 'match code', {
      fontFamily: FONT, fontSize: '14px', color: INK.caption, fontStyle: '500',
    }).setOrigin(0.5));
    this.enter = cardButton(scene, COL.left, 672, COL.half, 44, LINK, 'ENTER A CODE', 15, 'secondary')
      .bind(() => this.promptForCode(onMatchRequest));
    addAll(this.enter.parts);
    addAll(cardButton(scene, COL.right, 672, COL.half, 44, LINK, 'NEW MATCH', 15, 'secondary')
      .bind(() => onMatchRequest(null)).parts);

    // Difficulty as two segments with the chosen one lit (HARD in the
    // warning colour). `endscreen.mjs` finds them by their words and reads
    // the lit one by its text white.
    this.modeControl = segmented<MatchMode>(scene, cx, 734, COL.half, 44, COL.full - COL.half * 2, [
      // Code cyan, not ARMY green: START MATCH is the one green button.
      { key: 'normal', label: 'NORMAL', color: 0x9fe8ff },
      { key: 'hard', label: 'HARD', color: 0xff7b54 },
    ], 15, (mode) => { if (mode !== this.current) onModeChange(mode); });
    addAll(this.modeControl.parts);
    this.modeHint = add(scene.add.text(cx, 770, 'tap to change difficulty', {
      fontFamily: FONT, fontSize: '14px', color: INK.caption, fontStyle: '500',
    }).setOrigin(0.5));

    // The one filled, glowing button. HOW TO PLAY beneath it opens the
    // explainers.
    addAll(cardButton(scene, cx, 822, COL.full, 64, GRADE_COLOR.perfect, 'START MATCH', 22).bind(onStart).parts);
    addAll(cardButton(scene, cx, 890, COL.full, 44, LINK, 'HOW TO PLAY', 15, 'secondary').bind(onGuide).parts);

    this.version = add(scene.add.text(cx, 934, '', {
      fontFamily: FONT, fontSize: '13px', color: INK.small, fontStyle: '600',
    }).setOrigin(0.5));

    // Hidden until `show`. A container is visible by default, and an opaque
    // screen at depth 60 that nobody asked for covers the entire game.
    this.root = scene.add.container(0, 0, parts).setDepth(DEPTH).setVisible(false);
  }

  /** Deals offer `i` onto the three demo notes. */
  private deal(i: number): void {
    this.demoIndex = i % DEMO_OFFERS.length;
    DEMO_OFFERS[this.demoIndex].forEach((d, k) => {
      this.demo[k].setColor(AXIS_COLOR[d.axis]).set(d.magnitude, d.word);
    });
  }

  /**
   * One pass of the demo, as a function of its phase `t` in [0, 1): the
   * notes descend, the one in the squad's lane is taken at the line, the
   * other two run on beneath it and fade.
   */
  private frame(t: number): void {
    const y = DEMO_FROM + SPEED * t;
    const inA = Math.min(1, t / HW.fadeIn);
    const after = Math.max(0, (t - HW.arrive) / (1 - HW.arrive));
    const taken = this.demo[1];
    // The two side notes run on down to the line and fade out under it.
    for (const k of [0, 2]) this.demo[k].setY(y).setAlpha(inA * (1 - after));
    // The squad's note stops on the squad, swells and bursts.
    const hit = Phaser.Math.Clamp((t - TAKE_T) / HW.burst, 0, 1);
    if (t < TAKE_T) {
      taken.setScale(1).setY(y).setAlpha(inA);
    } else {
      const pop = 1 - (1 - hit) * (1 - hit);
      taken.setY(TAKE_Y).setScale(1 + 0.12 * pop).setAlpha(1 - pop);
    }
    const c = taken.tint;
    const lit = t >= TAKE_T ? 1 - hit : 0;
    this.burst.setTint(c).setScale(1 + 0.35 * hit).setAlpha(0.9 * lit);
    // The receptor under the squad lights as the note nears it, full on the
    // take, and holds a moment after the burst.
    const near = Phaser.Math.Clamp((t - (TAKE_T - 0.25)) / 0.25, 0, 1);
    const hold = t >= TAKE_T ? Math.max(0, 1 - (t - TAKE_T) / (HW.burst * 2)) : 0;
    this.receptor.setTint(c).setAlpha(t >= TAKE_T ? hold : 0.45 * near * near);
    this.receptorFlash.setTint(c).setAlpha(0.6 * hold);
    // Beat lines stream down the lanes at the notes' speed.
    const span = HW.line - HW.top;
    const gap = span / BEAT_LINES;
    this.beats.forEach((b, i) => {
      const by = ((SPEED * t + i * gap) % span);
      b.y = HW.top + by;
      b.alpha = 0.12 * Math.min(1, by / 24, (span - by) / 24);
    });
  }

  /** The demo descends, is taken at the line, and the next offer comes round. */
  private startDemo(): void {
    this.stopDemo();
    const state = { t: 0 };
    this.demoTween = this.scene.tweens.add({
      targets: state, t: 1, duration: HW.ms, repeat: -1, ease: 'Linear',
      onUpdate: () => this.frame(state.t),
      // The notes are invisible at the turn, so the swap is never seen.
      onRepeat: () => this.deal(this.demoIndex + 1),
    });
  }

  private stopDemo(): void {
    this.demoTween?.remove();
    this.demoTween = null;
    this.deal(0);
    this.frame(0);
  }

  /**
   * A native prompt rather than an on-screen keyboard: it brings up the
   * phone's own keyboard, the code is eight characters, and `decodeMatch`
   * already forgives case, punctuation and the glyphs people misread off a
   * photo. A refusal leaves the current match exactly as it was; a bad code
   * says so on the button, briefly, on the wall clock (the scene clock under
   * headless Chromium runs at a fraction of real time).
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
    this.enter.setLabel('NOT A CODE').setColor(0xff7b54);
    window.setTimeout(() => {
      this.enter.setLabel('ENTER A CODE').setColor(LINK);
    }, 1600);
  }

  show(p: StartPayload): void {
    if (this.code.text !== p.code) this.code.setText(p.code);
    this.caption.setText(p.invited ? 'match code · sent to you' : 'match code · replays this exact run');
    this.current = p.mode;
    this.modeControl.set(p.mode);
    this.modeHint.setText(p.mode === 'hard'
      ? 'faster cards, harder sums · tap to change difficulty'
      : 'tap to change difficulty');
    this.version.setText(`v${p.version}`);
    // `showstart` also answers a mode toggle or a new code while the screen
    // is up: redraw in place then, and wipe in only when arriving. The demo
    // deals from its first offer on every show, as it always has - the
    // probe's pass-to-pass check is timed from the last show.
    if (!this.root.visible) this.backdrop.enter(this.root);
    this.startDemo();
  }

  hide(): void {
    this.backdrop.hide(this.root);
    this.stopDemo();
  }
}
