/**
 * The highway world's shared tokens (2026-09-24, the visual redesign).
 *
 * The field is a three-lane note highway: offers are notes descending their
 * lanes, the lane line is the judgment line, the breach line is the fail
 * line. The ground stays a NEAR-NEUTRAL dark so every creature hue, axis
 * colour and rank shirt keeps its contrast - the highway's own light is a
 * cool, low-saturation white that never competes with a colour that means
 * something (the One Word Rule survives the redesign: axis, rank, creature
 * and grade colours are vocabulary and live in `data/` and `hud/types`).
 *
 * Everything here is rendering. Nothing in `systems/` may import it.
 */

/** Surfaces, darkest first. */
export const SURFACE = {
  /** Beyond the highway: the canvas clear and the page background. */
  void: 0x07070d,
  /** The highway's lane beds. */
  lane: 0x0d0e18,
  /** The centre lane is one step lighter so three lanes read without lines. */
  laneCentre: 0x10111d,
  /** HUD panels and screen backings. */
  panel: 0x0b0b15,
  /** Raised panel: tiles, chips, inactive buttons. */
  raised: 0x151625,
  /** A 1px rule between panel regions. */
  hairline: 0x262840,
} as const;

/** The highway's own light: cool, desaturated, never a vocabulary colour. */
export const LIGHT = {
  /** Lane dividers and beat lines. */
  rail: 0xc9ccff,
  /** The judgment line's core. */
  judgment: 0xeef0ff,
  /** The fail (breach) line - danger red, the one warm light on the road. */
  fail: 0xff3b5c,
} as const;

/** Text colours as CSS strings (Phaser Text takes strings). */
export const INK = {
  primary: '#f2f3ff',
  secondary: '#b7bad8',
  caption: '#8d91b4',
  /** The floor: nothing dimmer than this is text (~4.6:1 on `panel`). */
  small: '#737799',
} as const;

/** Motion grammar: everything lands on the beat. Durations in ms. */
export const MOTION = {
  /** An entrance: snaps in with a small overshoot. */
  snap: 140,
  snapEase: 'Back.easeOut',
  /** A value change: the figure punches up and settles. */
  punch: 180,
  punchScale: 1.18,
  punchEase: 'Quad.easeOut',
  /** Screen-to-screen: a three-lane wipe, staggered by lane. */
  wipe: 260,
  wipeStagger: 40,
  /** Exits never overshoot. */
  exitEase: 'Cubic.easeIn',
} as const;

/**
 * One type scale, Saira Semi Condensed throughout (`FONT` in `hud/types`).
 * Sizes in px at the 540x960 logical canvas; under `Scale.FIT` a 390px phone
 * draws them at ~0.72, so nothing below 13 (the Phone Floor survives).
 * `weight` is a CSS weight; Phaser Text takes it through `fontStyle`
 * (e.g. 'bold' = 700, or the numeric string '800').
 */
export const TYPE = {
  /** The title and the end screen's headline figure. */
  display: { size: 56, weight: '800' },
  headline: { size: 112, weight: '800' },
  /** Screen headings (PAUSED, OVERRUN) and the grade words (slanted). */
  heading: { size: 30, weight: '800' },
  grade: { size: 30, weight: '800', style: 'italic' },
  /** A card's magnitude and the HUD's lead figures. */
  number: { size: 26, weight: '800' },
  value: { size: 22, weight: '700' },
  /** Button words. */
  button: { size: 20, weight: '700', tracking: 1.5 },
  body: { size: 17, weight: '500' },
  /** Axis words, column names: tracked caps. */
  label: { size: 14, weight: '600', tracking: 1.6 },
  caption: { size: 13, weight: '600', tracking: 0.6 },
} as const;

/** Corner radii: notes and tiles, buttons, chips. */
export const RADIUS = { card: 9, button: 12, chip: 6 } as const;
