/**
 * Gates descend in pairs and the player drives through one of them. Adding a
 * powerup means appending an entry here plus one case in Squad.applyGate.
 */
export type GateKind =
  | 'add' | 'mul' | 'sub' | 'div'
  | 'firerate' | 'damage' | 'multishot' | 'pierce'
  | 'shield' | 'slowmo' | 'frenzy';

export interface GateType {
  readonly kind: GateKind;
  /** Magnitude; meaning depends on kind. */
  readonly value: number;
  readonly label: string;
  readonly color: number;
  /** Good gates are green-ish, traps red-ish. Used only for tinting. */
  readonly hostile: boolean;
  readonly weight: number;
  readonly minWave: number;
}

export const GATE_TYPES: readonly GateType[] = [
  // --- army size: the main growth lever -------------------------------------
  { kind: 'add', value: 5,  label: '+5',   color: 0x3ecf7a, hostile: false, weight: 100, minWave: 1 },
  { kind: 'add', value: 12, label: '+12',  color: 0x3ecf7a, hostile: false, weight: 70,  minWave: 3 },
  { kind: 'add', value: 30, label: '+30',  color: 0x3ecf7a, hostile: false, weight: 45,  minWave: 6 },
  { kind: 'mul', value: 2,  label: 'x2',   color: 0x35b8ff, hostile: false, weight: 55,  minWave: 2 },
  { kind: 'mul', value: 3,  label: 'x3',   color: 0x35b8ff, hostile: false, weight: 26,  minWave: 5 },

  // --- traps: the bait half of a pair ---------------------------------------
  { kind: 'sub', value: 10, label: '-10',  color: 0xff5566, hostile: true,  weight: 60,  minWave: 2 },
  { kind: 'div', value: 2,  label: '/2',   color: 0xff5566, hostile: true,  weight: 45,  minWave: 4 },

  // --- weapon upgrades: permanent ------------------------------------------
  { kind: 'firerate',  value: 0.18, label: 'RATE+',  color: 0xffc93c, hostile: false, weight: 55, minWave: 2 },
  { kind: 'damage',    value: 0.25, label: 'DMG+',   color: 0xff8a3c, hostile: false, weight: 55, minWave: 2 },
  { kind: 'multishot', value: 1,    label: '+1 GUN', color: 0xb56bff, hostile: false, weight: 30, minWave: 4 },
  { kind: 'pierce',    value: 1,    label: 'PIERCE', color: 0x6be8d4, hostile: false, weight: 28, minWave: 5 },

  // --- temporary effects ----------------------------------------------------
  { kind: 'shield', value: 1, label: 'SHIELD', color: 0x7fd4ff, hostile: false, weight: 26, minWave: 3 },
  { kind: 'slowmo', value: 1, label: 'SLOW',   color: 0x9ec9ff, hostile: false, weight: 24, minWave: 4 },
  { kind: 'frenzy', value: 1, label: 'FRENZY', color: 0xff5fa2, hostile: false, weight: 22, minWave: 6 },
];

function pick(pool: readonly GateType[], rng: () => number): GateType {
  const total = pool.reduce((sum, g) => sum + g.weight, 0);
  let roll = rng() * total;
  for (const g of pool) {
    roll -= g.weight;
    if (roll <= 0) return g;
  }
  return pool[0];
}

/**
 * A pair always offers a real choice: never two identical gates, and never two
 * traps, so there is always something worth driving into.
 */
export function rollGatePair(wave: number, rng: () => number): [GateType, GateType] {
  const pool = GATE_TYPES.filter((g) => g.minWave <= wave);
  const left = pick(pool, rng);
  const candidates = pool.filter(
    (g) => g !== left && !(g.hostile && left.hostile),
  );
  const right = candidates.length > 0 ? pick(candidates, rng) : left;
  return rng() < 0.5 ? [left, right] : [right, left];
}
