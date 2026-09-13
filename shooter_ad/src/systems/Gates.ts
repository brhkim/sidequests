import { GATES, VIEW } from '../config';
import { rollGatePair, type GateType } from '../data/gates';

export interface Gate {
  x: number; y: number;
  width: number;
  type: GateType;
  /** Pair id, so taking one gate consumes its partner. */
  pair: number;
  active: boolean;
}

/**
 * Descending pairs of powerup gates. The player drives the squad through one;
 * the other vanishes. Offering exactly two is what makes the lane movement a
 * decision rather than a dodge.
 */
export class Gates {
  readonly items: Gate[] = [];
  private accum = 0;
  private nextPair = 0;

  constructor(private readonly rng: () => number) {}

  update(dt: number, timeScale: number, wave: number): void {
    this.accum += dt;
    if (this.accum >= GATES.interval) {
      this.accum = 0;
      this.spawnPair(wave);
    }
    for (const g of this.items) {
      if (!g.active) continue;
      g.y += GATES.speed * dt * timeScale;
      if (g.y > VIEW.height + GATES.height) g.active = false;
    }
  }

  private spawnPair(wave: number): void {
    const [left, right] = rollGatePair(wave, this.rng);
    const half = (VIEW.width - GATES.pairGap) / 2;
    const pair = this.nextPair++;
    this.push({ x: half / 2, width: half, type: left, pair });
    this.push({ x: VIEW.width - half / 2, width: half, type: right, pair });
  }

  private push(spec: { x: number; width: number; type: GateType; pair: number }): void {
    const gate: Gate = { ...spec, y: -GATES.height, active: true };
    const free = this.items.find((g) => !g.active);
    if (free) Object.assign(free, gate);
    else this.items.push(gate);
  }

  /** Consumes both halves of a pair once one is entered. */
  consumePair(pair: number): void {
    for (const g of this.items) if (g.pair === pair) g.active = false;
  }

  reset(): void {
    for (const g of this.items) g.active = false;
    this.accum = 0;
  }
}
