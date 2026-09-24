import { HUD_ROWS, VIEW } from '../../config';

/**
 * The HUD band's geometry, shared by the pieces that draw it and by
 * `art/ui.ts`, which bakes a texture to each of these sizes once at boot.
 *
 * The band is three fixed rows (`HUD_ROWS`: rail 72, strip 94, Titan row 18;
 * its bottom is the spawn line). Inside them:
 *
 *   rail   WAVE | the duel (YOUR DPS against PAR over one tug bar) | SENSE | SHIELD | PAUSE
 *   strip  five chips, the DPS inputs in the order DETAILS multiplies them
 *   titan  the boss's HP bar, only while one lives
 */
export const HUD_W = VIEW.width;
/** The rail and the strip are one baked panel; the Titan row is its own. */
export const PANEL_H = HUD_ROWS.rail + HUD_ROWS.strip;
/** The soft baked shadow each panel casts onto the field beneath it. */
export const SHADOW_H = 14;

/** WAVE's column, left-aligned. */
export const WAVE_X = 12;

/**
 * The duel: an inset well holding your figure (big, lit in the standing
 * colour) against par's (smaller, neutral), with the tug bar under both.
 */
export const DUEL = { x: 92, y: 2, w: 214, h: 68, pad: 10 } as const;
/** The tug bar: your colour from the left, par's grey from the right, even at the centre. */
export const BAR = { x: DUEL.x + DUEL.pad, y: 44, w: DUEL.w - 2 * DUEL.pad, h: 6 } as const;

/** SENSE and SHIELD, left-aligned in the space between the duel and PAUSE. */
export const SENSE_X = 314;
export const SHIELD_X = 406;
/** Sense pips: drawn, not glyphs. */
export const PIP = { size: 12, gap: 4 } as const;

/**
 * The five chips. Unequal widths, sized to what each has to hold at the late
 * state: DMG and RATE carry `+1.84K%` at the number size, GUNS and PIERCE a
 * single digit over a multiplier.
 */
export const CHIP = {
  top: HUD_ROWS.rail + 8,
  h: 78,
  margin: 10,
  gap: 6,
  pad: 10,
  widths: [100, 118, 118, 80, 80] as const,
} as const;
/** Padding baked around a chip face so its shadow is inside the texture. */
export const CHIP_BLEED = { x: 5, top: 3, bottom: 8 } as const;

export function chipX(index: number): number {
  let x = CHIP.margin;
  for (let i = 0; i < index; i++) x += CHIP.widths[i] + CHIP.gap;
  return x;
}

/** The pause face, baked to `PAUSE_BUTTON`'s size (which GameScene hit-tests). */
export const PAUSE_BLEED = { x: 5, top: 3, bottom: 8 } as const;

/** The Titan row: a tag at the left, the HP bar across the rest. */
export const TITAN_ROW = { y: PANEL_H, h: HUD_ROWS.titanRow } as const;
export const TITAN_BAR = { x: 68, w: HUD_W - 68 - 10, h: 8 } as const;

/** One lane of the stage banner; three abut across the field. */
export const BAND = { lane: HUD_W / 3, h: 84, y: 330 } as const;

/** The damage vignette's baked depth (drawn thinner or thicker by share). */
export const EDGE_DEPTH = 128;
