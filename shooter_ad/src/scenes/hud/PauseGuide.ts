import Phaser from 'phaser';
import { VIEW } from '../../config';
import { cardButton, type CardButton } from './CardTile';
import { FONT, SMALL, hex } from './types';

interface Topic { key: string; label: string; color: number; text: string }

/**
 * The HOW TO PLAY page: the game explained to somebody who has never seen
 * it, one topic at a time. Twelve topic buttons in two columns; tapping one
 * puts its explanation beneath the grid, the way the BONUSES page's tiles
 * do (the author, 2026-09-20: the tappable explainers are the right idea,
 * and everything assumed the reader already knew what PAR and RISK meant).
 *
 * The copy never uses a term before it has said what the term is, and it
 * says the game's words - PAR, DPS, RISK - beside their plain meaning, so
 * the rail and the strip read afterwards. It reaches the same screen from
 * the start screen (HOW TO PLAY) and from pause.
 */
const TOPICS: readonly Topic[] = [
  { key: 'goal', label: 'THE GOAL', color: 0x3ecf7a, text:
    'Your squad walks where your finger is and fires straight up by itself. Every few seconds three bonus cards fall toward you. Walk under the one that will raise your damage the most, and survive as many waves as you can.' },
  { key: 'cards', label: 'THE CARDS', color: 0xff6b4a, text:
    'A card names a stat and how much it grows: +25% DMG, ×1.25 DMG, +1 GUNS, +12 ARMY. You get whichever card you are standing under when the row reaches your line - only one of the three. Stand between cards and you get nothing (a MISS).' },
  { key: 'sum', label: 'THE SUM', color: 0xffc93c, text:
    '+% cards add to a pool you keep; × cards multiply. Once the pool is big, a +% card is worth less than it looks: at +200%, a +30% card is only ×1.10. So which card is bigger depends on what you already hold. A × ARMY card always adds at least one soldier. The BONUSES tab does this sum with your own numbers.' },
  { key: 'panels', label: 'THE TOP PANELS', color: 0x9fe8ff, text:
    'Top row: the wave, your damage per second (DPS) beside PAR\'s, and your SENSE pips. The bar under it is you against PAR; the white tick is the pass mark. The second panel is everything you hold, one cell per stat, in the cards\' own colours.' },
  { key: 'damage', label: 'TAKING DAMAGE', color: 0xff4d5e, text:
    'Enemies walk down the screen. One that touches your squad, or slips past it over the red line, takes soldiers away - more for bigger enemies. Enemy shots cost a little too. At zero soldiers the run ends.' },
  { key: 'titan', label: 'THE TITAN', color: 0xbf8fdc, text:
    'Every 5th wave a huge boss descends slowly. Its purple health bar sits under the top panels. Kill it before it reaches you or the run ends on the spot. PIERCE does nothing against it: it is one body.' },
  { key: 'rescue', label: 'RESCUES', color: 0xb9a06a, text:
    'Now and then a cage of captured soldiers drifts down. Shoot it open before it leaves the screen and a tenth of your army joins you, at least 2. PAR never gets these - a rescue is how you make back what enemy fire has chipped away.' },
  { key: 'par', label: 'PAR', color: 0x6ee7a0, text:
    'PAR is a shadow player who takes the best card every single time. Enemies get tougher as PAR grows, not as waves pass - so the game is exactly as hard as your picks are bad. Keep your DPS near PAR\'s and you are fine.' },
  { key: 'risk', label: 'RISK', color: 0xc9a7ff, text:
    'MOVE, TIME and SENSE add no damage. MOVE: walk faster. TIME: cards fall slower. SENSE: some offers arrive with the best card outlined in white. PAR never takes them and the score counts them as no growth - a gamble, for when the help is worth more than the damage.' },
  { key: 'score', label: 'THE SCORE', color: 0xffd166, text:
    'Every card you take is graded against the best of its three: PERFECT, GOOD or BAD. A gamble is RISK; a card you never reached is MISS. The end screen\'s percentage is how much of the possible growth you captured. Waves survived is the headline.' },
  { key: 'code', label: 'MATCH CODES', color: 0x9fe8ff, text:
    'A code replays the exact same run: same cards, same enemies, same timing. Share it and a friend plays your match, so you can compare scores. Type one in on the start screen, or copy the link on the end screen.' },
  { key: 'hard', label: 'HARD MODE', color: 0xff7b54, text:
    'Hard starts the run five waves in: cards fall faster from the first offer, the numbers are harder to compare (×1.35 against +47%), and the cards narrow sooner. Enemies are no tougher - only the decision is.' },
];

const GRID_TOP = 114;
const COLS = 2;
const BUTTON_W = 240;
const BUTTON_H = 44;
const GAP = 8;

export class PauseGuide {
  readonly root: Phaser.GameObjects.Container;
  private readonly buttons: CardButton[] = [];
  private readonly head: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const cx = VIEW.width / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    TOPICS.forEach((t, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      const x = cx - (BUTTON_W + GAP) / 2 + col * (BUTTON_W + GAP);
      const y = GRID_TOP + BUTTON_H / 2 + row * (BUTTON_H + GAP);
      const b = cardButton(scene, x, y, BUTTON_W, BUTTON_H, t.color, t.label, 14, 'secondary')
        .bind(() => this.select(i));
      this.buttons.push(b);
      parts.push(...b.parts);
    });
    const rows = Math.ceil(TOPICS.length / COLS);
    const gridBottom = GRID_TOP + rows * (BUTTON_H + GAP) - GAP;
    parts.push(scene.add.text(cx, gridBottom + 8, 'tap a topic', {
      fontFamily: FONT, fontSize: '14px', color: SMALL,
    }).setOrigin(0.5, 0));
    this.head = scene.add.text(26, gridBottom + 34, '', {
      fontFamily: FONT, fontSize: '14px', color: SMALL, fontStyle: 'bold',
    }).setOrigin(0, 0).setLetterSpacing(1.5);
    // The page's only content: the working-text step, a shade above caption.
    this.body = scene.add.text(26, gridBottom + 56, '', {
      fontFamily: FONT, fontSize: '17px', color: '#c9d2ea', wordWrap: { width: VIEW.width - 52 },
    }).setOrigin(0, 0).setLineSpacing(4);
    parts.push(this.head, this.body);
    this.root = scene.add.container(0, 0, parts).setVisible(false);
    this.select(0);
  }

  private select(i: number): void {
    this.buttons.forEach((b, j) => b.setActive(j === i));
    this.head.setText(TOPICS[i].label).setColor(hex(TOPICS[i].color));
    this.body.setText(TOPICS[i].text);
  }
}
