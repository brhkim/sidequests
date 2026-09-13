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
}

/** Thousands get a suffix: a six-digit DPS would blow the rail's column. */
export function compact(value: number): string {
  const v = Math.round(value);
  if (v < 1000) return String(v);
  if (v < 10_000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (v < 1_000_000) return Math.round(v / 1000) + 'k';
  if (v < 10_000_000) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v < 1_000_000_000) return Math.round(v / 1e6) + 'M';
  if (v < 10_000_000_000) return (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  return Math.round(v / 1e9) + 'B';
}

/** Multipliers read to two decimals until they get big enough not to need it. */
export function formatMult(value: number): string {
  if (value >= 100) return '×' + Math.round(value);
  if (value >= 10) return '×' + value.toFixed(1);
  return '×' + value.toFixed(2);
}

export function hex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}
