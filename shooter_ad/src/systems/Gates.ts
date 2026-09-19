import { ARENA, GATES, VIEW } from '../config';
import { rollOffer, type GateType, type OfferContext } from '../data/gates';
import { gateSpeed, senseChance, type Upgrades } from './Progression';

export interface Gate {
  x: number; y: number;
  width: number;
  type: GateType;
  /** Offer id, so taking one gate consumes the others beside it. */
  pair: number;
  /** Position within its offer, so a pick can be graded against the others. */
  index: number;
  /**
   * Whether this offer arrived SENSED: the renderer marks whichever of its
   * options is currently best. Rolled once per offer, at spawn, from the
   * seeded generator - see `spawnOffer`. Which option is marked is not stored,
   * because it is a live fact: the best option is priced against the state
   * the player is in NOW, and that can change while the offer descends.
   */
  sensed: boolean;
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
  /**
   * Offers rolled but not yet credited to par. An offer is a promise the
   * player cannot act on until it arrives.
   */
  private pending: { pair: number; types: GateType[]; sensed: boolean }[] = [];
  /** Offers the player has been shown but has not yet taken or missed. */
  private readonly unresolved = new Set<number>();

  constructor(
    private readonly rng: () => number,
    /**
     * Called with each offered set once the player has actually had the chance
     * to take it, so par can take the best of them. NOT called at spawn - see
     * `creditArrivedOffers`.
     */
    private readonly onOffer: (
      pair: number, gates: readonly GateType[], sensed: boolean,
    ) => void = () => {},
    /** Called when a whole offer left the screen without being taken. */
    private readonly onExpire: (pair: number) => void = () => {},
  ) {}

  /**
   * `ctx` is the state the offer is measured against: raw bonuses are a share
   * of what the player already holds, so they are rolled against the live army
   * and bonus pools rather than as fixed numbers.
   */
  update(dt: number, wave: number, ctx: OfferContext, u: Upgrades): void {
    this.accum += dt;
    if (this.accum >= GATES.interval) {
      this.accum = 0;
      this.spawnOffer(wave, ctx);
    }
    // Offers arrive at a fixed rate but DESCEND faster every wave, so the time
    // to read three labels and reach one shrinks. `+TIME` pushes it back out
    // for the rest of the run; both live in Progression so par prices the
    // trade with the same numbers the gate actually falls at.
    const speed = gateSpeed(wave, u);
    for (const g of this.items) {
      if (!g.active) continue;
      g.y += speed * dt;
      if (g.y > VIEW.height + GATES.height) g.active = false;
    }
    this.creditArrivedOffers();
    this.expirePassedOffers();
  }

  /**
   * An offer that left the screen untaken is still a decision, and the log
   * grades it as one - driving past three gates should show up in the score.
   */
  private expirePassedOffers(): void {
    for (const pair of [...this.unresolved]) {
      if (this.items.some((g) => g.active && g.pair === pair)) continue;
      this.unresolved.delete(pair);
      this.onExpire(pair);
    }
  }

  /**
   * Par is credited when an offer REACHES the squad, not when it is rolled.
   *
   * Gates spawn above the top of the screen and take about eight seconds to
   * descend. Crediting par at spawn handed the shadow player every bonus a
   * full offer-interval before the real player could possibly drive through
   * one, so par ran permanently ahead of any achievable play. That is not a
   * cosmetic error: enemy budget is derived from par, and `standing` is the
   * ratio the whole difficulty curve keys off, so the game was reading the
   * player as further behind than they were and pricing enemies accordingly.
   *
   * Taking a gate credits at the same moment through `consumePair`, since the
   * squad has to be on the lane line to pass through one.
   */
  private creditArrivedOffers(): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const gate = this.items.find((g) => g.active && g.pair === this.pending[i].pair);
      if (gate && gate.y < ARENA.laneY) continue;
      this.creditPair(this.pending[i].pair);
    }
  }

  /** Hands one offer to par, once. */
  private creditPair(pair: number): void {
    const i = this.pending.findIndex((p) => p.pair === pair);
    if (i === -1) return;
    const [offer] = this.pending.splice(i, 1);
    this.unresolved.add(pair);
    this.onOffer(pair, offer.types, offer.sensed);
  }

  private spawnOffer(wave: number, ctx: OfferContext): void {
    const offer = rollOffer(GATES.perOffer, wave, ctx, this.rng);
    if (offer.length === 0) return;
    const pair = this.nextPair++;
    // The sense roll. ALWAYS drawn, whatever sense is held, so the generator
    // advances identically on every run of a seed and a player's sense level
    // cannot shift the enemies and offers that follow.
    const sensed = this.rng() < senseChance(ctx.sense);
    this.pending.push({ pair, types: offer, sensed });
    // Lanes tile the full width with NO gap between them, so every x position
    // is inside exactly one option. The gap used to be real: a player could
    // slide between two blocks and take nothing, which turns a missed offer
    // from a decision into a geometry accident. The separation is drawn as an
    // inset on the rectangle instead - visual, never in the hit test.
    const lane = VIEW.width / offer.length;
    for (let i = 0; i < offer.length; i++) {
      const x = i * lane + lane / 2;
      this.push({ x, width: lane, type: offer[i], pair, index: i, sensed });
    }
  }

  private push(
    spec: {
      x: number; width: number; type: GateType; pair: number; index: number; sensed: boolean;
    },
  ): void {
    const gate: Gate = { ...spec, y: -GATES.height, active: true };
    const free = this.items.find((g) => !g.active);
    if (free) Object.assign(free, gate);
    else this.items.push(gate);
  }

  /** Consumes the whole offer once one of its gates is entered. */
  consumePair(pair: number): void {
    this.creditPair(pair);
    // The caller logs the pick itself, so this offer must not also expire.
    this.unresolved.delete(pair);
    for (const g of this.items) if (g.pair === pair) g.active = false;
  }

  reset(): void {
    for (const g of this.items) g.active = false;
    this.pending.length = 0;
    this.unresolved.clear();
    this.accum = 0;
  }
}
