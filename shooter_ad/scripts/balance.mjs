/**
 * Balance probe. Plays the built game headlessly across several fixed seeds and
 * prints a time series of power, par, standing, DPS and the enemy multipliers.
 *
 * Three properties make the numbers worth acting on:
 *
 * - **Fixed seeds.** Balance work is comparison work, and a single unseeded run
 *   varies ~2x on gate luck alone - enough to make a change look like a
 *   regression when nothing changed. Runs differ only by the code under test.
 * - **A bot that plays.** It steers toward a gate rather than sweeping blindly,
 *   so the series measures the DESIGN rather than whether a sine wave happened
 *   to pass under an offer. It chooses from the game's OWN scoring: each live
 *   gate publishes the fractional DPS change it would produce, priced by the
 *   same `scoreOffer` par and the death screen use, so it answers exactly the
 *   question the game asks a player. Its predecessor ranked gates by AXIS,
 *   which cannot express a choice between two magnitudes of the same axis -
 *   the entire decision - so every number it produced was soft.
 * - **A run reproduces exactly.** Bot and simulation both advance on the fixed
 *   step; `npm run repeat` is the check that keeps it that way.
 *
 * PROBE_SKILL (default 0.7) is the probability of taking the best option,
 * otherwise picking uniformly at random among the offer. That closes the loop
 * with design: DIFFICULTY.targetFraction is a claim about what fraction of
 * optimal the game expects, and this is how the claim gets tested. Probing at
 * 0.5 / 0.7 / 0.9 should produce visibly different runs; if it does not, the
 * curve is not responding to skill and something upstream is wrong.
 *
 * The bot lives in `probe-bot.mjs`, shared with `repeat.mjs`. It remains a
 * crude player: no threat avoidance, no positioning for breaches, and it cannot
 * dodge enemy fire at all. Read it as a floor on difficulty, not a verdict on
 * how the game feels.
 */
import { chromium } from 'playwright';
import { playSeed, serveDist } from './probe-bot.mjs';

const SECONDS = Number(process.env.PROBE_SECONDS ?? 150);
const SEEDS = (process.env.PROBE_SEEDS ?? '1,2,3').split(',').map(Number);
const VERBOSE = process.env.PROBE_VERBOSE === '1';
const SKILL = Number(process.env.PROBE_SKILL ?? 0.7);
const MODE = process.env.PROBE_MODE ?? 'normal';

const { port, close } = await serveDist();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

const results = [];
for (const seed of SEEDS) {
  results.push(await playSeed(browser, port, { seed, skill: SKILL, seconds: SECONDS, mode: MODE }));
}
await browser.close();
close();

for (const r of results) {
  console.log(
    `\n=== seed ${r.seed} — survived ${r.survived}s, reached wave ${r.wave},`,
    `played at ${(r.optimal * 100).toFixed(0)}% of optimal`,
    `(${r.decisions} decisions ${r.tally.top}/${r.tally.mid}/${r.tally.low}) ===`,
  );
  if (VERBOSE || results.length === 1) {
    console.log('  t   wave  power    par   dps  parDps  stand  hpMult   rate  kills');
    for (const s of r.rows) {
      console.log(
        String(s.t).padStart(4), String(s.wave).padStart(5),
        String(s.power).padStart(7), String(s.parPower).padStart(6),
        String(s.dps).padStart(6), String(s.parDps).padStart(7),
        String(s.standing).padStart(6), String(s.hpMult).padStart(7),
        String(s.rate).padStart(6),
        String(s.kills).padStart(6), s.over ? ' OVER' : '');
    }
  } else {
    const stands = r.rows.map((s) => s.standing);
    const avg = stands.reduce((a, b) => a + b, 0) / (stands.length || 1);
    console.log(`  mean standing ${avg.toFixed(2)}, peak ${Math.max(...stands).toFixed(2)}`);
  }
  for (const e of r.errors) console.log('  ERROR ' + e);
}

const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const survivals = results.map((r) => r.survived).sort((a, b) => a - b);

// The number that closes the loop with design. PROBE_SKILL is an INPUT - the
// chance of reaching for the best option - and this is the OUTPUT: the share of
// achievable damage growth actually captured, after misreached gates and missed
// offers. They are not the same quantity and should not be read as one.
const optimals = results.map((r) => r.optimal);
const stands = results.flatMap((r) => r.rows.map((x) => x.standing));

console.log(`\nmode ${MODE}, skill ${SKILL}  (probability of reaching for the best option)`);
console.log(`survival: ${survivals.join('s, ')}s   median ${med(survivals)}s`);
console.log(`optimal:  ${optimals.map((o) => (o * 100).toFixed(0) + '%').join(', ')}`
  + `   median ${(med(optimals) * 100).toFixed(0)}%`);
console.log(`standing: median ${med(stands).toFixed(2)}`
  + `   (mercy clamp governs below ${med(results.map((r) => r.clampThreshold)).toFixed(2)})`);

// Why runs end, and what steering cost. These separate "the player chose badly"
// from "the player could not be in two places at once": if a high-skill bot
// travels further and bleeds more power to breaches, difficulty is chasing its
// positioning rather than its judgement.
const perMin = (xs, r) => (r.survived > 0 ? (xs / r.survived) * 60 : 0);
console.log(
  `breach loss/min: median ${med(results.map((r) => perMin(r.breachLoss, r))).toFixed(1)}`
  + `   fire loss/min: median ${med(results.map((r) => perMin(r.fireLoss, r))).toFixed(1)}`,
);
console.log(
  `travel/min: median ${Math.round(med(results.map((r) => perMin(r.traveled, r))))}px`,
);
// Pierce, claimed against measured. `pierceMultiplier` prices a pierce-P shot
// at 1 + q x P bodies; this is the bodies a landing shot actually met, over the
// whole run (so it lags the last pierce pick), with the share of the stream
// that landed at all. A claim well above the measurement means par and the
// player are both being credited for damage that does not arrive.
console.log(
  'pierce: ' + results.map((r) =>
    `p${r.pierce} claim x${r.pierceClaim.toFixed(2)} measured x${r.hitsPerLanding.toFixed(2)} (${(r.landed * 100).toFixed(0)}% landed)`).join('; '),
);
console.log(`errors: ${results.reduce((n, r) => n + r.errors.length, 0)}`);
