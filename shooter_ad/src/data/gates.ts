import { drawRoot, formatRoot, legibilityFor, roundSf } from './roots';
import { judgmentWave } from '../systems/Mode';
import { compactLabel } from '../format';
import { discreteAmount, MAX_ECHO, MAX_SENSE, MAX_SHIELD } from '../systems/Progression';

/**
 * Gates descend as an offer and the player drives through one of them. Every
 * bonus must (a) change damage output and (b) have a magnitude that is not
 * obvious from the label alone - see notes.md. Traps, time-bound effects and
 * survival-only effects are deliberately absent: "avoid the bad one" is not a
 * judgment, and an effect worth whatever the next five seconds hold cannot be
 * reasoned about beforehand or scored afterwards.
 */
export type BonusAxis =
  | 'army' | 'rate' | 'damage' | 'guns' | 'pierce' | 'echo' | 'move' | 'time' | 'sense' | 'shield';

/**
 * The central mechanic. `raw` feeds an additive pool, `mult` multiplies the
 * total.
 *
 * These are NOT a crossover where one form eventually wins. A raw draw is
 * scaled so its effect matches what the same draw would be worth as a
 * multiplier at the player's CURRENT pool - see `rawShare` below. Both forms
 * therefore reach the same span of outcomes at every point in a run, whichever
 * drew the higher root wins, and the player's job is converting a displayed
 * percentage against a pool they have to be tracking.
 */
export type BonusForm = 'raw' | 'mult';

/**
 * What the offer is measured against. A raw bonus is a share of what you
 * already hold, so it needs to know what you hold.
 */
export interface OfferContext {
  readonly power: number;
  readonly damageBonus: number;
  readonly rateBonus: number;
  /** Discrete axes scale with what is held past `GATES.scaleDiscreteFrom`. */
  readonly guns: number;
  readonly pierce: number;
  /** `+SENSE` and `+SHIELD` leave the pool once their cap is held. */
  readonly sense: number;
  readonly shield: number;
  /** `+ECHO` held; leaves the pool at `ECHO.maxLevel`. */
  readonly echo: number;
}

/**
 * The additive amount whose effect equals a multiplier of `root` on a stat
 * currently sitting at `1 + pool`.
 *
 *   (1 + pool + a) / (1 + pool) = root   ->   a = (root - 1) * (1 + pool)
 *
 * Without this the raw form decays: at a pool of +800% a `+10%` draw moves a
 * stack of 9.0 to 9.1 while `x1.1` moves it to 9.9, and the model measured the
 * chance raw is the right pick falling to 3%. The judgement the game is built
 * on becomes a formality exactly when the player is most invested.
 */
export function rawShare(root: number, pool: number): number {
  return (root - 1) * (1 + pool);
}

export interface GateType {
  readonly axis: BonusAxis;
  readonly form: BonusForm;
  /** Magnitude, already in the units `applyGate` wants for this axis and form. */
  readonly value: number;
  readonly label: string;
  readonly color: number;
}

/**
 * Colour names the AXIS and nothing else: `+120 ARMY` and `×1.2 ARMY` are the
 * same green. Tinting the forms differently would hand the player a shortcut
 * past the raw-versus-multiplicative conversion, which is the decision the
 * whole game is built to ask.
 */
export const AXIS_COLOR: Record<BonusAxis, number> = {
  army: 0x3ecf7a,
  rate: 0xffc93c,
  damage: 0xff6b4a,
  guns: 0xb56bff,
  pierce: 0x6be8d4,
  move: 0x4ea8ff,
  time: 0xff9fe0,
  sense: 0xeaf2ff,
  // Bronze: a buckler's colour, and the one warm hue between RATE's yellow
  // and DMG's red-orange that neither reads as. Nine axes on one hue wheel
  // is crowded; this is the phone question of 1.1.
  shield: 0xd9a066,
  // Slate: a ghost's non-colour, off every saturated axis hue. Ten axes on
  // one wheel; the tint is on a card the echo itself never wears (the
  // ghosts are drawn translucent in the army's own shirts).
  echo: 0x9fb4c8,
};

interface Candidate {
  readonly axis: BonusAxis;
  readonly form: BonusForm;
  readonly weight: number;
  readonly minWave: number;
}

const CANDIDATES: readonly Candidate[] = [
  { axis: 'army',   form: 'raw',  weight: 100, minWave: 1 },
  { axis: 'army',   form: 'mult', weight: 100, minWave: 1 },
  { axis: 'damage', form: 'raw',  weight: 85,  minWave: 1 },
  { axis: 'damage', form: 'mult', weight: 85,  minWave: 2 },
  { axis: 'rate',   form: 'raw',  weight: 85,  minWave: 1 },
  { axis: 'rate',   form: 'mult', weight: 85,  minWave: 2 },
  // Large, discrete and obvious on purpose: a baseline to judge the rest
  // against, offered sparingly so it never becomes the whole decision.
  { axis: 'guns',   form: 'raw',  weight: 24,  minWave: 4 },
  { axis: 'pierce', form: 'raw',  weight: 26,  minWave: 3 },
  // A ghost army beside yours. Priced (0.7 of the army per echo), so par
  // takes it; two levels, filtered out at the cap like SENSE. From wave 4
  // with GUNS, the other big discrete pick.
  { axis: 'echo',   form: 'raw',  weight: 24,  minWave: 4 },
  // The movement economy. Neither changes a damage number; both buy the
  // ability to reach the bonus you judged best, which is the only reason the
  // rest of this table is worth anything. Offered against a flat `+15% DMG`
  // they are exactly the call the design wants to ask - see notes.md.
  { axis: 'move',   form: 'mult', weight: 42,  minWave: 1 },
  // `+TIME` only has something to undo once gates have begun speeding up, so
  // it arrives a couple of waves in rather than at the first offer.
  { axis: 'time',   form: 'raw',  weight: 42,  minWave: 3 },
  // Judgment. No damage, no reach: a chance that future offers arrive with
  // their best option marked. Capped, and filtered out of the pool once the
  // cap is held rather than offered as a no-op - see `rollOffer`.
  { axis: 'sense',  form: 'raw',  weight: 30,  minWave: 2 },
  // Protection. Blocks a few enemy bullets every few seconds and nothing
  // else; a RISK axis like SENSE, capped and filtered out at the cap. From
  // wave 3, two waves before the first gun (the Spitter, wave 5) can appear.
  { axis: 'shield', form: 'raw',  weight: 30,  minWave: 3 },
];

export { CANDIDATES };

function build(c: Candidate, root: number, sigFigs: number, ctx: OfferContext): GateType {
  const color = AXIS_COLOR[c.axis];
  switch (c.axis) {
    case 'army': {
      if (c.form === 'mult') {
        return { axis: 'army', form: 'mult', value: root, label: `×${formatRoot(root)} ARMY`, color };
      }
      // The draw converts to an absolute against the army you hold right now,
      // which is what keeps a raw bonus from going dead at large armies.
      // Army needs no pool term: the army itself is the base a multiplier
      // would scale, so a share of it is already effect-equivalent.
      const amount = Math.max(1, Math.round(roundSf(ctx.power * (root - 1), sigFigs)));
      return { axis: 'army', form: 'raw', value: amount, label: `+${compactLabel(amount)} ARMY`, color };
    }
    case 'rate':
    case 'damage': {
      const word = c.axis === 'rate' ? 'RATE' : 'DMG';
      if (c.form === 'mult') {
        return { axis: c.axis, form: 'mult', value: root, label: `×${formatRoot(root)} ${word}`, color };
      }
      // Round the DISPLAYED percentage and derive the effect from it, so the
      // label and what the player actually gets can never disagree.
      const pool = c.axis === 'rate' ? ctx.rateBonus : ctx.damageBonus;
      const percent = Math.max(1, roundSf(rawShare(root, pool) * 100, sigFigs));
      return { axis: c.axis, form: 'raw', value: percent / 100, label: `+${compactLabel(percent)}% ${word}`, color };
    }
    case 'guns': {
      // Whole numbers, sized from the draw once enough are held - a flat +1
      // shrinks from +33% at three guns to nothing by twenty. Both discrete
      // axes convert the same way raw ARMY does: a share of what you hold.
      const n = discreteAmount('guns', ctx.guns, root);
      return { axis: 'guns', form: 'raw', value: n, label: `+${compactLabel(n)} GUN${n === 1 ? '' : 'S'}`, color };
    }
    case 'pierce': {
      const n = discreteAmount('pierce', ctx.pierce, root);
      return { axis: 'pierce', form: 'raw', value: n, label: `+${compactLabel(n)} PIERCE`, color };
    }
    case 'sense':
      return { axis: 'sense', form: 'raw', value: 1, label: '+SENSE', color };
    case 'echo':
      return { axis: 'echo', form: 'raw', value: 1, label: '+ECHO', color };
    case 'shield':
      return { axis: 'shield', form: 'raw', value: 1, label: '+SHIELD', color };
    case 'move':
      return { axis: 'move', form: 'mult', value: root, label: `×${formatRoot(root)} MOVE`, color };
    case 'time': {
      // Worded as a gain, because it is one. "-10% GATE SPEED" reads as a
      // penalty and the bonus would go untaken on grammar alone.
      // The DISPLAYED percentage is rounded first and the effect derived from
      // it, so `+20% TIME` is exactly 1.2x the seconds to decide.
      const percent = Math.max(1, roundSf((root - 1) * 100, sigFigs));
      return {
        axis: 'time', form: 'raw', value: 1 + percent / 100,
        label: `+${compactLabel(percent)}% TIME`, color,
      };
    }
  }
}

/**
 * One offer: `count` distinct options, each drawing its magnitude from the
 * wave's root table independently.
 *
 * No axis/form pair repeats within an offer, so the three are always genuinely
 * different picks - but the same AXIS may appear twice in different forms,
 * because `+20% DMG` against `×1.3 DMG` is exactly the decision the game wants
 * to ask.
 */
export function rollOffer(
  count: number, wave: number, ctx: OfferContext, rng: () => number,
): GateType[] {
  // Legibility is a JUDGMENT axis, so hard mode starts it several waves in and
  // awkward numbers arrive from the first offer. The candidate pool is NOT
  // offset: which bonuses exist is content, and unlocking late content early
  // would be a different game rather than a harder one.
  const legibility = legibilityFor(judgmentWave(wave));
  // Sense at its cap leaves the pool. A bonus that changes nothing is noise by
  // the design's own rule, and offering one would make a third of that offer
  // a formality.
  const pool = CANDIDATES.filter((c) =>
    c.minWave <= wave
    && !(c.axis === 'sense' && ctx.sense >= MAX_SENSE)
    && !(c.axis === 'shield' && ctx.shield >= MAX_SHIELD)
    && !(c.axis === 'echo' && ctx.echo >= MAX_ECHO));
  const chosen: GateType[] = [];
  const taken = new Set<Candidate>();

  for (let i = 0; i < count; i++) {
    const available = pool.filter((c) => !taken.has(c));
    if (available.length === 0) break;
    const c = pickWeighted(available, rng);
    taken.add(c);
    chosen.push(build(c, drawRoot(legibility, rng), legibility.sigFigs, ctx));
  }
  return chosen;
}

function pickWeighted(pool: readonly Candidate[], rng: () => number): Candidate {
  const total = pool.reduce((sum, c) => sum + c.weight, 0);
  let roll = rng() * total;
  for (const c of pool) {
    roll -= c.weight;
    if (roll <= 0) return c;
  }
  return pool[pool.length - 1];
}
