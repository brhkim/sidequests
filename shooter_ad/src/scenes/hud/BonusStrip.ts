import Phaser from 'phaser';
import { HUD_ROWS } from '../../config';
import { AXIS_COLOR } from '../../data/gates';
import { MOTION, TYPE } from '../theme';
import { CHIP, CHIP_BLEED, chipX } from './HudLayout';
import { HudText } from './HudText';
import { compact, FONT, formatMult, type HudPayload } from './types';

/** The strip's height; the field begins beneath the rail and the strip. */
export const STRIP_HEIGHT = HUD_ROWS.strip;

const PRIMARY = 0xf2f3ff;
const SECONDARY = 0xb7bad8;
/** A chip you hold nothing on: dimmed, not hidden, so it still reads. */
const UNHELD = 0.5;
const FLASH_MS = 500;

/**
 * The squad's DPS inputs, directly beneath the rail, as five chips.
 *
 * It sat beneath the breach line until the author played on a phone: the
 * thumb steering the squad covered it. Under the rail the two readouts are
 * one glance - the run above, the squad below it.
 *
 * Why it has to exist: a raw bonus draws `a = (root - 1) * (1 + pool)`, so
 * `+31% DMG` against `×1.25 DMG` is only decidable if you know your damage
 * pool is 210%. Without the pool on screen the central judgement of the game
 * is a coin flip.
 *
 * Five chips in the order the pause screen's DETAILS page multiplies them:
 * bodies, damage, rate, guns, pierce. Legibility, in a 540x94 strip:
 *
 * - The POOL is the big number and the multiplier the small one beneath it,
 *   because the pool is what the conversion needs.
 * - Everything is LEFT-aligned on one x per chip, so a digit appearing does
 *   not shuffle a chip sideways mid-wave, and the three rows (axis word,
 *   pool, multiplier) line up across the strip like a table.
 * - Chips are UNEQUAL: DMG and RATE are sized for `+1.84K%` at the number
 *   size, GUNS and PIERCE for a digit over a multiplier; anything wider still
 *   is scaled into its chip (`HudText`) rather than allowed to run on.
 * - A chip you hold nothing on dims, face and figures, so what you actually
 *   have pops without reading any of it.
 *
 * A chip that changes punches its figure and flashes its face in the colour
 * of WHY it changed: the grade of the pick, green for army gained, red for
 * army lost. `prime` sets that colour from the event; the next change spends
 * it.
 */
/** The ARMY chip's third line, where its `-N` lands. */
const FLOAT_Y = CHIP.top + 53;
const CELLS = [
  { axis: 'army' as const, label: 'ARMY' },
  { axis: 'damage' as const, label: 'DMG' },
  { axis: 'rate' as const, label: 'RATE' },
  { axis: 'guns' as const, label: 'GUNS' },
  { axis: 'pierce' as const, label: 'PIERCE' },
];

interface Chip {
  face: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  label: HudText;
  main: HudText;
  sub: HudText;
  held: boolean | null;
  last: string;
  /** Bumped per flash, so an older flash's colour restore cannot cut a newer one short. */
  flashes: number;
}

export class BonusStrip {
  private readonly chips: Chip[] = [];
  private readonly floater: Phaser.GameObjects.Text;
  private readonly floatX: number;
  private pending: number | null = null;
  /** The inputs last drawn: an unchanged frame builds no strings at all. */
  private readonly seen = new Float64Array(8).fill(NaN);

  constructor(private readonly scene: Phaser.Scene) {
    CELLS.forEach((spec, i) => {
      const w = CHIP.widths[i];
      const x = chipX(i);
      const inner = w - 2 * CHIP.pad;
      const tx = x + CHIP.pad;
      this.chips.push({
        face: scene.add.image(x - CHIP_BLEED.x, CHIP.top - CHIP_BLEED.top, `hud-chip-${w}`).setOrigin(0, 0),
        glow: scene.add.image(x - CHIP_BLEED.x, CHIP.top - CHIP_BLEED.top, `hud-chipglow-${w}`)
          .setOrigin(0, 0).setAlpha(0).setVisible(false),
        label: new HudText(scene, tx, CHIP.top + 7,
          { size: TYPE.caption.size, weight: TYPE.label.weight, tracking: TYPE.label.tracking },
          0, 0, inner, spec.label, AXIS_COLOR[spec.axis]),
        main: new HudText(scene, tx, CHIP.top + 21, { size: TYPE.number.size, weight: TYPE.number.weight },
          0, 0, inner, '', PRIMARY),
        sub: new HudText(scene, tx, CHIP.top + 53, { size: 16, weight: '700' }, 0, 0, inner, '', SECONDARY),
        held: null,
        last: '',
        flashes: 0,
      });
    });
    // `-N` in the ARMY chip's own third line, which ARMY never uses (an
    // army has no multiplier): the loss lands beside the figure it came off,
    // and cannot rise into the rail's kill count the way it once did.
    this.floatX = chipX(0) + CHIP.pad;
    this.floater = scene.add.text(this.floatX, FLOAT_Y, '', {
      fontFamily: FONT, fontSize: '18px', color: '#ffffff', fontStyle: '800',
    }).setOrigin(0, 0).setDepth(1).setVisible(false);
  }

  update(h: HudPayload): void {
    // Every input compared (no short-circuit, so `seen` stays current).
    const changed = +this.swap(0, h.power) + +this.swap(1, h.damageBonus) + +this.swap(2, h.damageMult)
      + +this.swap(3, h.rateBonus) + +this.swap(4, h.rateMult) + +this.swap(5, h.guns)
      + +this.swap(6, h.pierce) + +this.swap(7, h.pierceMult);
    if (changed === 0) { this.pending = null; return; }
    // Army: power alone, always held - there is no identity for an army.
    this.set(0, compact(h.power), '', true);
    // Multiplier lines are blank at identity: five `×1.00` are furniture the
    // eye has to step over to find the one that changed.
    this.set(1, `+${compact(h.damageBonus * 100)}%`, multOrBlank(h.damageMult),
      h.damageBonus > 0 || h.damageMult > 1);
    this.set(2, `+${compact(h.rateBonus * 100)}%`, multOrBlank(h.rateMult),
      h.rateBonus > 0 || h.rateMult > 1);
    this.set(3, compact(h.guns), multOrBlank(h.guns), h.guns > 1);
    // Pierce shows what it is actually worth, from the same valuation par
    // prices it with - a bare `2` says nothing about what a level buys.
    this.set(4, compact(h.pierce), multOrBlank(h.pierceMult), h.pierce > 0);
    this.pending = null;
  }

  private swap(i: number, v: number): boolean {
    if (this.seen[i] === v) return false;
    this.seen[i] = v;
    return true;
  }

  /** The colour the next changed chip flashes in; spent by the next `update`. */
  prime(color: number): void { this.pending = color; }

  /** Flash a chip now, whatever changed, e.g. ARMY on a batch of fire hits. */
  flashCell(index: number, color: number, ms = FLASH_MS): void {
    this.flash(this.chips[index], color, ms);
  }

  /** `-3` punching into the ARMY chip's empty third line, then lifting away. */
  float(text: string, color: number): void {
    const f = this.floater;
    this.scene.tweens.killTweensOf(f);
    if (f.text !== text) f.setText(text);
    f.setTint(color).setPosition(this.floatX, FLOAT_Y).setAlpha(1).setScale(MOTION.punchScale).setVisible(true);
    this.scene.tweens.add({ targets: f, scale: 1, duration: MOTION.snap, ease: MOTION.snapEase });
    this.scene.tweens.add({
      targets: f, y: FLOAT_Y - 4, alpha: 0, delay: 360, duration: 420, ease: MOTION.exitEase,
      onComplete: () => f.setVisible(false),
    });
  }

  reset(): void {
    for (const chip of this.chips) chip.last = '';
    this.seen.fill(NaN);
    this.pending = null;
    this.scene.tweens.killTweensOf(this.floater);
    this.floater.setVisible(false);
  }

  private set(index: number, main: string, sub: string, held: boolean): void {
    const chip = this.chips[index];
    chip.main.set(main);
    chip.sub.set(sub);

    if (held !== chip.held) {
      chip.held = held;
      const a = held ? 1 : UNHELD;
      chip.face.setAlpha(held ? 1 : 0.55);
      chip.label.text.setAlpha(a);
      chip.main.text.setAlpha(a);
      chip.sub.text.setAlpha(a);
    }

    // A gate you drove through has to register somewhere other than the
    // field, where the wash is already gone by the time the next offer comes.
    const signature = `${main}|${sub}`;
    if (chip.last !== '' && chip.last !== signature) this.flash(chip, this.pending ?? 0xffffff, FLASH_MS);
    chip.last = signature;
  }

  private flash(chip: Chip, color: number, ms: number): void {
    const { glow, main } = chip;
    this.scene.tweens.killTweensOf(glow);
    glow.setTint(color).setAlpha(0.42).setVisible(true);
    this.scene.tweens.add({
      targets: glow, alpha: 0, duration: ms, ease: 'Quad.easeOut',
      onComplete: () => glow.setVisible(false),
    });
    main.tint(color).punch();
    const id = ++chip.flashes;
    this.scene.time.delayedCall(ms * 0.7, () => { if (chip.flashes === id) main.tint(PRIMARY); });
  }
}

function multOrBlank(mult: number): string {
  return mult > 1 ? formatMult(mult) : '';
}
