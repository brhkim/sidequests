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
 * 4. `x MOVE`, `+TIME` and `+SENSE` carry no damage, and the author's rule is
 *    that they are therefore worth exactly zero to the scoring: par never
 *    takes one, and a player who does is told RISK. This asserts the zero
 *    holds at every wave and stacking, and that par's pick rate on them is 0.
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
const { gateDescentSeconds, waveGateSpeedMult } =
  await import('../src/systems/Progression.ts');
const { RISK_AXES } = await import('../src/config.ts');
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

console.log('=== pierce, at a fixed q per level (linear, not compounding) ===');
for (let i = 0; i <= 12; i += (i < 4 ? 1 : 4)) {
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
console.log('  wave   speed x   descent s');
for (const wave of [1, 3, 6, 10, 15, 21, 30]) {
  const u = freshUpgrades();
  console.log(
    String(wave).padStart(6),
    waveGateSpeedMult(wave).toFixed(2).padStart(9),
    gateDescentSeconds(wave, u).toFixed(2).padStart(11),
  );
}
if (!(waveGateSpeedMult(30) > waveGateSpeedMult(1))) {
  console.error('FAIL: gate approach speed does not rise with the wave');
  process.exit(1);
}

/** What the game's own scoring says one gate is worth, in one state, one wave. */
const priced = (p, g, wave) => scoreOffer(p, [g], wave).options[0].delta;

console.log('\n=== x MOVE, +TIME, +SENSE and +SHIELD are priced at exactly zero (RISK) ===');
// The author's rule: a bonus that moves no damage number is worth nothing to
// the scoring. Par never takes one; the player who does is told RISK. Checked
// at every wave and however far the bonuses are already stacked, so a factor
// cannot creep back into `progressValue` unnoticed.
{
  let worst = 0;
  for (const wave of [1, 3, 6, 10, 15, 21, 30]) {
    for (const [mv, tm, se, sh] of [[1, 1, 0, 0], [2, 1, 1, 1], [1, 2, 2, 3], [4, 3, 0, 2], [8, 6, 3, 3]]) {
      const p = state(200, { moveMult: mv, gateSpeedMult: 1 / tm, sense: se, shield: sh });
      for (const g of [
        gate('move', 'mult', 1.05), gate('move', 'mult', 1.5),
        gate('time', 'raw', 1.05), gate('time', 'raw', 1.5), gate('sense', 'raw', 1),
        gate('shield', 'raw', 1),
      ]) worst = Math.max(worst, Math.abs(priced(p, g, wave)));
    }
  }
  console.log(`  largest |delta| of a risk axis anywhere: ${worst}`);
  if (worst !== 0) {
    console.error('FAIL: a MOVE / TIME / SENSE / SHIELD draw moved the scoring - see RISK_AXES in config');
    process.exit(1);
  }
  const axes = new Set(RISK_AXES);
  if (!(axes.has('move') && axes.has('time') && axes.has('sense') && axes.has('shield') && axes.size === 4)) {
    console.error('FAIL: RISK_AXES is not exactly move / time / sense / shield'); process.exit(1);
  }
  // A risk pick against damage options ranks last, and against other risk
  // picks ranks as a tie (any pick is a top pick when every option is 0).
  const { pickRank, isRiskPick } = await import('../src/systems/Scoring.ts');
  const mixed = scoreOffer(state(200), [gate('damage', 'mult', 1.05), gate('move', 'mult', 1.5), gate('rate', 'mult', 1.25)], 6);
  if (mixed.best !== 2 || pickRank(mixed, 1) !== 1 || !isRiskPick(mixed, 1) || isRiskPick(mixed, 0)) {
    console.error('FAIL: a risk pick beside damage options must rank last and read as RISK'); process.exit(1);
  }
  const allRisk = scoreOffer(state(200), [gate('move', 'mult', 1.5), gate('shield', 'raw', 1), gate('sense', 'raw', 1)], 6);
  if (pickRank(allRisk, 0) !== 0 || pickRank(allRisk, 1) !== 0 || pickRank(allRisk, 2) !== 0) {
    console.error('FAIL: an offer of only risk axes must tie'); process.exit(1);
  }
  console.log('  a risk pick beside damage ranks last; an all-risk offer ties; isRiskPick agrees');
}


// What par spends on the risk axes: nothing, by construction. Difficulty
// budgets enemies against `squadDps(par)`, and par prices every offer by DPS,
// so it never takes MOVE, TIME or SENSE unless the offer is NOTHING ELSE - an
// all-risk offer scores three zeros and the tie-break picks one, which costs
// par nothing. Asserted over 200 runs so a factor creeping back into the
// valuation would fail here.
const { rollOffer } = await import('../src/data/gates.ts');
const { GATES: G } = await import('../src/config.ts');
console.log('\n=== what par spends on the risk axes (200 simulated runs of 30 offers) ===');
let riskPicks = 0, totalPicks = 0, withRisk = 0, allRisk = 0;
const axesRisk = new Set(RISK_AXES);
for (let run = 0; run < 200; run++) {
  // Seeded, like everything else here: a deterministic LCG per run.
  let s0 = run * 2654435761 + 12345;
  const rng = () => ((s0 = (s0 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const par = state(SQUAD.startPower);
  for (let offer = 0; offer < 30; offer++) {
    const wave = 1 + Math.floor(offer / 2);
    const ctx = {
      power: par.power,
      damageBonus: par.upgrades.damageBonus,
      rateBonus: par.upgrades.rateBonus,
      guns: par.upgrades.guns, pierce: par.upgrades.pierce, sense: par.upgrades.sense, shield: par.upgrades.shield,
    };
    const gates = rollOffer(G.perOffer, wave, ctx, rng);
    if (gates.length === 0) continue;
    if (gates.some((g) => axesRisk.has(g.axis))) withRisk++;
    if (gates.every((g) => axesRisk.has(g.axis))) allRisk++;
    const pick = gates[scoreOffer(par, gates, wave).best];
    totalPicks++;
    if (axesRisk.has(pick.axis)) riskPicks++;
    applyGate(par, pick);
  }
}
console.log(`  offers containing a risk option:     ${(withRisk / totalPicks * 100).toFixed(1)}%`);
console.log(`  offers that are ONLY risk options:   ${(allRisk / totalPicks * 100).toFixed(2)}%  (${allRisk})`);
console.log(`  picks par spends on risk axes:       ${(riskPicks / totalPicks * 100).toFixed(2)}%  (${riskPicks})`);
if (riskPicks !== allRisk) { console.error('FAIL: par took a risk axis when a damage option was offered'); process.exit(1); }


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
  const ctx = { power: SQUAD.startPower, damageBonus: 0, rateBonus: 0, guns: 1, pierce: 0, sense: 0, shield: 0 };
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
console.log('\n=== legibility tiers: the drift the author accepted ===');
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
// The tiers used to be held to 0.5% per draw. The author's schedule (three
// round values, then the tenths, then twentieths, then hundredths) cannot
// meet that inside a fixed range - the tenths sit ~1.9% per draw above the
// hundredths - and the author read the number and accepted it. MEAN_DRIFT
// caps it there so it stays a decision on the record: a table drifting past
// 2.5% per draw (~110% over 30 offers) is a new decision, not this one.
// Measured against the FINEST tier, which is the reference the schedule
// converges to, not against tier 0.
const MEAN_DRIFT = 0.025;
const fine = geo[geo.length - 1];
const worstVsFine = geo.reduce((a, b) => (Math.abs(b / fine - 1) > Math.abs(a / fine - 1) ? b : a));
console.log(`  worst tier against the finest: ${((worstVsFine / fine - 1) * 100).toFixed(2)}% per draw (cap ${MEAN_DRIFT * 100}%)`);
if (Math.abs(worstVsFine / fine - 1) > MEAN_DRIFT) {
  throw new Error(
    `a legibility tier differs from the finest in geometric mean by ${((worstVsFine / fine - 1) * 100).toFixed(2)}%`
    + ' per draw - past the drift the author accepted',
  );
}
if (LEGIBILITY.length !== 4 || LEGIBILITY.map((t) => t.minWave).join() !== '1,6,11,16') {
  throw new Error('the legibility schedule is four tiers at waves 1 / 6 / 11 / 16');
}


// ---------------------------------------------------------------------------
// The judgment curve, wave by wave: everything that keys off `judgmentWave`
// in one table, so the shape of the late game can be read rather than
// re-derived. Four levers - descent time, gate speed, the root table a bonus
// draws from, and dead space between gates - and the Titan waves marked,
// because a Titan wave is where all four are felt at once.
//
// Asserted: dead space is zero through wave 3 (normal), never decreases,
// caps at `GATES.deadSpace.max`, never pushes a gate under `GATES.minWidth`,
// and hard mode's wave 1 is exactly normal's wave 1 + offset - the same
// "started later" property the speed and legibility checks above enforce.
// ---------------------------------------------------------------------------
const { gateDeadSpace } = await import('../src/systems/Progression.ts');
const { WAVE: WAVE_CFG, VIEW } = await import('../src/config.ts');
console.log('\n=== the judgment curve, per wave ===');
const LANE = VIEW.width / G.perOffer;
const curveRow = (wave) => {
  const u = freshUpgrades();
  const tier = legibilityFor(judgmentWave(wave));
  const dead = gateDeadSpace(wave);
  return {
    wave, descent: gateDescentSeconds(wave, u), speed: waveGateSpeedMult(wave),
    roots: tier.roots.length, sigFigs: tier.sigFigs, dead,
    width: Math.max(G.minWidth, LANE - dead), titan: wave % WAVE_CFG.bossEvery === 0,
  };
};
const printCurve = (mode, waves) => {
  setMode(mode);
  console.log(`  ${mode}`);
  console.log('    wave  descent s  speed x  roots  sig figs  dead px  gate px');
  const rows = waves.map(curveRow);
  for (const r of rows) {
    console.log(
      String(r.wave).padStart(8),
      r.descent.toFixed(2).padStart(10),
      r.speed.toFixed(3).padStart(8),
      String(r.roots).padStart(6),
      String(r.sigFigs).padStart(9),
      String(r.dead).padStart(8),
      String(r.width).padStart(8),
      r.titan ? '  TITAN' : '',
    );
  }
  setMode('normal');
  return rows;
};
const curveNormal = printCurve('normal', Array.from({ length: 32 }, (_, i) => i + 1));
const curveHard = printCurve('hard', Array.from({ length: 27 }, (_, i) => i + 1));
for (const r of curveNormal.slice(0, 3)) {
  if (r.dead !== 0) throw new Error(`dead space is ${r.dead}px at normal wave ${r.wave}; must be 0 through wave 3`);
}
for (const rows of [curveNormal, curveHard]) {
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].dead < rows[i - 1].dead) throw new Error(`dead space fell at wave ${rows[i].wave}`);
  }
  for (const r of rows) {
    if (r.dead > G.deadSpace.lateMax) throw new Error(`dead space ${r.dead}px exceeds the cap at wave ${r.wave}`);
    if (r.width < G.minWidth) throw new Error(`gate width ${r.width}px under minWidth at wave ${r.wave}`);
  }
}
if (curveNormal[curveNormal.length - 1].dead !== G.deadSpace.lateMax) {
  throw new Error('dead space never reaches its cap by normal wave 32');
}
// Two stages, the author's shape (0.8): the first cap is reached at wave
// 16 and held for no wave at all - the second stage starts at once and
// runs to wave 26; speed likewise reaches its cap at wave 31, not 21.
const firstCapWave = G.deadSpace.fromWave + G.deadSpace.max / G.deadSpace.perWave;
if (curveNormal[firstCapWave - 1].dead !== G.deadSpace.max) {
  throw new Error(`dead space is not ${G.deadSpace.max}px at normal wave ${firstCapWave}`);
}
if (curveNormal[firstCapWave].dead <= G.deadSpace.max) {
  throw new Error('dead space flattens after its first cap; the second stage is missing');
}
const speedCapWave = curveNormal.findIndex((r) => r.speed >= G.maxSpeedMult) + 1;
if (speedCapWave !== 31) throw new Error(`gate speed caps at wave ${speedCapWave}, expected 31`);
const deadCapWave = curveNormal.findIndex((r) => r.dead >= G.deadSpace.lateMax) + 1;
if (deadCapWave !== 26) throw new Error(`dead space caps at wave ${deadCapWave}, expected 26`);
if (curveHard[0].dead !== curveNormal[OFFSET].dead) {
  throw new Error(`hard wave 1 dead space (${curveHard[0].dead}) is not normal wave ${1 + OFFSET} (${curveNormal[OFFSET].dead})`);
}
if (LANE - G.deadSpace.lateMax < G.minWidth) {
  throw new Error('GATES.deadSpace.lateMax leaves a card narrower than GATES.minWidth');
}
console.log(`  dead space: 0 through normal wave ${G.deadSpace.fromWave}, +${G.deadSpace.perWave}px a wave to ${G.deadSpace.max}px at wave ${firstCapWave},`
  + ` then +${G.deadSpace.latePerWave}px a wave to ${G.deadSpace.lateMax}px at wave ${deadCapWave}`
  + ` (gate ${LANE - G.deadSpace.lateMax}px of a ${LANE}px lane); speed x${G.maxSpeedMult} from wave ${speedCapWave}; hard wave 1 = normal wave ${1 + OFFSET}`);


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
const { poolAverageHp, titanTravelSeconds } = await import('../src/data/enemies.ts');

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
      guns: par.upgrades.guns, pierce: par.upgrades.pierce, sense: par.upgrades.sense, shield: par.upgrades.shield,
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
  return { damage: 1, bundle, shots, active: true, struck: [] };
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

console.log('\n=== the Titan budget ===');
{
  const { ENEMY_BY_ID } = await import('../src/data/enemies.ts');
  const { Difficulty } = await import('../src/systems/Difficulty.ts');
  const { singleTargetDps } = await import('../src/systems/Progression.ts');
  const { FORMATION_HALF_WIDTH } = await import('../src/systems/Formation.ts');
  const titan = ENEMY_BY_ID.get('titan');
  // Geometry: a squad parked under the boss lands EVERY shot. A shot is a hit
  // when its centre is within (titan.radius + bulletRadius) of the boss, so
  // the column's half width may not exceed the boss's radius.
  // A shot lands when its centre is within radius + bulletRadius of the boss,
  // so that sum is the hit radius the column's half width is held under.
  const hitRadius = titan.radius + WEAPON.bulletRadius;
  console.log(`  column ${WEAPON.columnWidth}px (guns ${WEAPON.gunSpread}px of it), formation ${2 * FORMATION_HALF_WIDTH}px, Titan ${2 * titan.radius}px (hit radius ${hitRadius})`);
  expect('every shot from a centred squad lands on a centred Titan',
    WEAPON.columnWidth / 2 <= hitRadius && WEAPON.gunSpread <= WEAPON.columnWidth);
  expect('units are spread across the column, not stacked on its centre',
    FORMATION_HALF_WIDTH > 0 && WEAPON.columnWidth > WEAPON.gunSpread);
  // Arithmetic: at standing 1.0 with every shot landing, the boss dies at
  // exactly bossKillPar x bossKillDistance of its descent - armor included,
  // and independent of the wave's hpMult, which is what made it wrong before.
  const d = new Difficulty();
  const p = state(500, { damageMult: 4, rateMult: 2, guns: 3, pierce: 2 });
  d.seedPar(p);
  const travel = titanTravelSeconds();
  const hp = d.titanHp(travel, titan.armor);
  const delivered = singleTargetDps(p) * (1 - titan.armor);
  const killAt = hp / delivered / travel;
  const want = DIFFICULTY.bossKillPar * DIFFICULTY.bossKillDistance;
  console.log(`  descent ${travel.toFixed(1)}s, HP ${hp.toExponential(2)}, delivered ${delivered.toExponential(2)}/s -> dies at ${(killAt * 100).toFixed(1)}% (budget ${(want * 100).toFixed(1)}%)`);
  expect('a par squad with every shot landing kills the Titan at bossKillPar x bossKillDistance',
    Math.abs(killAt - want) < 1e-9);
  expect('the boss is pinned to single-target DPS, not to pierce', (() => {
    const q = state(500, { damageMult: 4, rateMult: 2, guns: 3, pierce: 0 });
    const e = new Difficulty(); e.seedPar(q);
    return Math.abs(e.titanHp(travel, titan.armor) / hp - 1) < 1e-9;
  })());
}


// ---------------------------------------------------------------------------
// The discrete axes scale with what is held, and SENSE is priced.
//
// GUNS and PIERCE are whole numbers. A flat +1 shrinks as they stack, so past
// `GATES.scaleDiscreteFrom` an offer draws a root and presents the whole number
// whose effect is nearest it - the rule raw ARMY already follows. Asserted here
// on the shipped `discreteAmount` and `scoreOffer`: below the threshold the
// offer is +1; above it the top draw is worth at least what a mid draw of DMG
// is, so the axis never goes dead; and the label's number is the number applied.
// ---------------------------------------------------------------------------
const { discreteAmount, senseChance, MAX_SENSE } =
  await import('../src/systems/Progression.ts');
const { SENSE } = await import('../src/config.ts');
console.log('\n=== GUNS and PIERCE offers scale with what you hold ===');
console.log('  held    +N GUNS at root 1.05 / 1.25 / 1.5   effect   |   +N PIERCE at 1.05 / 1.25 / 1.5   effect');
let deadAxis = null;
for (const held of [1, 2, 3, 4, 6, 10, 20, 50]) {
  const g = [1.05, 1.25, 1.5].map((r) => discreteAmount('guns', held, r));
  const pr = [1.05, 1.25, 1.5].map((r) => discreteAmount('pierce', held, r));
  const gEff = delta(state(200, { guns: held }), gate('guns', 'raw', g[2]));
  const pEff = delta(state(200, { pierce: held }), gate('pierce', 'raw', pr[2]));
  console.log(
    String(held).padStart(6),
    `+${g.join(' / +')}`.padStart(22), `${(gEff * 100).toFixed(0)}%`.padStart(9),
    '   |',
    `+${pr.join(' / +')}`.padStart(20), `${(pEff * 100).toFixed(0)}%`.padStart(9),
  );
  if (held < GATES.scaleDiscreteFrom && (g.some((n) => n !== 1) || pr.some((n) => n !== 1))) {
    deadAxis = `below ${GATES.scaleDiscreteFrom} held the offer must be +1`;
  }
  // The top draw must stay worth at least a mid damage draw (x1.25) - the
  // axis is live - and must not overshoot the top of the root range by more
  // than rounding allows at small counts.
  if (held >= GATES.scaleDiscreteFrom && (gEff < 0.25 || pEff < 0.25)) deadAxis = `axis dead at ${held} held`;
}
if (deadAxis) { console.error(`FAIL: ${deadAxis}`); process.exit(1); }
// Rounding is toward the nearest whole number, never below 1.
if (discreteAmount('guns', 3, 1.05) !== 1 || discreteAmount('guns', 10, 1.5) !== 5
  || discreteAmount('pierce', 3, 1.5) !== 3 || discreteAmount('pierce', 10, 1.2) !== 2) {
  console.error('FAIL: discreteAmount rounds differently from its documentation'); process.exit(1);
}
// Labels carry the applied number: build real offers and check.
{
  let h = 5;
  const r = () => ((h = (h * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const ctx = { power: 500, damageBonus: 1, rateBonus: 1, guns: 6, pierce: 6, sense: 0, shield: 0 };
  let seen = 0;
  for (let i = 0; i < 400; i++) {
    for (const g of rollOffer(G.perOffer, 12, ctx, r)) {
      if (g.axis !== 'guns' && g.axis !== 'pierce') continue;
      seen++;
      const n = Number(g.label.match(/^\+(\d+) /)[1]);
      if (n !== g.value) { console.error(`FAIL: label ${g.label} applies ${g.value}`); process.exit(1); }
    }
  }
  console.log(`  ${seen} discrete offers rolled at 6 guns / 6 pierce; every label matches its effect`);
}

console.log('\n=== SENSE: a roll at spawn, never a price ===');
console.log('  held   chance   still offered');
for (let s = 0; s <= MAX_SENSE; s++) {
  console.log(
    String(s).padStart(6), `${(senseChance(s) * 100).toFixed(0)}%`.padStart(8),
    (s < MAX_SENSE ? 'yes' : 'no').padStart(15),
  );
}
if (SENSE.chance[0] !== 0) { console.error('FAIL: sense 0 must mark nothing'); process.exit(1); }
for (let s = 1; s <= MAX_SENSE; s++) {
  if (!(SENSE.chance[s] > SENSE.chance[s - 1])) { console.error('FAIL: sense chance must rise'); process.exit(1); }
}
{
  // At the cap it is not offered; it never reaches DPS at any level.
  let h = 9;
  const r = () => ((h = (h * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const ctx = { power: 200, damageBonus: 0, rateBonus: 0, guns: 1, pierce: 0, sense: MAX_SENSE, shield: 0 };
  for (let i = 0; i < 400; i++) {
    if (rollOffer(G.perOffer, 8, ctx, r).some((g) => g.axis === 'sense')) {
      console.error('FAIL: +SENSE offered at the cap'); process.exit(1);
    }
  }
  console.log(`  +SENSE leaves the pool at ${MAX_SENSE} held; squadDps ignores it entirely`);
  if (squadDps(state(200, { sense: 2 })) !== squadDps(state(200))) { console.error('FAIL: sense reached DPS'); process.exit(1); }
}

// ---------------------------------------------------------------------------
// SHIELD: a charge pool, never a price. `blocksPerLevel x level` charges,
// refilling at that many per `windowSeconds`, spent one per bullet whatever
// the bullet cost; filled at once on a pick; out of the pool at the cap. The
// pool is stepped on the fixed clock here exactly as `Squad.update` steps it.
// ---------------------------------------------------------------------------
console.log('\n=== SHIELD: blocks per window per level, never a price ===');
{
  const { SHIELD, SIM } = await import('../src/config.ts');
  const { Shield } = await import('../src/systems/Shield.ts');
  const { MAX_SHIELD } = await import('../src/systems/Progression.ts');
  const { ENEMY_BY_ID } = await import('../src/data/enemies.ts');
  console.log('  held   capacity   refill/s   blocks in 5s from empty   still offered');
  for (let level = 0; level <= MAX_SHIELD; level++) {
    const sh = new Shield();
    sh.update(SIM.step, level);              // the pick: fills to capacity
    const cap = Shield.capacity(level);
    expect(`level ${level} fills to ${cap} on the pick`, sh.ready === cap);
    while (sh.tryBlock()) { /* drain */ }
    expect(`level ${level} is empty after ${cap} blocks`, sh.ready === 0 && !sh.tryBlock());
    // Refill from empty over one window, on the fixed step.
    let blocks = 0;
    for (let t = 0; t < SHIELD.windowSeconds + 1e-9; t += SIM.step) {
      sh.update(SIM.step, level);
      while (sh.tryBlock()) blocks++;
    }
    console.log(
      String(level).padStart(6), String(cap).padStart(10),
      (cap / SHIELD.windowSeconds).toFixed(2).padStart(10), String(blocks).padStart(24),
      (level < MAX_SHIELD ? 'yes' : 'no').padStart(15),
    );
    expect(`level ${level} blocks ${cap} per window from empty`, blocks === cap);
  }
  expect('a level is 2 blocks per 5s (the author\'s rule)', SHIELD.blocksPerLevel === 2 && SHIELD.windowSeconds === 5);
  expect('SHIELD caps at 3 like SENSE', MAX_SHIELD === 3 && MAX_SHIELD === MAX_SENSE);
  // A charge is one bullet: the Mortar's shell costs 2 and is still one block.
  const mortar = ENEMY_BY_ID.get('mortar');
  expect('the Mortar exists and fires a shell', !!mortar && mortar.gun && mortar.gun.shell === true);
  expect('a shell costs twice a dart', mortar.gun.damage === 2);
  expect('a shell is slower than every dart', [...ENEMY_BY_ID.values()].every((e) => !e.gun || e.gun.shell || e.gun.speed > mortar.gun.speed));
  // At the cap it is not offered; it never reaches DPS.
  let h = 11;
  const r = () => ((h = (h * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const ctx = { power: 200, damageBonus: 0, rateBonus: 0, guns: 1, pierce: 0, sense: 0, shield: MAX_SHIELD };
  let offered = 0;
  for (let i = 0; i < 400; i++) {
    if (rollOffer(G.perOffer, 8, ctx, r).some((g) => g.axis === 'shield')) offered++;
  }
  expect('+SHIELD leaves the pool at the cap', offered === 0);
  const ctx0 = { ...ctx, shield: 0 };
  offered = 0;
  for (let i = 0; i < 400; i++) {
    if (rollOffer(G.perOffer, 8, ctx0, r).some((g) => g.axis === 'shield')) offered++;
  }
  console.log(`  +SHIELD in ${(offered / 4).toFixed(0)}% of wave-8 offers at 0 held, 0% at the cap`);
  expect('+SHIELD is offered below the cap', offered > 0);
  expect('squadDps ignores SHIELD', squadDps(state(200, { shield: 3 })) === squadDps(state(200)));
  const applied = state(1);
  applyGate(applied, gate('shield', 'raw', 1)); applyGate(applied, gate('shield', 'raw', 1));
  applyGate(applied, gate('shield', 'raw', 1)); applyGate(applied, gate('shield', 'raw', 1));
  expect('applyGate clamps SHIELD at the cap', applied.upgrades.shield === MAX_SHIELD);
}

console.log('\n=== rescue cages and enemy fire scale with the run ===');
{
  const { CAGE, ENEMY_FIRE } = await import('../src/config.ts');
  const { ENEMY_BY_ID } = await import('../src/data/enemies.ts');
  const { Difficulty } = await import('../src/systems/Difficulty.ts');
  const titan = ENEMY_BY_ID.get('titan');
  const travel = titanTravelSeconds();
  console.log('  par DPS   Titan HP    cage HP   cage at par (s)   reward at 1 / 19 / 30 / 5000 power');
  for (const dps of [3, 1e3, 1e6, 1e9]) {
    const d = new Difficulty();
    const p = state(50, { damageMult: dps / squadDps(state(50)) });
    d.seedPar(p);
    const hp = d.titanHp(travel, titan.armor);
    const cage = hp * CAGE.hpTitanFraction;
    const { cageReward: reward } = await import('../src/systems/Progression.ts');
    console.log(
      dps.toExponential(0).padStart(9), hp.toExponential(2).padStart(10), cage.toExponential(2).padStart(10),
      (cage / squadDps(p)).toFixed(2).padStart(17),
      `+${[1, 19, 30, 5000].map(reward).join(' / +')}`.padStart(32),
    );
  }
  // The cage's cost in seconds of par fire is a constant of the design, not of
  // the wave: a fifth of bossKillPar x bossKillDistance x descent x (1 - armor).
  const d = new Difficulty(); d.seedPar(state(50));
  const cageSeconds = d.titanHp(travel, titan.armor) * CAGE.hpTitanFraction / squadDps(state(50));
  const want = DIFFICULTY.bossKillPar * DIFFICULTY.bossKillDistance * travel * (1 - titan.armor) * CAGE.hpTitanFraction;
  expect(`a cage costs ${cageSeconds.toFixed(2)}s of par fire at every par`, Math.abs(cageSeconds - want) < 1e-9);
  const cost = (power) => Math.max(ENEMY_FIRE.minCost, Math.floor(power * ENEMY_FIRE.powerShare));
  console.log(`  enemy bullet costs ${[1, 50, 199, 200, 999, 10000].map((p) => `${cost(p)} @${p}`).join(', ')} power`);
  expect('a bullet never costs less than one power', cost(1) === 1 && cost(99) === 1);
  expect('a bullet costs a whole 1% of a large army', cost(10000) === 100 && cost(10099) === 100);
}

console.log('\n=== contact: what a body costs when it reaches the army ===');
{
  // One function prices contact and breach, against the power held before
  // the step's charges - see systems/Contact.ts and the CONTACT block.
  const { CONTACT, ENEMY_FIRE } = await import('../src/config.ts');
  const { ENEMIES, ENEMY_BY_ID } = await import('../src/data/enemies.ts');
  const { contactCost } = await import('../src/systems/Contact.ts');
  const byTier = { basic: ['grunt', 'runner'], medium: ['shielder', 'spitter', 'splitter', 'lancer', 'mortar'], large: ['brute', 'bomber'], titan: ['titan'] };
  for (const e of ENEMIES) {
    expect(`${e.id} names a priced tier (${e.tier})`, Object.hasOwn(CONTACT, e.tier));
    expect(`${e.id} is in the tier the author decided (${e.tier})`, byTier[e.tier].includes(e.id));
  }
  expect('the Healer is gone', !ENEMY_BY_ID.has('healer'));
  expect('the roster is ten types', ENEMIES.length === 10);
  const t = (tier) => ENEMY_BY_ID.get(byTier[tier][0]);
  const cost = (tier, power) => contactCost(t(tier), power);
  expect('basic: floor 1 up to 99 power, share from 100', cost('basic', 1) === 1 && cost('basic', 99) === 1 && cost('basic', 100) === 2);
  expect('medium: floor 2 up to 74 power, share from 75', cost('medium', 5) === 2 && cost('medium', 74) === 2 && cost('medium', 75) === 3);
  expect('large: floor 3 up to 66 power, share from 67', cost('large', 19) === 3 && cost('large', 66) === 3 && cost('large', 67) === 4);
  expect('shares at the old cap: 778 / 1556 / 2334', cost('basic', 38912) === 778 && cost('medium', 38912) === 1556 && cost('large', 38912) === 2334);
  expect('the Titan is the whole army', [1, 19, 640, 38912].every((p) => cost('titan', p) === p));
  const bullet = (p) => Math.max(ENEMY_FIRE.minCost, Math.floor(p * ENEMY_FIRE.powerShare));
  // Monotone over the three ORDINARY tiers. The Titan is priced at exactly the
  // army, which at 1 or 2 power is numerically below a Large's floor of 3 -
  // irrelevant in play, because a Titan reaching the army ends the run on its
  // own flag rather than by the power reaching zero, and asserted above.
  let monotone = true, atLeastBullet = true;
  for (let p = 1; p <= 1e6; p = Math.ceil(p * 1.37)) {
    if (!(cost('basic', p) <= cost('medium', p) && cost('medium', p) <= cost('large', p))) monotone = false;
    if (cost('basic', p) < bullet(p)) atLeastBullet = false;
  }
  expect('cost is monotone basic <= medium <= large at every power', monotone);
  expect('a Basic contact is never cheaper than a bullet', atLeastBullet);
  console.log('  army      bullet   basic   medium   large     titan');
  for (const p of [1, 5, 19, 100, 640, 38912]) {
    console.log(
      String(p).padStart(6), String(bullet(p)).padStart(10), String(cost('basic', p)).padStart(8),
      String(cost('medium', p)).padStart(8), String(cost('large', p)).padStart(8), String(cost('titan', p)).padStart(9),
    );
  }
}

// ---------------------------------------------------------------------------
// The spawn line is the HUD's bottom edge (1.0), and the descent is scaled so
// the seconds to the breach line are what they were from 40px above the
// screen. The Titan's HP is priced on those seconds, so it moves by the same
// small amount the Titan's own 40px lead does and no more.
{
  const { HUD_ROWS, CAGE } = await import('../src/config.ts');
  const { ENEMIES, ENEMY_BY_ID } = await import('../src/data/enemies.ts');
  const { cageReward } = await import('../src/systems/Progression.ts');
  const LEGACY_SPAWN = -40;
  expect('enemies spawn at the HUD\'s bottom edge', ARENA.spawnY === HUD_ROWS.bottom && HUD_ROWS.bottom === 184);
  expect('retreat stops at the spawn line, never under the HUD', ARENA.spawnY === (await import('../src/config.ts')).MOTION.ceilingY);
  const legacy = (speed) => (ARENA.breachY - LEGACY_SPAWN) / speed;
  const now = (speed) => (ARENA.breachY - ARENA.spawnY) / (speed * ARENA.descentScale);
  const same = ENEMIES.every((e) => Math.abs(now(e.speed) - legacy(e.speed)) < 1e-9)
    && Math.abs(now(CAGE.speed) - legacy(CAGE.speed)) < 1e-9;
  expect('every body and the cage reach the line in the seconds they did from -40', same);
  const titan = ENEMY_BY_ID.get('titan');
  const before = (ARENA.breachY - (LEGACY_SPAWN - 40)) / titan.speed;
  const after = titanTravelSeconds();
  console.log(`  descent scale ${ARENA.descentScale.toFixed(4)};  Titan ${before.toFixed(1)}s -> ${after.toFixed(1)}s on the board, all of it visible`);
  expect('the Titan\'s descent, and so its HP, moved by under 2%', Math.abs(after / before - 1) < 0.02);
  const grunt = ENEMY_BY_ID.get('grunt');
  console.log(`  a Grunt: ${legacy(grunt.speed).toFixed(1)}s to the line, ${((ARENA.spawnY - LEGACY_SPAWN) / grunt.speed).toFixed(1)}s of it under the HUD before 1.0`);

  // A multiplier on the army adds at least one body, for the player and for
  // par alike, so `x1.1 ARMY` on the opening army of 1 is a real gate.
  const arm = (power, root) => { const p = state(power); applyGate(p, gate('army', 'mult', root)); return p.power; };
  expect('x1.1 ARMY on 1 gives 2 (was 1)', arm(1, 1.1) === 2);
  expect('x1.1 ARMY on 9 gives 10 (round(0.9) = 1 either way)', arm(9, 1.1) === 10);
  expect('x1.1 ARMY on 100 gives 110', arm(100, 1.1) === 110);
  expect('x1.5 ARMY on 1 gives 2, on 3 gives 5', arm(1, 1.5) === 2 && arm(3, 1.5) === 5);
  const offer = [gate('army', 'mult', 1.1), gate('damage', 'raw', 0.05), gate('move', 'mult', 1.2)];
  const scored = scoreOffer(state(1), offer, 1);
  expect('par scores x1.1 ARMY on an army of 1 as a real gain, and takes it', scored.options[0].delta > 0.9 && scored.best === 0);

  // A rescue is a tenth of the army, whole, never under 2 (1.0).
  expect('cage: +2 at 1, +2 at 19, +3 at 30, +10 at 100', cageReward(1) === 2 && cageReward(19) === 2 && cageReward(30) === 3 && cageReward(100) === 10);
}

console.log('PASS');
