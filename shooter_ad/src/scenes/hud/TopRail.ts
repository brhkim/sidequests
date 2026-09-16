import Phaser from 'phaser';
import { DIFFICULTY, VIEW } from '../../config';
import { compact, hex, type HudPayload } from './types';

/** Height of the whole rail, including the standing bar along its lower edge. */
export const RAIL_HEIGHT = 72;

const LABEL = '#6f7b99';
const VALUE = '#e8ecf8';

/**
 * Five columns, ordered by how load-bearing they are rather than by tradition.
 *
 * ARMY carries power, not kills, because a `+4 ARMY` gate is drawn as a share
 * of the power you are holding - so power is a conversion input exactly like
 * the damage pool is, and kills are flavour. Kills survive as WAVE's sub-line.
 */
// SQUAD (bodies on screen) was dropped: it sat beside ARMY (power) and the two
// read as competing answers to one question. Power is what every bonus converts
// against, so it is the number that belongs here; the bodies are visible in the
// formation itself.
const COLUMNS = ['WAVE', 'ARMY', 'DPS', 'PAR'] as const;

/**
 * Par DPS is on screen permanently rather than saved for the death readout.
 * Watching yourself fall behind the curve while three gates descend is the
 * feedback that makes the next pick mean something; after the run it is only a
 * post-mortem.
 */
export class TopRail {
  private readonly values: Phaser.GameObjects.Text[] = [];
  private readonly subs: Phaser.GameObjects.Text[] = [];
  private readonly barFill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    const lane = VIEW.width / COLUMNS.length;

    COLUMNS.forEach((name, i) => {
      const cx = lane * i + lane / 2;
      scene.add.text(cx, 9, name, {
        fontFamily: 'system-ui, sans-serif', fontSize: '11px',
        color: LABEL, fontStyle: 'bold',
      }).setOrigin(0.5, 0).setLetterSpacing(1.4);

      this.values.push(scene.add.text(cx, 22, '-', {
        fontFamily: 'system-ui, sans-serif', fontSize: '23px',
        color: VALUE, fontStyle: 'bold',
      }).setOrigin(0.5, 0));

      // Sub-lines sit on one baseline under non-adjacent columns, so no two of
      // them can ever grow into each other.
      this.subs.push(scene.add.text(cx, 50, '', {
        fontFamily: 'system-ui, sans-serif', fontSize: '11px', fontStyle: 'bold',
        color: LABEL,
      }).setOrigin(0.5, 0).setLetterSpacing(1));
    });

    const barY = RAIL_HEIGHT - 6;
    scene.add.rectangle(0, barY, VIEW.width, 6, 0x1b2236).setOrigin(0, 0);
    this.barFill = scene.add.rectangle(0, barY, 0, 6, 0x6ee7a0).setOrigin(0, 0);
    // The curve expects targetFraction of par. Marking it turns the bar from a
    // vague gauge into a pass/fail line you can read without thinking.
    scene.add.rectangle(
      Math.round(VIEW.width * DIFFICULTY.targetFraction), barY - 2, 2, 10, 0xffffff, 0.7,
    ).setOrigin(0.5, 0);
  }

  update(h: HudPayload): void {
    const ratio = h.parDps > 0 ? h.dps / h.parDps : 1;
    const color = standingColor(ratio);

    this.values[0].setText(String(h.wave));
    this.values[1].setText(compact(h.power));
    this.values[2].setText(compact(h.dps)).setColor(color);
    this.values[3].setText(compact(h.parDps));

    this.subs[0].setText(`${compact(h.kills)} KILLS`);
    this.subs[1].setText(h.tierName.toUpperCase()).setColor(hex(h.tierColor));
    // Past 999% the exact number has stopped being information, and the column
    // is 108px wide.
    const percent = Math.round(ratio * 100);
    this.subs[2].setText(percent > 999 ? '>999% PAR' : `${percent}% PAR`).setColor(color);

    this.barFill.width = Math.max(1, Math.min(1, ratio) * VIEW.width);
    this.barFill.fillColor = Phaser.Display.Color.HexStringToColor(color).color;
  }
}

function standingColor(ratio: number): string {
  if (ratio >= 1) return '#6ee7a0';
  if (ratio >= DIFFICULTY.targetFraction) return '#ffd166';
  if (ratio >= DIFFICULTY.targetFraction * 0.65) return '#ff9f4a';
  return '#ff5566';
}
