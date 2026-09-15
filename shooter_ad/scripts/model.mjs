/**
 * The bonus model, read straight out of the game's own `Progression.ts`.
 *
 * The probe measures whether the game survives; this measures whether the
 * central mechanic is actually there. Three claims the design rests on, none of
 * which the probe's bot can see, because it cannot tell two magnitudes of the
 * same axis apart:
 *
 * 1. Additive beats multiplicative early and loses late, with a crossover the
 *    player has to feel for.
 * 2. No bonus is ever a no-op - in particular a raw or multiplicative ARMY draw
 *    must move damage output at every army size, which is why tier stats
 *    interpolate between rows instead of stepping at them.
 * 3. Pierce diminishes on a fixed q, identically for par and the player.
 * 4. The movement economy is never free. `x MOVE` and `+TIME` carry no damage
 *    at all, so priced by DPS they score a flat zero and the game calls every
 *    one of them a mistake. They are priced by ACCESS instead, and this asserts
 *    that price is positive everywhere - at every wave and however far the
 *    bonuses have already been stacked.
 */
import { register } from 'node:module';
register('./ts-resolve.mjs', import.meta.url);

const { squadDps, freshUpgrades, applyGate, cloneProgress, pierceMultiplier } =
  await import('../src/systems/Progression.ts');
const { SQUAD } = await import('../src/config.ts');
const { tierFor, TIERS } = await import('../src/data/tiers.ts');
const { rawShare } = await import('../src/data/gates.ts');
const { scoreOffer } = await import('../src/systems/Scoring.ts');
const { reach, gateDescentSeconds, waveGateSpeedMult } =
  await import('../src/systems/Progression.ts');
const { GATES } = await import('../src/config.ts');

const state = (power, over = {}) => ({
  power, upgrades: { ...freshUpgrades(), ...over },
});

/** Fractional DPS change from applying one gate to one state. */
function delta(p, gate) {
  const before = squadDps(p);
  const after = cloneProgress(p);
  applyGate(after, gate);
  return squadDps(after) / before - 1;
}

const gate = (axis, form, value) => ({ axis, form, value, label: '', color: 0 });

console.log('=== pierce, at a fixed q ===');
for (let i = 0; i <= 4; i++) {
  console.log(`  pierce ${i}: x${pierceMultiplier(i).toFixed(3)}`);
}

// Both forms drawing the SAME root must be worth the same thing at every pool.
// That is what keeps either form from becoming the obvious answer late, and it
// is the property the raw scaling exists to guarantee - so assert it rather
// than eyeball it.
console.log('\n=== same root, both forms, at every pool (damage, root 1.2) ===');
console.log('  pool    raw label   raw effect   x1.2 effect');
let equalityGap = 0;
for (const pool of [0, 0.2, 0.5, 1, 2, 3, 5, 8]) {
  const p = state(200, { damageBonus: pool });
  const share = rawShare(1.2, pool);
  const raw = delta(p, gate('damage', 'raw', share));
  const mult = delta(p, gate('damage', 'mult', 1.2));
  equalityGap = Math.max(equalityGap, Math.abs(raw - mult));
  console.log(
    `  +${String(Math.round(pool * 100)).padStart(4)}%`,
    `${('+' + Math.round(share * 100) + '%').padStart(10)}`,
    `${(raw * 100).toFixed(2).padStart(11)}%`,
    `${(mult * 100).toFixed(2).padStart(11)}%`,
  );
}

// How often is the additive form actually the right pick? Scored through the
// game's own rawShare, so this measures the shipped rule rather than a
// restatement of it. Both forms should stay a coin flip at every pool: if this
// slides toward 0% the additive form has become a bonus whose value is obvious,
// which is the failure the whole redesign exists to remove.
const { LEGIBILITY } = await import('../src/data/roots.ts');
console.log('\n=== how live is the additive/multiplicative choice? ===');
console.log('  pool    coarse table   fine table   (chance additive is the right pick)');
const liveness = [[], []];
for (const pool of [0, 0.25, 0.5, 1, 2, 4, 8]) {
  const rates = [LEGIBILITY[0], LEGIBILITY[2]].map((tier) => {
    let wins = 0, total = 0;
    for (const ra of tier.roots) for (const rm of tier.roots) {
      total++;
      const p = state(200, { damageBonus: pool });
      if (delta(p, gate('damage', 'raw', rawShare(ra, pool)))
          > delta(p, gate('damage', 'mult', rm))) wins++;
    }
    return wins / total;
  });
  rates.forEach((r, i) => liveness[i].push(r));
  console.log(
    `  +${String(Math.round(pool * 100)).padStart(4)}%`,
    `${(rates[0] * 100).toFixed(0).padStart(12)}%`,
    `${(rates[1] * 100).toFixed(0).padStart(12)}%`,
  );
}

console.log('\n=== no army bonus may be a no-op ===');
console.log('  power    rank        +draw   x1.2 ARMY   +N ARMY');
let worst = Infinity;
for (const power of [6, 19, 60, 200, 608, 2000, 9000, SQUAD.maxPower / 2]) {
  const p = state(Math.round(power));
  const mult = delta(p, gate('army', 'mult', 1.2));
  const amount = Math.max(1, Math.round(power * 0.2));
  const raw = delta(p, gate('army', 'raw', amount));
  worst = Math.min(worst, mult, raw);
  console.log(
    String(Math.round(power)).padStart(7),
    TIERS[tierFor(Math.round(power) / Math.min(Math.round(power), SQUAD.ringCap))].name.padEnd(10),
    `+${String(amount).padStart(6)}`,
    `${(mult * 100).toFixed(2).padStart(10)}%`,
    `${(raw * 100).toFixed(2).padStart(9)}%`,
  );
}
console.log(`\n  smallest army-bonus effect anywhere: ${(worst * 100).toFixed(2)}%`);
if (!(worst > 0.01)) {
  console.error('FAIL: an army bonus is worth ~nothing somewhere on the ladder');
  process.exit(1);
}

// The two guards that keep the central mechanic from quietly dying. Both
// regressed once before and neither is visible in play until far into a run.
if (equalityGap > 1e-9) {
  console.error(
    `FAIL: the same root is worth different amounts in each form (gap ${equalityGap})`,
    '\n      raw scaling has drifted from the multiplicative effect it mirrors',
  );
  process.exit(1);
}
// Compare each table against ITSELF across pools. The coarse and fine tables
// legitimately differ from each other (42% vs 49%, a function of how often two
// draws tie), so comparing them to one another would flag a non-problem.
for (const [i, series] of liveness.entries()) {
  const spread = Math.max(...series) - Math.min(...series);
  if (spread > 0.02) {
    console.error(
      `FAIL: the ${i === 0 ? 'coarse' : 'fine'} table's choice is not equally live at every pool`,
      `\n      chance additive is correct ranges ${(Math.min(...series) * 100).toFixed(0)}%`,
      `to ${(Math.max(...series) * 100).toFixed(0)}% across pools`,
      '\n      a slide toward 0% means the raw form has become the obvious wrong answer',
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// The movement economy.
//
// Priced through the SHIPPED `scoreOffer` rather than a restatement of the
// valuation, so this measures what par takes, what the halo flashes and what
// the death screen says - not a second model that could drift from all three.
console.log('\n=== gate approach speed rises with the wave ===');
console.log('  wave   speed x   descent s   reach');
for (const wave of [1, 3, 6, 10, 15, 21, 30]) {
  const u = freshUpgrades();
  console.log(
    String(wave).padStart(6),
    waveGateSpeedMult(wave).toFixed(2).padStart(9),
    gateDescentSeconds(wave, u).toFixed(2).padStart(11),
    reach(wave, u).toFixed(3).padStart(8),
  );
}
if (!(waveGateSpeedMult(30) > waveGateSpeedMult(1))) {
  console.error('FAIL: gate approach speed does not rise with the wave');
  process.exit(1);
}

/** What the game's own scoring says one gate is worth, in one state, one wave. */
const priced = (p, g, wave) => scoreOffer(p, [g], wave).options[0].delta;

console.log('\n=== x MOVE and +TIME are never worth zero ===');
console.log('  wave   stacked move/time    x1.05 MOVE   x1.5 MOVE    +5% TIME   +50% TIME');
let cheapest = Infinity;
for (const wave of [1, 3, 6, 10, 15, 21, 30]) {
  // Including states where the bonuses are already stacked hard: access
  // saturates smoothly rather than clamping, precisely so a fifth x MOVE is
  // worth little instead of nothing.
  for (const [mv, tm] of [[1, 1], [2, 1], [1, 2], [4, 3], [8, 6]]) {
    const p = state(200, { moveMult: mv, gateSpeedMult: 1 / tm });
    const cells = [
      priced(p, gate('move', 'mult', 1.05), wave),
      priced(p, gate('move', 'mult', 1.5), wave),
      priced(p, gate('time', 'raw', 1.05), wave),
      priced(p, gate('time', 'raw', 1.5), wave),
    ];
    cheapest = Math.min(cheapest, ...cells);
    console.log(
      String(wave).padStart(6),
      `x${mv} / x${tm}`.padStart(19),
      ...cells.map((c) => `${(c * 100).toFixed(2)}%`.padStart(12)),
    );
  }
}
console.log(`\n  cheapest movement bonus anywhere: ${(cheapest * 100).toFixed(3)}%`);
if (!(cheapest > 0)) {
  console.error(
    'FAIL: a movement bonus is priced at zero somewhere',
    '\n      par will never take it, the halo will flash it red and the death',
    '\n      screen will call it a mistake - see Scoring.scoreOffer',
  );
  process.exit(1);
}

// Nonzero is not enough: the bonus also has to be able to WIN an offer, or it
// is merely a differently-worded way to waste a pick. A strong draw must beat a
// weak damage draw somewhere on the curve.
const weakDmg = gate('damage', 'mult', 1.05);
const beats = [1, 6, 15, 30].filter((wave) => {
  const p = state(200);
  return priced(p, gate('move', 'mult', 1.5), wave) > priced(p, weakDmg, wave);
});
console.log(`  x1.5 MOVE beats x1.05 DMG at waves: ${beats.join(', ') || 'nowhere'}`);
if (beats.length === 0) {
  console.error('FAIL: no movement bonus can ever be the right pick');
  process.exit(1);
}

console.log('PASS');
