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
 */
import { register } from 'node:module';
register('./ts-resolve.mjs', import.meta.url);

const { squadDps, freshUpgrades, applyGate, cloneProgress, pierceMultiplier } =
  await import('../src/systems/Progression.ts');
const { SQUAD } = await import('../src/config.ts');
const { tierFor, TIERS } = await import('../src/data/tiers.ts');

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

console.log('\n=== the additive / multiplicative crossover (damage, root 1.2) ===');
console.log('  pool   +20% DMG   x1.2 DMG   winner');
for (const pool of [0, 0.2, 0.5, 1, 2, 3, 5]) {
  const p = state(200, { damageBonus: pool });
  const raw = delta(p, gate('damage', 'raw', 0.2));
  const mult = delta(p, gate('damage', 'mult', 1.2));
  const winner = raw > mult ? 'additive' : 'multiplicative';
  console.log(
    `  +${String(Math.round(pool * 100)).padStart(4)}%`,
    `${(raw * 100).toFixed(2).padStart(8)}%`,
    `${(mult * 100).toFixed(2).padStart(9)}%`,
    ` ${winner}`,
  );
}

// How often is the additive form actually the right pick? Both forms draw from
// the same root table independently, so this is a property of the MODEL, not of
// luck: additive wins exactly when (ra - 1) > (rm - 1) * (1 + pool). At pool 0
// that is "the bigger root wins" and the offer is a coin flip; as the pool
// grows, the additive form needs a proportionally larger draw to stay live.
//
// If this collapses toward zero, the additive form has become a bonus whose
// value is obvious - the failure the whole redesign exists to remove.
const { LEGIBILITY } = await import('../src/data/roots.ts');
console.log('\n=== how live is the additive/multiplicative choice? ===');
console.log('  pool    coarse table   fine table   (chance additive is the right pick)');
for (const pool of [0, 0.25, 0.5, 1, 2, 4, 8]) {
  const rates = [LEGIBILITY[0], LEGIBILITY[2]].map((tier) => {
    let wins = 0, total = 0;
    for (const ra of tier.roots) for (const rm of tier.roots) {
      total++;
      if (ra - 1 > (rm - 1) * (1 + pool)) wins++;
    }
    return wins / total;
  });
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
console.log('PASS');
