import { GATES, VIEW } from '../config';
import { rollOffer, type GateType, type OfferContext } from '../data/gates';

export interface Gate {
  x: number; y: number;
  width: number;
  type: GateType;
  /** Offer id, so taking one gate consumes the others beside it. */
  pair: number;
  active: boolean;
}

/**
 * Descending offers of bonus gates. The player drives the squad through one;
 * the rest vanish. Offering a choice rather than a single pickup is what makes
 * the lane movement a decision rather than a dodge.
 */
export class Gates {
  readonly items: Gate[] = [];
  private accum = 0;
  private nextPair = 0;

  constructor(
    private readonly rng: () => number,
    /** Called with each offered set, so par can take the best of them. */
    private readonly onOffer: (gates: readonly GateType[]) => void = () => {},
  ) {}

  /**
   * `ctx` is the state the offer is measured against: raw bonuses are a share
   * of what the player already holds, so they are rolled against the live army
   * and bonus pools rather than as fixed numbers.
   */
  update(dt: number, wave: number, ctx: OfferContext): void {
    this.accum += dt;
    if (this.accum >= GATES.interval) {
      this.accum = 0;
      this.spawnOffer(wave, ctx);
    }
    for (const g of this.items) {
      if (!g.active) continue;
      g.y += GATES.speed * dt;
      if (g.y > VIEW.height + GATES.height) g.active = false;
    }
  }

  private spawnOffer(wave: number, ctx: OfferContext): void {
    const offer = rollOffer(GATES.perOffer, wave, ctx, this.rng);
    if (offer.length === 0) return;
    this.onOffer(offer);
    const pair = this.nextPair++;
    const lane = (VIEW.width - GATES.gap * (offer.length - 1)) / offer.length;
    for (let i = 0; i < offer.length; i++) {
      const x = i * (lane + GATES.gap) + lane / 2;
      this.push({ x, width: lane, type: offer[i], pair });
    }
  }

  private push(spec: { x: number; width: number; type: GateType; pair: number }): void {
    const gate: Gate = { ...spec, y: -GATES.height, active: true };
    const free = this.items.find((g) => !g.active);
    if (free) Object.assign(free, gate);
    else this.items.push(gate);
  }

  /** Consumes the whole offer once one of its gates is entered. */
  consumePair(pair: number): void {
    for (const g of this.items) if (g.pair === pair) g.active = false;
  }

  reset(): void {
    for (const g of this.items) g.active = false;
    this.accum = 0;
  }
}
