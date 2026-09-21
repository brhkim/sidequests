/**
 * Everything the HUD draws, published once per frame by GameScene.
 *
 * The HUD runs in its own scene so it never inherits the game camera's shake,
 * which means it cannot read the simulation directly - this is the contract
 * between the two.
 */
export interface HudPayload {
  power: number;
  wave: number;
  tier: number;
  tierName: string;
  tierColor: number;
  kills: number;
  capped: boolean;
  /** Bodies actually on screen, capped at the ring. */
  units: number;
  dps: number;
  /** What a player who took the best gate every time would be doing now. */
  parDps: number;
  damageBonus: number;
  damageMult: number;
  rateBonus: number;
  rateMult: number;
  guns: number;
  pierce: number;
  /** Pierce priced by the shared valuation, not by live density. */
  pierceMult: number;
  moveMult: number;
  /** Multiplier ON gate speed; `+TIME` drives it below 1. */
  gateSpeedMult: number;
  sense: number;
  /** Chance an offer arrives with its best option marked, at this sense. */
  senseChance: number;
  /** `+SHIELD` held, whole charges ready to block, and the pool's size. */
  shield: number;
  shieldReady: number;
  shieldCapacity: number;
  /** `+ECHO` held and what par prices it at. */
  echo: number;
  echoMult: number;
  /** The live boss, or null. `progress` is its descent as a fraction. */
  titan: { hpFrac: number; progress: number } | null;
}

/**
 * The grades a pick can earn, in the colours every reader uses. RISK is not
 * a grade on the ladder: it is what a MOVE / TIME / SENSE pick is told
 * instead of PERFECT / GOOD / BAD, because those axes are worth zero DPS and
 * par never takes them (see `RISK_AXES`). Lavender, off every axis colour.
 */
export const GRADE_COLOR = { perfect: 0x3ecf7a, good: 0xffc93c, bad: 0xff4757, risk: 0xc9a7ff } as const;
/** The word for a zero-DPS pick is INVEST on screen (1.5, the author: "for clarity"); the key stays `risk`. */
export const GRADE_WORD = { perfect: 'PERFECT', good: 'GOOD', bad: 'BAD', risk: 'INVEST' } as const;
export type Grade = keyof typeof GRADE_COLOR;

/** The HUD's type roles. System stack only: nothing is fetched at runtime. */
export const FONT = 'system-ui, sans-serif';
export const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** Secondary text, ~7:1 on the dark panels. */
export const CAPTION = '#8f9ab5';
/** The quietest text allowed: ~4.6:1. Nothing dimmer is drawn as text. */
export const SMALL = '#6f7b99';
/** Link teal: every secondary button and text link. */
export const LINK = 0x6be8d4;
export const LINK_HEX = '#6be8d4';
/** The warning colour: the pitch's warning line, HARD, a bad code. */
export const WARNING = '#ff7b54';

/** Three significant figures on the thousands ladder - see `src/format.ts`. */
export { compact, formatMult } from '../../format';

export function hex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}
