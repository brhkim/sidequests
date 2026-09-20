import Phaser from 'phaser';
import { ARENA, COLORS, SQUAD, VIEW } from '../../config';
import { AXIS_COLOR, type BonusAxis } from '../../data/gates';
import { tierRow } from '../../data/tiers';
import { decodeMatch, type Match, type MatchMode } from '../../systems/MatchCode';
import { CardTile, cardButton, segmented } from './CardTile';
import { CAPTION, FONT, LINK, MONO, SMALL, WARNING } from './types';

export interface StartPayload {
  readonly code: string;
  readonly version: string;
  readonly mode: MatchMode;
  /** True when the match came from a shared link rather than a fresh run. */
  readonly invited: boolean;
}

const SKIN = 0xf2c9a0;

interface DemoCard { magnitude: string; axis: BonusAxis; word: string }

/**
 * The demo offers: real conversions, the kind the game asks every 7.5s, one
 * per pass of the descent so the screen shows the whole vocabulary rather
 * than one offer on a loop (the author's ask, 2026-09-20). Each is a real
 * decision: the two forms of one axis against a third kind of pick, a
 * damage card against an army card, a RISK card beside two damage cards.
 */
const DEMO_OFFERS: readonly (readonly DemoCard[])[] = [
  [{ magnitude: '+25%', axis: 'damage', word: 'DMG' }, { magnitude: '×1.25', axis: 'damage', word: 'DMG' }, { magnitude: '+1', axis: 'guns', word: 'GUNS' }],
  [{ magnitude: '+40%', axis: 'rate', word: 'RATE' }, { magnitude: '×1.2', axis: 'army', word: 'ARMY' }, { magnitude: '+1', axis: 'pierce', word: 'PIERCE' }],
  [{ magnitude: '×1.1', axis: 'damage', word: 'DMG' }, { magnitude: '+12', axis: 'army', word: 'ARMY' }, { magnitude: '+', axis: 'time', word: 'TIME' }],
  [{ magnitude: '+30%', axis: 'rate', word: 'RATE' }, { magnitude: '×1.3', axis: 'rate', word: 'RATE' }, { magnitude: '+', axis: 'sense', word: 'SENSE' }],
  [{ magnitude: '×1.5', axis: 'army', word: 'ARMY' }, { magnitude: '+2', axis: 'guns', word: 'GUNS' }, { magnitude: '×1.2', axis: 'move', word: 'MOVE' }],
  [{ magnitude: '+15%', axis: 'damage', word: 'DMG' }, { magnitude: '×1.15', axis: 'rate', word: 'RATE' }, { magnitude: '+1', axis: 'pierce', word: 'PIERCE' }],
];
/**
 * Where the demo offer descends from and to, and how long one pass takes.
 * The room between the pitch's first beat and its warning line is 116px of
 * travel; at 2.6s a pass that is ~45px/s, which reads as a descent (the
 * field's offers fall at ~96px/s at wave 1; under ~40px/s it read as a hover
 * in the finish review). The cards fade out over the last 15%, before they
 * touch the warning line, and the next offer is dealt while they are out.
 */
const DEMO_FROM = 214;
const DEMO_TO = 330;
const DEMO_MS = 2600;

/**
 * The screen a shared link lands on, and the only place a match is chosen.
 *
 * It is the first wave, not a menu (the author's call, 2026-09-20): three
 * real offer cards descend toward a real squad standing on the real ground
 * band, and the primary action is a card too. Somebody following a stranger's
 * link sees what the game IS - choosing between cards - before the pitch is
 * read, and the pitch is still the author's, verbatim.
 *
 * Every control is a card button (the author, 2026-09-20: "buttons should
 * look like buttons"): ENTER A CODE and NEW MATCH under the code, the
 * difficulty as two segments with the chosen one lit, START MATCH filled,
 * and HOW TO PLAY beneath it, which opens the pause screen's pages before a
 * run exists - the same explainers, so nothing is learned twice.
 *
 * It deliberately does NOT auto-start. A run that begins while you are still
 * reading the code is a run you immediately restart, and the first second of
 * a shared match is the one that decides whether the link was worth
 * following. Same single tap either way; better first second.
 *
 * The match code is confirmed here because the code is the shareable unit,
 * and ENTERED here because the medium is a screenshot and a screenshot loses
 * the link. Difficulty is above the button and tappable: a shared code
 * carries its mode, and switching rewrites the code, because a hard run is
 * not the same match as a normal one on the same seed.
 *
 * The descent of the demo offer is the screen's one authored motion. It
 * reads the scene clock only; nothing on this screen simulates.
 */
export class StartScreen {
  private readonly root: Phaser.GameObjects.Container;
  private readonly code: Phaser.GameObjects.Text;
  private readonly caption: Phaser.GameObjects.Text;
  private readonly version: Phaser.GameObjects.Text;
  private readonly modeHint: Phaser.GameObjects.Text;
  private readonly modeControl: ReturnType<typeof segmented<MatchMode>>;
  private readonly enter: ReturnType<typeof cardButton>;
  private readonly demo: CardTile[] = [];
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

    // The field, not a panel: screen navy above, then the field's own
    // ground - the lane band, the ground band with its edge, the 24px breach
    // glow and the line - exactly as `render/FieldRender` draws them.
    add(scene.add.rectangle(cx, VIEW.height / 2, VIEW.width, VIEW.height, 0x05070f, 1));
    const groundTop = ARENA.laneY - 60;
    // The lane band begins 8px under the last button's stroke, so the
    // controls stand over the field rather than across its edge.
    const laneTop = 826;
    add(scene.add.rectangle(0, laneTop, VIEW.width, VIEW.height - laneTop, COLORS.lane, 1).setOrigin(0, 0));
    add(scene.add.rectangle(0, groundTop, VIEW.width, ARENA.breachY - groundTop, 0x171d2e, 1).setOrigin(0, 0));
    add(scene.add.rectangle(0, groundTop, VIEW.width, 1, 0x2a3350, 1).setOrigin(0, 0));
    [0.05, 0.035, 0.02].forEach((a, i) => {
      add(scene.add.rectangle(0, ARENA.breachY - 6 * (i + 1), VIEW.width, 6, COLORS.breach, a).setOrigin(0, 0));
    });
    add(scene.add.rectangle(0, ARENA.breachY - 1, VIEW.width, 2, COLORS.breach, 0.6).setOrigin(0, 0));
    add(scene.add.rectangle(0, ARENA.breachY + 1, VIEW.width, VIEW.height - ARENA.breachY - 1, 0x0e1220, 1).setOrigin(0, 0));

    add(scene.add.text(cx, 54, 'DPS GOLF', {
      fontFamily: FONT, fontSize: '56px', color: COLORS.text, fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(2));

    // The pitch. The author's words; four beats, the first above the demo
    // offer and the rest beneath it, so the cards sit between the job and
    // the warning.
    const line = (y: number, text: string, color: string, size = 17) =>
      add(scene.add.text(cx, y, text, {
        fontFamily: FONT, fontSize: `${size}px`, color, align: 'center',
      }).setOrigin(0.5, 0).setLineSpacing(5));
    line(96, 'Pick the best bonuses, avoid damage,\nand kill the Titan before it reaches\nthe end — or you lose.', '#c9d2ea');

    // The demo offer: three real cards in the three lanes, descending on a
    // loop, a different offer each pass.
    DEMO_OFFERS[0].forEach((d, i) => {
      const tile = new CardTile(scene, 90 + i * 180, DEMO_FROM, AXIS_COLOR[d.axis], 160);
      tile.set(d.magnitude, d.word);
      addAll(tile.parts);
      this.demo.push(tile);
    });

    line(368, 'Oh, and sub-optimal play is SEVERELY punished.', WARNING);
    line(396, 'The math only gets harder.\nThe bonuses only scroll at you faster.', CAPTION);
    line(448, 'Have fun!', '#3ecf7a', 18);

    // The match, between two hairlines: the code, what it is, and the two
    // ways to change it. Both controls go through GameScene, which owns the
    // seed, and the screen redraws from the `showstart` that comes back.
    add(scene.add.rectangle(cx, 484, 380, 1, 0x2a3350));
    add(scene.add.rectangle(cx, 624, 380, 1, 0x2a3350));
    this.code = add(scene.add.text(cx, 520, '', {
      fontFamily: MONO, fontSize: '40px', color: '#9fe8ff', fontStyle: 'bold',
    }).setOrigin(0.5));
    this.caption = add(scene.add.text(cx, 553, 'match code', {
      fontFamily: FONT, fontSize: '15px', color: CAPTION,
    }).setOrigin(0.5));
    this.enter = cardButton(scene, cx - 96, 592, 184, 44, LINK, 'ENTER A CODE', 15, 'secondary')
      .bind(() => this.promptForCode(onMatchRequest));
    addAll(this.enter.parts);
    addAll(cardButton(scene, cx + 96, 592, 184, 44, LINK, 'NEW MATCH', 15, 'secondary')
      .bind(() => onMatchRequest(null)).parts);

    // Difficulty, above the button, as two segments with the chosen one lit
    // (HARD in the warning colour). `endscreen.mjs` finds the segments by
    // their words and the hint beneath them.
    this.modeControl = segmented<MatchMode>(scene, cx, 654, 184, 44, 8, [
      // Code cyan, not ARMY green: START MATCH is the one green card on
      // the screen (the finish review, 2026-09-20).
      { key: 'normal', label: 'NORMAL', color: 0x9fe8ff },
      { key: 'hard', label: 'HARD', color: 0xff7b54 },
    ], 15, (mode) => { if (mode !== this.current) onModeChange(mode); });
    addAll(this.modeControl.parts);
    this.modeHint = add(scene.add.text(cx, 688, 'tap to change difficulty', {
      fontFamily: FONT, fontSize: '14px', color: SMALL,
    }).setOrigin(0.5));

    // The one filled button, in the card's shape: the primary action is
    // itself an offer. HOW TO PLAY beneath it opens the explainers.
    addAll(cardButton(scene, cx, 732, 380, 64, 0x3ecf7a, 'START MATCH').bind(onStart).parts);
    addAll(cardButton(scene, cx, 798, 380, 44, LINK, 'HOW TO PLAY', 15, 'secondary').bind(onGuide).parts);

    this.version = add(scene.add.text(cx, 842, '', {
      fontFamily: FONT, fontSize: '14px', color: SMALL,
    }).setOrigin(0.5));

    // The squad, standing on the lane it will stand on: three bodies from the
    // real textures, the leader larger with the visor, at Grey.
    const shirt = tierRow(0).shirt;
    for (const [dx, lead] of [[-26, false], [0, true], [26, false]] as const) {
      const scale = (lead ? SQUAD.leaderScale : 1) * 0.5;
      add(scene.add.image(cx + dx, ARENA.laneY + (lead ? 3 : 2), 'body').setScale(scale).setTint(shirt));
      add(scene.add.image(cx + dx, ARENA.laneY - 20 * scale, lead ? 'head-lead' : 'head').setScale(scale).setTint(SKIN));
    }

    // Hidden until `show`. A container is visible by default, and an opaque
    // panel at depth 60 that nobody asked for covers the entire game.
    this.root = scene.add.container(0, 0, parts).setDepth(60).setVisible(false);
  }

  /** Deals offer `i` onto the three demo tiles. */
  private deal(i: number): void {
    this.demoIndex = i % DEMO_OFFERS.length;
    DEMO_OFFERS[this.demoIndex].forEach((d, k) => {
      this.demo[k].setColor(AXIS_COLOR[d.axis]).set(d.magnitude, d.word);
    });
  }

  /** The demo offer descends, fades at the line, and the next one comes round. */
  private startDemo(): void {
    this.stopDemo();
    const state = { t: 0 };
    this.demoTween = this.scene.tweens.add({
      targets: state, t: 1, duration: DEMO_MS, repeat: -1, ease: 'Linear',
      onUpdate: () => {
        const y = DEMO_FROM + (DEMO_TO - DEMO_FROM) * state.t;
        // In over the first 12%, out over the last 15%; full between.
        const a = Math.min(1, state.t / 0.12, (1 - state.t) / 0.15);
        for (const tile of this.demo) tile.setY(y).setAlpha(a);
      },
      // The cards are invisible at the turn, so the swap is never seen.
      onRepeat: () => this.deal(this.demoIndex + 1),
    });
  }

  private stopDemo(): void {
    this.demoTween?.remove();
    this.demoTween = null;
    this.deal(0);
    for (const tile of this.demo) tile.setY(DEMO_FROM).setAlpha(1);
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
      this.enter.setLabel('ENTER A CODE').setColor(0x6be8d4);
    }, 1600);
  }

  show(p: StartPayload): void {
    this.code.setText(p.code);
    this.caption.setText(p.invited ? 'match code · sent to you' : 'match code · replays this exact run');
    this.current = p.mode;
    this.modeControl.set(p.mode);
    this.modeHint.setText(p.mode === 'hard'
      ? 'faster cards, harder sums · tap to change difficulty'
      : 'tap to change difficulty');
    this.version.setText(`v${p.version}`);
    this.root.setVisible(true);
    this.startDemo();
  }

  hide(): void {
    this.root.setVisible(false);
    this.stopDemo();
  }
}
