/**
 * Numbers on screen, at three significant figures whatever their size (1.5,
 * the author's ask): 999 then 1.00K, 10.2K, 102K, 1.02M and on up the
 * thousands ladder. The run has no ceiling - power is guarded at 1e15 and
 * DPS compounds past it - so every readout that can grow has to read at
 * any size, and a percentage past a thousand is `1.02K%`, not `>999%`.
 *
 * Pure, and imported by `data/gates.ts` for card labels as well as by the
 * HUD, so it lives outside `scenes/`.
 */
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Q', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'] as const;

/** Three significant figures with a thousands suffix; whole below 1000. */
export function compact(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const sign = value < 0 ? '-' : '';
  let v = Math.abs(value);
  if (v < 999.5) return sign + String(Math.round(v));
  let i = 0;
  while (v >= 999.5 && i < SUFFIX.length - 1) { v /= 1000; i++; }
  // Past the table (1e36) the mantissa is left to grow rather than lie.
  const digits = v < 9.995 ? 2 : v < 99.95 ? 1 : 0;
  return sign + v.toFixed(digits) + SUFFIX[i];
}

/**
 * A number that is ALSO a promise - a card's `+12.5%` is the effect the
 * player gets - is shown exactly below 1000 and compacted above, so the
 * label and the applied value cannot disagree where the digits fit.
 */
export function compactLabel(value: number): string {
  return Math.abs(value) < 999.5 ? String(value) : compact(value);
}

/** Multipliers at three figures: `×1.32`, `×10.2`, `×102`, `×1.02K`. */
export function formatMult(value: number): string {
  if (value >= 999.5) return '×' + compact(value);
  if (value >= 99.95) return '×' + Math.round(value);
  if (value >= 9.995) return '×' + value.toFixed(1);
  return '×' + value.toFixed(2);
}
