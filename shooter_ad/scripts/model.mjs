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

const {
  squadDps, freshUpgrades, applyGate, cloneProgress, pierceMultiplier,
  shotsPerSecond, bundleFactor,
} = await import('../src/systems/Progression.ts');
const { strike } = await import('../src/systems/Bullets.ts');
const { SQUAD } = await import('../src/config.ts');
const { tierFor, tierRow, unitStats, CYCLE } = await import('../src/data/tiers.ts');
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

// The ladder has no last row, so this is asserted far past where any authored
// row exists. The two ceilings this project has shipped were 608 (red, the last
// of six rows) and 38,912 (Prismatic, the last of twelve): both are inside this
// list, and so are powers a thousand and a billion times larger. The last point
// sits just under the overflow guard, which is the only cap left.
console.log('\n=== no army bonus may be a no-op, at ANY power ===');
console.log('  power        rank   row     +draw       x1.2 ARMY   +N ARMY');
let worst = Infinity;
const armyPoints = [6, 19, 60, 200, 608, 2000, 9000, 19456, 38912, 77824, 1e6, 1e9, 1e12, SQUAD.maxPower / 2];
for (const power of armyPoints) {
  const p = state(Math.round(power));
  const mult = delta(p, gate('army', 'mult', 1.2));
  const amount = Math.max(1, Math.round(power * 0.2));
  const raw = delta(p, gate('army', 'raw', amount));
  worst = Math.min(worst, mult, raw);
  const row = tierFor(Math.round(power) / Math.min(Math.round(power), SQUAD.ringCap));
  console.log(
    String(Math.round(power)).padStart(15),
    tierRow(row).name.padEnd(10),
    String(row).padStart(3),
    `+${amount.toExponential(1).padStart(9)}`,
    `${(mult * 100).toFixed(2).padStart(10)}%`,
    `${(raw * 100).toFixed(2).padStart(9)}%`,
  );
}
console.log(`\n  smallest army-bonus effect anywhere: ${(worst * 100).toFixed(2)}%`);
if (!(worst > 0.01)) {
  console.error('FAIL: an army bonus is worth ~nothing somewhere on the ladder');
  process.exit(1);
}

// The generated rows must continue the authored curve rather than restart or
// flatten it: every row strictly stronger than the last, the authored rows
// returned verbatim, and nothing non-finite anywhere up to the guard.
console.log('\n=== the ladder past the authored rows ===');
console.log('  row   rank        threshold      damage   fireRate');
for (const n of [0, 5, 11, 12, 13, 20, 23, 24, 35, 45]) {
  const r = tierRow(n);
  console.log(
    String(n).padStart(5), r.name.padEnd(10),
    r.threshold.toExponential(1).padStart(12),
    r.damage.toExponential(2).padStart(11), r.fireRate.toFixed(2).padStart(10),
  );
}
const topRow = tierFor(SQUAD.maxPower / SQUAD.ringCap);
for (let n = 1; n <= topRow + 1; n++) {
  const lo = tierRow(n - 1), hi = tierRow(n);
  if (!(hi.damage > lo.damage && hi.fireRate > lo.fireRate && hi.threshold === 2 * lo.threshold)) {
    throw new Error(`tier row ${n} does not continue the ladder`);
  }
  if (n % CYCLE !== 0 && hi.shirt === lo.shirt) throw new Error(`rows ${n - 1} and ${n} share a shirt`);
}
const guardStats = unitStats(SQUAD.maxPower / SQUAD.ringCap);
if (!Number.isFinite(squadDps(state(SQUAD.maxPower))) || !Number.isFinite(guardStats.damage)) {
  throw new Error('squadDps is not finite at the overflow guard');
}
if (tierRow(CYCLE).shirt !== tierRow(0).shirt || tierRow(CYCLE).name !== tierRow(0).name) {
  throw new Error('row CYCLE does not wear row 0\'s shirt - the palette is not cycling');
}
console.log(`  rows 0..${topRow + 1} strictly increase; row ${CYCLE} wears ${tierRow(CYCLE).name} again;`
  + ` the ring at the guard (1e15) is row ${topRow}, ${tierRow(topRow).name}`);

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


// What the movement economy costs par, and therefore the difficulty curve.
//
// Difficulty budgets enemies against `squadDps(par)`. Par now sometimes spends
// a pick on access, which carries no damage, so par's DPS grows more slowly
// than it did before these two bonuses existed and the whole curve softens.
// That is self-consistent - a perfect player really does spend picks this way -
// but it is a real effect and it belongs on the record rather than in a
// surprise. REPORTED, not asserted: it depends on the candidate weights, which
// are a design dial rather than an invariant.
const { rollOffer } = await import('../src/data/gates.ts');
const { GATES: G } = await import('../src/config.ts');
console.log('\n=== what par spends on access (200 simulated runs of 30 offers) ===');
let accessPicks = 0, totalPicks = 0;
let withAccess = 0, dpsWith = 0, dpsWithout = 0;
for (let run = 0; run < 200; run++) {
  // Seeded, like everything else here: a deterministic LCG per run.
  let s0 = run * 2654435761 + 12345;
  const rng = () => ((s0 = (s0 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const par = state(SQUAD.startPower);
  const noAccess = state(SQUAD.startPower);
  for (let offer = 0; offer < 30; offer++) {
    const wave = 1 + Math.floor(offer / 2);
    const ctx = {
      power: par.power,
      damageBonus: par.upgrades.damageBonus,
      rateBonus: par.upgrades.rateBonus,
    };
    const gates = rollOffer(G.perOffer, wave, ctx, rng);
    if (gates.length === 0) continue;
    if (gates.some((g) => g.axis === 'move' || g.axis === 'time')) withAccess++;
    const pick = gates[scoreOffer(par, gates, wave).best];
    totalPicks++;
    if (pick.axis === 'move' || pick.axis === 'time') accessPicks++;
    applyGate(par, pick);
    // The same offer, priced the old way - by DPS alone, so access never wins.
    const byDps = gates.reduce((a, b) => {
      const p = cloneProgress(noAccess);
      applyGate(p, b);
      const q = cloneProgress(noAccess);
      applyGate(q, a);
      return squadDps(p) > squadDps(q) ? b : a;
    });
    applyGate(noAccess, byDps);
  }
  dpsWith += squadDps(par);
  dpsWithout += squadDps(noAccess);
}
console.log(`  offers containing a movement option: ${(withAccess / totalPicks * 100).toFixed(1)}%`);
console.log(`  picks par spends on access:          ${(accessPicks / totalPicks * 100).toFixed(1)}%`);
console.log(`  par DPS after 30 offers, access-priced vs DPS-priced:`
  + ` ${(dpsWith / dpsWithout).toFixed(3)}x`);


// ---------------------------------------------------------------------------
// Hard mode: the same skill, harder — not a different skill.
//
// `notes.md` is explicit that hard mode must not be "more enemy HP". The two
// assertions below are what make that a property rather than an intention:
// hard mode must move BOTH judgment axes and must leave the content pool and
// the enemy budget exactly where they were. A future change that makes hard
// mode tankier fails here rather than in a playtest three weeks later.
// ---------------------------------------------------------------------------
const { setMode, MODES, judgmentWave } = await import('../src/systems/Mode.ts');
const { legibilityFor } = await import('../src/data/roots.ts');
const { CANDIDATES } = await import('../src/data/gates.ts');

console.log('\n=== hard mode ===');
const OFFSET = MODES.hard.waveOffset;

setMode('normal');
const normalSpeed = (w) => waveGateSpeedMult(w);
const normalLegibility = (w) => legibilityFor(w);
const speedNormal = [1, 3, 6, 11, 16, 21].map(normalSpeed);
const legNormal = [1, 3, 6, 11].map((w) => normalLegibility(w).roots.length);

setMode('hard');
const speedHard = [1, 3, 6, 11, 16, 21].map(waveGateSpeedMult);
const legHard = [1, 3, 6, 11].map((w) => legibilityFor(judgmentWave(w)).roots.length);

console.log(`  wave offset: +${OFFSET}`);
console.log('  gate speed multiplier, by real wave:');
console.log('    wave      1     3     6    11    16    21');
console.log('    normal ' + speedNormal.map((v) => v.toFixed(2).padStart(5)).join(' '));
console.log('    hard   ' + speedHard.map((v) => v.toFixed(2).padStart(5)).join(' '));
console.log('  root table size (bigger = finer, harder to eyeball):');
console.log('    wave      1     3     6    11');
console.log('    normal ' + legNormal.map((v) => String(v).padStart(5)).join(' '));
console.log('    hard   ' + legHard.map((v) => String(v).padStart(5)).join(' '));

// A hard run's first offer must already descend at a later wave's speed, and
// draw from a later wave's table. Either one alone is half a mode.
//
// Compared against the stored NORMAL rows rather than by re-calling: both
// functions read the active mode, so calling them after `setMode('hard')`
// returns hard values under a name that says normal. That mistake was made
// while writing this check, which is the argument for keeping it written down.
const wavesProbed = [1, 3, 6, 11, 16, 21];
const offsetIndex = wavesProbed.indexOf(1 + OFFSET);
if (offsetIndex === -1) throw new Error('probe waves do not cover 1 + waveOffset');
if (!(speedHard[0] > speedNormal[0])) {
  throw new Error('hard mode does not speed up the first offer');
}
if (speedHard[0] !== speedNormal[offsetIndex]) {
  throw new Error('hard gate speed is not simply the curve started later');
}
if (!(legHard[0] > legNormal[0])) {
  throw new Error('hard mode does not start at a finer root table');
}
if (legHard[0] !== legNormal[wavesProbed.indexOf(1 + OFFSET)]) {
  throw new Error('hard legibility is not simply the ladder started later');
}

// Content must NOT move. Unlocking late bonuses early would be a different
// game rather than a harder one, so this rolls real wave-1 offers under both
// modes and fails if the SET of available bonuses differs at all. It compares
// behaviour rather than reading the candidate table, so it still holds if the
// table is refactored.
function axesOfferedAtWaveOne(mode) {
  setMode(mode);
  let h = 99;
  const r = () => ((h = (h * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const ctx = { power: SQUAD.startPower, damageBonus: 0, rateBonus: 0 };
  const seen = new Set();
  for (let i = 0; i < 600; i++) {
    for (const g of rollOffer(G.perOffer, 1, ctx, r)) seen.add(`${g.axis}/${g.form}`);
  }
  return [...seen].sort();
}
const offeredNormal = axesOfferedAtWaveOne('normal');
const offeredHard = axesOfferedAtWaveOne('hard');
if (offeredNormal.join() !== offeredHard.join()) {
  throw new Error(
    'hard mode changed WHICH bonuses exist at wave 1, not just how hard they are:\n'
    + `  normal: ${offeredNormal.join(', ')}\n  hard:   ${offeredHard.join(', ')}`,
  );
}
console.log(`  wave-1 bonus pool identical in both modes: ${offeredNormal.join(', ')}`);

// The mode knob carries nothing but the offset, so it cannot reach the enemy
// budget even by accident.
const knobs = Object.keys(MODES.hard);
if (knobs.length !== 1 || knobs[0] !== 'waveOffset') {
  throw new Error(`hard mode grew a knob beyond waveOffset: ${knobs.join(', ')}`);
}
console.log('  hard mode carries exactly one knob: waveOffset');
setMode('normal');


// ---------------------------------------------------------------------------
// What hard mode does to the VALUE of a bonus, as opposed to its magnitude.
//
// This exists because the probe measured hard mode as consistently EASIER than
// normal - higher standing, longer survival, at every skill level - which is
// the opposite of the intent and had to be explained before anything was tuned
// around it. The suspected mechanism is here rather than in the bot: gate speed
// feeds `gateDescentSeconds`, which feeds `reach`, which is what `scoreOffer`
// prices access with. Faster gates make reach SCARCER, which makes `x MOVE` and
// `+TIME` worth more - and `+TIME` is a permanent divisor on gate speed, so it
// is the direct counter to the very thing hard mode turned up.
//
// If par spends materially more of its picks on access under hard mode, the
// effect is real game mechanics rather than a quirk of the bot: hard mode pays
// for its own antidote.
// ---------------------------------------------------------------------------
console.log('\n=== what hard mode does to access pricing ===');
console.log('  mode     offers with access   picks spent on access   par DPS after 30');
for (const m of ['normal', 'hard']) {
  setMode(m);
  let picks = 0, total = 0, offersWith = 0, dpsEnd = 0;
  for (let run = 0; run < 200; run++) {
    let s1 = run * 2654435761 + 12345;
    const r = () => ((s1 = (s1 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const par = state(SQUAD.startPower);
    for (let offer = 0; offer < 30; offer++) {
      const wave = 1 + Math.floor(offer / 2);
      const ctx = {
        power: par.power,
        damageBonus: par.upgrades.damageBonus,
        rateBonus: par.upgrades.rateBonus,
      };
      const gates = rollOffer(G.perOffer, wave, ctx, r);
      if (gates.length === 0) continue;
      if (gates.some((g) => g.axis === 'move' || g.axis === 'time')) offersWith++;
      const pick = gates[scoreOffer(par, gates, wave).best];
      total++;
      if (pick.axis === 'move' || pick.axis === 'time') picks++;
      applyGate(par, pick);
    }
    dpsEnd += squadDps(par);
  }
  console.log(
    `  ${m.padEnd(8)}` + `${(offersWith / total * 100).toFixed(1)}%`.padStart(18)
    + `${(picks / total * 100).toFixed(1)}%`.padStart(23)
    + `${Math.round(dpsEnd / 200)}`.padStart(19),
  );
}
setMode('normal');


// ---------------------------------------------------------------------------
// Legibility must be difficulty-NEUTRAL.
//
// `notes.md`: "No mechanic changes - only how hard the arithmetic is." That is
// a claim about the MEAN of each tier's root table, and it is not automatically
// true: the tiers have different value counts over the same range, so a tier
// whose values happen to bunch low hands out systematically smaller bonuses
// than one that does not. Since hard mode starts several tiers in, any such
// skew is a strength difference wearing a legibility costume - and it would
// compound over every offer of a run.
// ---------------------------------------------------------------------------
console.log('\n=== legibility tiers must not differ in strength ===');
console.log('  minWave   values   arith mean   geo mean   geo vs tier 0');
const amean = (x) => x.reduce((a, b) => a + b, 0) / x.length;
// The geometric mean is the one that governs: bonuses MULTIPLY, so a table
// spread toward its extremes is weaker than a tighter one with the same
// average. Matching only the arithmetic mean left 0.26% per draw - 7.5% over a
// run - and that was a real, measured miss, not a theoretical one.
const gmean = (x) => Math.exp(x.reduce((a, b) => a + Math.log(b), 0) / x.length);
const geo = LEGIBILITY.map((t) => gmean(t.roots));
for (let i = 0; i < LEGIBILITY.length; i++) {
  const drift = (geo[i] / geo[0] - 1) * 100;
  console.log(
    String(LEGIBILITY[i].minWave).padStart(9),
    String(LEGIBILITY[i].roots.length).padStart(8),
    amean(LEGIBILITY[i].roots).toFixed(4).padStart(12),
    geo[i].toFixed(4).padStart(10),
    `${drift >= 0 ? '+' : ''}${drift.toFixed(3)}%`.padStart(15),
  );
}
const OFFERS = 30;
const worstTier = geo.reduce((a, b) => (Math.abs(b - geo[0]) > Math.abs(a - geo[0]) ? b : a));
const perDraw = worstTier / geo[0];
console.log(
  `  worst tier is ${((perDraw - 1) * 100).toFixed(3)}% per draw,`
  + ` ${(Math.pow(perDraw, OFFERS) * 100 - 100).toFixed(1)}% over ${OFFERS} offers`,
);
// 0.5% per draw is ~16% over 30 offers - already larger than most effects this
// project tries to measure, so the tolerance is tight on purpose.
const TOLERANCE = 0.005;
if (Math.abs(perDraw - 1) > TOLERANCE) {
  throw new Error(
    `legibility tiers differ in geometric mean by ${((perDraw - 1) * 100).toFixed(2)}%`
    + ' per draw - escalating legibility is secretly escalating power',
  );
}
const ARITH_TOLERANCE = 0.005;
const worstArith = LEGIBILITY.map((t) => amean(t.roots))
  .reduce((a, b) => (Math.abs(b - amean(LEGIBILITY[0].roots))
    > Math.abs(a - amean(LEGIBILITY[0].roots)) ? b : a));
if (Math.abs(worstArith / amean(LEGIBILITY[0].roots) - 1) > ARITH_TOLERANCE) {
  throw new Error('legibility tiers differ in arithmetic mean');
}


// ---------------------------------------------------------------------------
// Ordinary enemies must not stop scaling with the player.
//
// The finding, from a real play session: non-boss enemies should scale at least
// somewhat more with the player's damage output. `Difficulty.throttle` already
// does scale them - incoming enemy HP per second is
// `squadDps(par) * targetFraction * pressure`, which is LINEAR in par - so the
// interesting question was where that linearity stops.
//
// It stopped twice, and the two ceilings hid each other. `DIFFICULTY.maxHpMult`
// pinned the budget after about thirty offers; the bullet pool refused shots
// past ~988/s, so `squadDps` was claiming damage nobody could do. The first is
// now a numeric guard far past any run, checked here in OFFERS - the unit the
// player feels. The second no longer exists: past `WEAPON.maxSimShotsPerSecond`
// the simulation BUNDLES shots into fewer, heavier bullets rather than dropping
// them, so the budget, the HUD and the scoring all read one true `squadDps`.
// This section reports the bundle par is running at, and asserts that the pool
// is sized to never refuse a spawn at the cap.
// ---------------------------------------------------------------------------
const { DIFFICULTY, WAVE, WEAPON, ARENA } = await import('../src/config.ts');
const { poolAverageHp } = await import('../src/data/enemies.ts');

console.log('\n=== the enemy budget must not stop scaling with par ===');
const budgetShare = DIFFICULTY.targetFraction * DIFFICULTY.pressure;
// The most HP a wave can carry: every enemy at the ceiling, arriving as fast as
// the authored curve ever sends them.
const lateAvgHp = poolAverageHp(30);
const ceilingHpPerSec = DIFFICULTY.maxHpMult * WAVE.maxSpawnRate * lateAvgHp;
const ceilingParDps = ceilingHpPerSec / budgetShare;
const flightSeconds = (ARENA.laneY + 20) / WEAPON.bulletSpeed;
console.log(`  budget share (targetFraction x pressure): ${budgetShare.toFixed(3)}`);
console.log(`  bullets/s the simulation spawns at most:  ${WEAPON.maxSimShotsPerSecond}`);
console.log(`  bullet pool, derived from it:             ${WEAPON.maxBullets}`
  + ` (${(WEAPON.maxBullets / (WEAPON.maxSimShotsPerSecond * flightSeconds)).toFixed(2)}x a full flight at the cap)`);
console.log(`  average enemy HP in the late pool:        ${lateAvgHp.toFixed(1)}`);
console.log(`  most HP a wave can carry:                 ${Math.round(ceilingHpPerSec)}/s`);
console.log(`  par DPS at which the budget pins:         ${Math.round(ceilingParDps)}`);

if (!(WEAPON.maxBullets >= WEAPON.maxSimShotsPerSecond * flightSeconds)) {
  console.error('FAIL: the bullet pool cannot hold one flight of bullets at the sim cap, so it will refuse spawns');
  process.exit(1);
}

// Par's own growth, played by the shipped scoring on the shipped offer roller -
// not a growth rate assumed here. Median across runs, because one lucky run is
// not a schedule.
const PROBE_OFFERS = 60;
const parCurves = [];
for (let run = 0; run < 60; run++) {
  let s0 = run * 40503 + 7;
  const rng = () => ((s0 = (s0 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const par = state(SQUAD.startPower);
  const curve = [];
  for (let offer = 0; offer < PROBE_OFFERS; offer++) {
    const wave = 1 + Math.floor(offer / 2);
    const ctx = {
      power: par.power,
      damageBonus: par.upgrades.damageBonus,
      rateBonus: par.upgrades.rateBonus,
    };
    const gates = rollOffer(G.perOffer, wave, ctx, rng);
    if (gates.length > 0) applyGate(par, gates[scoreOffer(par, gates, wave).best]);
    curve.push({
      dps: squadDps(par), want: shotsPerSecond(par), bundle: bundleFactor(par), power: par.power,
    });
  }
  parCurves.push(curve);
}
const medianAt = (i) => {
  // Median of each field independently would mix rows; take the run at the
  // median of `dps` and report its other fields.
  const rows = parCurves.map((c) => c[i]).sort((a, b) => a.dps - b.dps);
  return rows[Math.floor(rows.length / 2)];
};
console.log('\n  offer   ~minutes   par power   par DPS   shots/s wanted   shots per bullet   hpMult wanted   capped');
let pinOffer = -1;
for (let i = 9; i < PROBE_OFFERS; i += 10) {
  const r = medianAt(i);
  const wanted = r.dps * budgetShare / (WAVE.maxSpawnRate * lateAvgHp);
  console.log(
    String(i + 1).padStart(7),
    ((i + 1) * GATES.interval / 60).toFixed(1).padStart(10),
    Math.round(r.power).toExponential(1).padStart(11),
    r.dps.toExponential(2).padStart(9),
    Math.round(r.want).toExponential(2).padStart(16),
    `x${r.bundle.toFixed(1)}`.padStart(18),
    wanted.toExponential(2).padStart(15),
    (wanted > DIFFICULTY.maxHpMult ? 'YES' : 'no').padStart(9),
  );
}
for (let i = 0; i < PROBE_OFFERS; i++) {
  const wanted = medianAt(i).dps * budgetShare / (WAVE.maxSpawnRate * lateAvgHp);
  if (wanted > DIFFICULTY.maxHpMult) { pinOffer = i + 1; break; }
}
if (pinOffer < 0) {
  console.log(`\n  the budget still scales at offer ${PROBE_OFFERS}`
    + ` (~${(PROBE_OFFERS * GATES.interval / 60).toFixed(1)} min of play)`);
} else {
  console.log(`\n  the budget PINS at offer ${pinOffer}`
    + ` (~${(pinOffer * GATES.interval / 60).toFixed(1)} min of play)`);
}
// A run this project has watched a human play lasts several minutes, and offers
// arrive every GATES.interval seconds. A ceiling inside that is not a guard
// rail, it is the difficulty curve's last word.
if (pinOffer >= 0 && pinOffer <= PROBE_OFFERS) {
  console.error(
    `FAIL: enemy scaling stops after ${pinOffer} offers`
    + ` (~${(pinOffer * GATES.interval / 60).toFixed(1)} minutes)`,
    '\n      DIFFICULTY.maxHpMult is acting as a balance ceiling rather than a',
    '\n      guard rail: past it the player keeps compounding and the wave does not',
  );
  process.exit(1);
}
// The old power ceiling, in the unit the player feels. Par used to be clamped
// at 38,912 and every ARMY pick after that was a no-op it kept recommending.
let capOffer = -1;
for (let i = 0; i < PROBE_OFFERS; i++) {
  if (medianAt(i).power >= 38912) { capOffer = i + 1; break; }
}
console.log(`  par passes the OLD power ceiling (38,912) at offer ${capOffer < 0 ? '>60' : capOffer}`
  + (capOffer < 0 ? '' : ` (~${(capOffer * GATES.interval / 60).toFixed(1)} min); the ladder now continues past it`));
const lastRow = medianAt(PROBE_OFFERS - 1);
console.log(`  by offer ${PROBE_OFFERS}, par fires ${Math.round(lastRow.want)} shots/s`
  + ` in ${WEAPON.maxSimShotsPerSecond} bullets/s, x${lastRow.bundle.toFixed(1)} shots each`);

// ---------------------------------------------------------------------------
// The bundle rule itself, since it is what makes `squadDps` true again.
//
// `strike` is pure, so the cases that matter are asserted here rather than
// inferred from a played run. Each is the thin-shot model resolved at one
// instant: the body takes exactly the shots it needs, each spends one pierce,
// the rest carry on untouched.
// ---------------------------------------------------------------------------
console.log('\n=== the bundle rule ===');
const bullet = (shots, pierce) => {
  const bundle = new Array(pierce + 1).fill(0);
  bundle[pierce] = shots;
  return { damage: 1, bundle, shots, active: true };
};
const expect = (label, ok) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) { console.error(`FAIL: ${label}`); process.exit(1); }
};
{ // One shot, no pierce: one hit, bullet gone. The rule below the cap, unchanged.
  const b = bullet(1, 0);
  const used = strike(b, 10, 1, true);
  expect('one shot, pierce 0, big body: 1 shot charged, bullet spent', used === 1 && !b.active);
}
{ // One shot with pierce: one hit, pierce down, bullet lives.
  const b = bullet(1, 2);
  const used = strike(b, 10, 1, true);
  expect('one shot, pierce 2: 1 charged, now at pierce 1', used === 1 && b.active && b.bundle[1] === 1 && b.bundle[2] === 0);
}
{ // Three shots at pierce 2 meet a body needing two: two spend a pierce, one is untouched.
  const b = bullet(3, 2);
  const used = strike(b, 2, 1, true);
  expect('3 shots @p2 vs hp 2: 2 charged, bundle [0,2,1]', used === 2 && b.bundle.join() === '0,2,1' && b.shots === 3);
  // The next body needs five: the two leading shots go first (they have hit
  // before), then the fresh one; only three exist, so it survives with 3 dealt.
  const used2 = strike(b, 5, 1, true);
  expect('then vs hp 5: 3 charged, leading edge consumed first, bundle [2,1,0]', used2 === 3 && b.bundle.join() === '2,1,0' && b.active);
  // A third body needing three takes the two at level 0 (spent) and one at
  // level 1 (down to 0): bundle [1,0,0], one shot left.
  const used3 = strike(b, 3, 1, true);
  expect('then vs hp 3: 3 charged, two spent, bundle [1,0,0]', used3 === 3 && b.bundle.join() === '1,0,0' && b.active && b.shots === 1);
}
{ // A cage stops every shot that hits it, pierce or not.
  const b = bullet(3, 2);
  const used = strike(b, 2, 1, false);
  expect('cage: 3 shots @p2 vs hp 2: 2 charged and gone, bundle [0,0,1]', used === 2 && b.bundle.join() === '0,0,1');
}
{ // Full armour: every shot hits, none hurt.
  const b = bullet(4, 0);
  const used = strike(b, 5, 0, true);
  expect('fully armoured body takes all 4 shots and the bullet is spent', used === 4 && !b.active);
}
{ // An exact multiple charges exactly, not one more for float noise.
  const b = bullet(10, 0);
  const used = strike(b, 0.3 * 3, 0.3, true);
  expect('hp 0.9 at 0.3 per shot charges 3, not 4', used === 3 && b.shots === 7);
}
{ // Conservation across many bodies: shots consumed equals shots gone plus pierced.
  const b = bullet(7, 1);
  let charged = 0;
  let bodies = 0;
  while (b.active && bodies < 20) { charged += strike(b, 2, 1, true); bodies++; }
  // 7 shots with one pierce each are charged exactly 14 times. Bodies six and
  // seven each meet the last shot alone - one charge each - so it takes eight.
  expect('7 shots @p1 are charged 14 times across eight 2-hp bodies then spent', charged === 14 && bodies === 8 && !b.active);
}

console.log('PASS');
