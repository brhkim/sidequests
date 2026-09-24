import Phaser from 'phaser';
import { DIFFICULTY, HUD_ROWS } from '../../config';
import { AXIS_COLOR } from '../../data/gates';
import { MAX_SENSE } from '../../systems/Progression';
import { TYPE } from '../theme';
import { BAR, DUEL, PIP, SENSE_X, SHIELD_X, WAVE_X } from './HudLayout';
import { HudText } from './HudText';
import { compact, type HudPayload } from './types';

/** Height of the whole rail; the strip starts beneath it. */
export const RAIL_HEIGHT = HUD_ROWS.rail;
/** The rail's right-hand area is the pause button's (`PAUSE_BUTTON`). */
export const RAIL_PAUSE_WIDTH = 80;

/** Ink as tints: every rail text is rendered white and coloured by tint. */
const PRIMARY = 0xf2f3ff;
const SECONDARY = 0xb7bad8;
const CAPTION = 0x8d91b4;
/** An axis you hold none of: its figure drawn at the text floor. */
const EMPTY = 0x5d6180;
/** Kills tick many times a second late on; the rail re-renders them at 4Hz. */
const KILLS_EVERY_MS = 250;

const LABEL = { size: 13, weight: TYPE.label.weight, tracking: TYPE.label.tracking };
const SUB = { size: TYPE.caption.size, weight: TYPE.caption.weight, tracking: TYPE.caption.tracking };

/**
 * The run: WAVE, then the duel - YOUR DPS against PAR - then the two bonuses
 * about the player rather than the squad (SENSE, SHIELD), then PAUSE.
 *
 * The duel is the one question the rail exists to answer, "am I keeping up?",
 * so it is not one column among five any more: your figure is the biggest
 * number on the HUD and wears the standing colour; par's sits smaller and
 * neutral at the other end of the same well; and the tug bar between them
 * splits at `ratio / (1 + ratio)` - dead centre is level with par, your
 * colour past the centre is ahead, par's grey past it is behind. The target
 * tick sits where `DIFFICULTY.targetFraction` of par falls on that bar, and
 * the bar swells once when the run crosses it (no continuous pulse: a bar
 * that is always moving says nothing). PAR DPS keeps its BEST PLAY line and
 * YOUR DPS its `% PAR`, because nothing on screen may assume the reader
 * knows what par is (the author, 2026-09-20).
 *
 * Nothing here re-renders a texture unless the string it shows changed:
 * colours are tints, and `npm run perf` reads uploads per frame.
 */
export class TopRail {
  private readonly wave: HudText;
  private readonly kills: HudText;
  private readonly you: HudText;
  private readonly youSub: HudText;
  private readonly par: HudText;
  private readonly senseLabel: HudText;
  private readonly senseSub: HudText;
  private readonly pips: Phaser.GameObjects.Image[] = [];
  private readonly shield: HudText;
  private readonly shieldSub: HudText;
  private readonly track: Phaser.GameObjects.Image;
  private readonly fill: Phaser.GameObjects.Image;
  private readonly knot: Phaser.GameObjects.Image;
  private above: boolean | null = null;
  private splitPx = -1;
  private senseShown = -1;
  private killsAt = -Infinity;
  private killsShown = -1;
  /** The payload fields last drawn (see `update`). */
  private readonly seen = new Float64Array(8).fill(NaN);

  constructor(private readonly scene: Phaser.Scene) {
    // One baked panel behind the rail AND the strip (`art/ui`), with its lit
    // lower edge and soft shadow onto the field.
    scene.add.image(0, 0, 'hud-panel').setOrigin(0, 0);

    // WAVE, with the kill count under it.
    new HudText(scene, WAVE_X, 3, LABEL, 0, 0, 0, 'WAVE', CAPTION);
    this.wave = new HudText(scene, WAVE_X, 17, { size: 24, weight: '800' }, 0, 0, 70, '-', PRIMARY);
    this.kills = new HudText(scene, WAVE_X, 51, SUB, 0, 0, 72, '', CAPTION);

    // The duel's well, its two labels, the two figures, the bar, the subs.
    scene.add.image(DUEL.x, DUEL.y, 'hud-duel').setOrigin(0, 0);
    const left = DUEL.x + DUEL.pad;
    const right = DUEL.x + DUEL.w - DUEL.pad;
    const inner = DUEL.w - 2 * DUEL.pad;
    new HudText(scene, left, 3, LABEL, 0, 0, 0, 'YOUR DPS', SECONDARY);
    new HudText(scene, right, 3, LABEL, 1, 0, 0, 'PAR DPS', CAPTION);
    this.you = new HudText(scene, left, 11, { size: 31, weight: '800' }, 0, 0, inner * 0.56, '-', PRIMARY);
    this.par = new HudText(scene, right, 20, { size: 21, weight: '700' }, 1, 0, inner * 0.38, '-', SECONDARY);

    const barMid = BAR.y + BAR.h / 2;
    this.track = scene.add.image(BAR.x, barMid, 'hud-bar-track').setOrigin(0, 0.5);
    this.fill = scene.add.image(BAR.x, barMid, 'hud-bar-fill').setOrigin(0, 0.5);
    // Level with par: a quiet notch at the centre, over both sides.
    scene.add.image(BAR.x + BAR.w / 2, barMid, 'hud-px').setDisplaySize(1, BAR.h + 4)
      .setTint(0xc9ccff).setAlpha(0.55);
    // The curve's target: a notch under the bar and a hairline through it.
    const target = DIFFICULTY.targetFraction / (1 + DIFFICULTY.targetFraction);
    const tx = Math.round(BAR.x + BAR.w * target);
    scene.add.image(tx, barMid, 'hud-px').setDisplaySize(1, BAR.h).setAlpha(0.9);
    scene.add.image(tx, BAR.y + BAR.h + 1, 'hud-tick').setOrigin(0.5, 0).setFlipY(true);
    // Where your side meets par's: a white-hot knot riding the split.
    this.knot = scene.add.image(BAR.x, barMid, 'hud-px').setDisplaySize(3, BAR.h + 4);

    this.youSub = new HudText(scene, left, 51, SUB, 0, 0, tx - left - 8, '', PRIMARY);
    new HudText(scene, right, 51, SUB, 1, 0, 0, 'BEST PLAY', CAPTION);

    // SENSE: three drawn pips that fill (the author's picture of it), the
    // chance an offer is marked beneath.
    this.senseLabel = new HudText(scene, SENSE_X, 3, LABEL, 0, 0, 0, 'SENSE', AXIS_COLOR.sense);
    for (let i = 0; i < MAX_SENSE; i++) {
      this.pips.push(scene.add.image(SENSE_X + PIP.size / 2 + i * (PIP.size + PIP.gap), 31, 'hud-pip-off'));
    }
    this.senseSub = new HudText(scene, SENSE_X, 51, SUB, 0, 0, 80, '', AXIS_COLOR.sense);

    // SHIELD: charges ready over the pool's size, READY beneath.
    new HudText(scene, SHIELD_X, 3, LABEL, 0, 0, 0, 'SHIELD', AXIS_COLOR.shield);
    this.shield = new HudText(scene, SHIELD_X, 17, { size: 24, weight: '800' }, 0, 0, 56, '0', EMPTY);
    this.shieldSub = new HudText(scene, SHIELD_X, 51, SUB, 0, 0, 56, '', AXIS_COLOR.shield);
  }

  update(h: HudPayload): void {
    // Kills tick many times a second late on: re-rendered at most at 4Hz.
    const now = this.scene.time.now;
    if (h.kills !== this.killsShown && now - this.killsAt >= KILLS_EVERY_MS) {
      this.killsShown = h.kills;
      this.killsAt = now;
      this.kills.set(`${compact(h.kills)} KILLS`);
    }
    // Everything else changes on events, not per frame: an unchanged frame
    // builds no strings and touches nothing (no short-circuit, so `seen`
    // stays current).
    const changed = +this.swap(0, h.wave) + +this.swap(1, h.dps) + +this.swap(2, h.parDps)
      + +this.swap(3, h.sense) + +this.swap(4, h.senseChance) + +this.swap(5, h.shield)
      + +this.swap(6, h.shieldReady) + +this.swap(7, h.shieldCapacity);
    if (changed === 0) return;

    const ratio = h.parDps > 0 ? h.dps / h.parDps : 1;
    const color = standingTint(ratio);
    this.wave.set(String(h.wave));
    this.you.set(compact(h.dps)).tint(color);
    this.youSub.set(`${compact(ratio * 100)}% PAR`).tint(color);
    this.par.set(compact(h.parDps));

    // The tug: the split moves only when it moves a whole pixel.
    const split = Math.round(BAR.w * (ratio / (1 + ratio)));
    if (split !== this.splitPx) {
      this.splitPx = split;
      this.fill.setCrop(0, 0, Math.max(0, split), BAR.h);
      this.knot.setX(BAR.x + Math.min(BAR.w - 1, Math.max(1, split)));
    }
    this.fill.setTint(color);

    if (h.sense !== this.senseShown) {
      this.senseShown = h.sense;
      this.pips.forEach((p, i) => {
        const lit = i < h.sense;
        p.setTexture(lit ? 'hud-pip-on' : 'hud-pip-off').setTint(lit ? AXIS_COLOR.sense : EMPTY);
      });
      this.senseLabel.text.setAlpha(h.sense > 0 ? 1 : 0.6);
    }
    this.senseSub.set(h.sense > 0 ? `${Math.round(h.senseChance * 100)}% MARKED` : '');

    // Charges ready over the pool's size - `4/6` - the state of the gamble,
    // live, where the offer it came from was read.
    this.shield.set(h.shield > 0 ? `${h.shieldReady}/${h.shieldCapacity}` : '0')
      .tint(h.shield > 0 ? AXIS_COLOR.shield : EMPTY);
    this.shieldSub.set(h.shield > 0 ? 'READY' : '');

    const above = ratio >= DIFFICULTY.targetFraction;
    if (this.above !== null && above !== this.above) this.swell();
    this.above = above;
  }

  private swap(i: number, v: number): boolean {
    if (this.seen[i] === v) return false;
    this.seen[i] = v;
    return true;
  }

  /** One-shot on crossing the target: the bar swells and settles. */
  private swell(): void {
    this.scene.tweens.killTweensOf([this.track, this.fill]);
    this.track.scaleY = 1;
    this.fill.scaleY = 1;
    this.scene.tweens.add({
      targets: [this.track, this.fill], scaleY: 1.9,
      duration: 150, yoyo: true, ease: 'Quad.easeOut',
    });
  }

  reset(): void {
    this.above = null;
    this.killsAt = -Infinity;
    this.killsShown = -1;
    this.seen.fill(NaN);
    this.scene.tweens.killTweensOf([this.track, this.fill]);
    this.track.scaleY = 1;
    this.fill.scaleY = 1;
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

/** `standingColor` as a tint. */
export function standingTint(ratio: number): number {
  return parseInt(standingColor(ratio).slice(1), 16);
}
