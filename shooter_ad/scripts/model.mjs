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

console.log('PASS');
