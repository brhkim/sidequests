import Phaser from 'phaser';
import { DIFFICULTY, VIEW } from '../../config';
import { AXIS_COLOR } from '../../data/gates';
import { MAX_SENSE } from '../../systems/Progression';
import { compact, FONT, hex, SMALL, type HudPayload } from './types';

/** Height of the whole rail, including the standing bar along its lower edge. */
export const RAIL_HEIGHT = 72;
/** The rail's right edge is the pause button's; the four columns share the rest. */
export const RAIL_PAUSE_WIDTH = 80;

const LABEL = SMALL;
const VALUE = '#e8ecf8';

/**
 * Four columns, ordered by how load-bearing they are rather than by tradition.
 *
 * ARMY used to sit here and now lives in the strip beneath the red line with
 * the other DPS inputs: it is a conversion input exactly as the damage pool
 * is, and it was the one term of the DPS product that lived at the top of the
 * screen while the rest lived at the bottom. SENSE takes its place because it
 * is the one bonus that is NOT a DPS input - it is about the player, not the
 * squad - so the rail is now "the run" (wave, you against par, your read on
 * the offers) and the strip is "the squad".
 */
// The words a first-time player reads, with the game's own in them: YOUR
// DPS is damage per second, PAR DPS the shadow player's, and the PAR
// column's sub-line says whose it is (the author, 2026-09-20: nothing on
// screen may assume the reader knows what PAR is).
const COLUMNS = ['WAVE', 'YOUR DPS', 'PAR DPS', 'SENSE'] as const;

/**
 * Par DPS is on screen permanently rather than saved for the death readout.
 * Watching yourself fall behind the curve while three gates descend is the
 * feedback that makes the next pick mean something; after the run it is only a
 * post-mortem.
 *
 * One instrument rides on it: the standing bar, which flashes once when the
 * run crosses the curve's target line in either direction - no continuous
 * pulse, because a bar that is always moving says nothing.
 */
export class TopRail {
  private readonly values: Phaser.GameObjects.Text[] = [];
  private readonly subs: Phaser.GameObjects.Text[] = [];
  private readonly barTrack: Phaser.GameObjects.Rectangle;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private above: boolean | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const lane = (VIEW.width - RAIL_PAUSE_WIDTH) / COLUMNS.length;

    COLUMNS.forEach((name, i) => {
      const cx = lane * i + lane / 2;
      scene.add.text(cx, 9, name, {
        fontFamily: FONT, fontSize: '14px',
        color: name === 'SENSE' ? hex(AXIS_COLOR.sense) : LABEL, fontStyle: 'bold',
      }).setOrigin(0.5, 0).setLetterSpacing(1.4);

      this.values.push(scene.add.text(cx, 22, '-', {
        fontFamily: FONT, fontSize: '23px', color: VALUE, fontStyle: 'bold',
      }).setOrigin(0.5, 0));

      // Sub-lines sit on one baseline under non-adjacent columns, so no two of
      // them can ever grow into each other.
      this.subs.push(scene.add.text(cx, 49, '', {
        fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: LABEL,
      }).setOrigin(0.5, 0).setLetterSpacing(1));
    });

    const barY = RAIL_HEIGHT - 6;
    this.barTrack = scene.add.rectangle(0, barY, VIEW.width, 6, 0x232b40).setOrigin(0, 0);
    this.barFill = scene.add.rectangle(0, barY, 0, 6, 0x6ee7a0).setOrigin(0, 0);
    // The curve expects targetFraction of par. Marking it turns the bar from a
    // vague gauge into a pass/fail line you can read without thinking.
    scene.add.rectangle(
      Math.round(VIEW.width * DIFFICULTY.targetFraction), barY - 3, 3, 12, 0xffffff, 0.95,
    ).setOrigin(0.5, 0);
  }

  update(h: HudPayload): void {
    const ratio = h.parDps > 0 ? h.dps / h.parDps : 1;
    const color = standingColor(ratio);

    this.values[0].setText(String(h.wave));
    this.values[1].setText(compact(h.dps)).setColor(color);
    this.values[2].setText(compact(h.parDps));
    // Three pips that fill: the author's picture of it, and it reads at a
    // glance where "2/3" has to be parsed. The chance is the sub-line, so the
    // number the pause screen explains is on screen the whole time.
    this.values[3].setText(sensePips(h.sense))
      .setColor(h.sense > 0 ? hex(AXIS_COLOR.sense) : '#4d5670');

    this.subs[0].setText(`${compact(h.kills)} KILLS`);
    this.subs[2].setText('BEST PLAY');
    // Past 999% the exact number has stopped being information, and the column
    // is 135px wide.
    const percent = Math.round(ratio * 100);
    this.subs[1].setText(percent > 999 ? '>999% PAR' : `${percent}% PAR`).setColor(color);
    this.subs[3].setText(h.sense > 0 ? `${Math.round(h.senseChance * 100)}% MARKED` : '')
      .setColor(hex(AXIS_COLOR.sense));

    this.barFill.width = Math.max(1, Math.min(1, ratio) * VIEW.width);
    this.barFill.fillColor = Phaser.Display.Color.HexStringToColor(color).color;
    const above = ratio >= DIFFICULTY.targetFraction;
    if (this.above !== null && above !== this.above) this.flashBar();
    this.above = above;
  }

  /** One-shot on crossing the target line: the bar swells 6 to 10 and back. */
  private flashBar(): void {
    this.scene.tweens.killTweensOf([this.barTrack, this.barFill]);
    this.scene.tweens.add({
      targets: [this.barTrack, this.barFill], height: 10, y: RAIL_HEIGHT - 8,
      duration: 300, yoyo: true, ease: 'Quad.easeOut',
    });
  }

  reset(): void {
    this.above = null;
    this.scene.tweens.killTweensOf([this.barTrack, this.barFill]);
    this.barTrack.setSize(VIEW.width, 6).setY(RAIL_HEIGHT - 6);
    this.barFill.height = 6;
    this.barFill.y = RAIL_HEIGHT - 6;
  }
}

/** `●●○` at two of three. Exported so the pause screen draws the same glyphs. */
export function sensePips(sense: number): string {
  let s = '';
  for (let i = 0; i < MAX_SENSE; i++) s += i < sense ? '●' : '○';
  return s;
}

export function standingColor(ratio: number): string {
  if (ratio >= 1) return '#6ee7a0';
  if (ratio >= DIFFICULTY.targetFraction) return '#ffd166';
  if (ratio >= DIFFICULTY.targetFraction * 0.65) return '#ff9f4a';
  return '#ff5566';
}
