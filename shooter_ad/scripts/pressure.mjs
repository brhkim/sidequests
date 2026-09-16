/**
 * The enemy-pressure instrument.
 *
 * The finding this exists for, from a real play session: **ordinary enemies do
 * not scale enough with the player's damage output.** The machinery for that
 * already exists - `systems/Difficulty.ts` budgets incoming enemy HP per second
 * as `squadDps(par) * targetFraction * pressure` - so the question is which of
 * those two constants to move and by how much, not what new mechanism to build.
 *
 * The two are not interchangeable, and the difference is why this prints the
 * threshold in every row:
 *
 * - **`pressure` scales the budget and nothing else.** The mercy clamp is
 *   applied before pressure multiplies in, so the regime boundary
 *   (`targetFraction / maxOverPlayer`) does not move and every run stays in the
 *   regime it was already in. A clean reading.
 * - **`targetFraction` drags the threshold with it.** Raising it makes the game
 *   meaner AND moves runs between the par-driven and clamp-driven regimes, so a
 *   difference measured against it is two changes wearing one number. Sweep it
 *   only with the threshold column in view.
 *
 * Both are injected per page, never rebuilt per value - the seam is in
 * `Difficulty.ts` and the reasoning is the same one `npm run mercy` records: a
 * value measured against its own build is not comparable with the next one.
 *
 * What the columns mean:
 *
 * - **threshold** - standing below which the clamp, not par, sets the budget.
 *   Constant down a pressure sweep; it moves down a targetFraction sweep, and
 *   when it does, rows either side of a run's standing are not comparable.
 * - **hpMult** - the median enemy HP multiplier actually in force. This is the
 *   quantity the finding is about. If it does not move with the knob, the knob
 *   is not reaching the enemies - which is exactly what `DIFFICULTY.maxHpMult`
 *   does once the budget saturates it.
 * - **died / survival** - a check that the change is felt, not a verdict. Five
 *   seeds cannot support a trend in survival, and a run that hit the budget
 *   rather than dying is a FLOOR, marked '+'.
 *
 * **The standing caveat that governs everything here.** The probe bot dies
 * young - typically wave 3 to 6 - so every row below is a reading about the
 * EARLY game. The finding is about the late game, where par DPS is orders of
 * magnitude higher, and no automated instrument in this project has ever been
 * there. Treat a row as evidence that a knob reaches the enemies at all, and
 * not as evidence about the state the finding came from.
 *
 *   npm run pressure
 *   PRESSURE_VALUES=0.82,1.0,1.2 PROBE_SKILL=0.7 npm run pressure
 *   PRESSURE_KNOB=targetFraction PRESSURE_VALUES=0.7,0.85,1.0 npm run pressure
 */
import { chromium } from 'playwright';
import { playSeed, serveDist } from './probe-bot.mjs';

const KNOB = process.env.PRESSURE_KNOB ?? 'pressure';
const VALUES = (process.env.PRESSURE_VALUES ?? '0.82,1.0,1.2,1.5').split(',').map(Number);
const SEEDS = (process.env.PROBE_SEEDS ?? '1,2,3,4,5').split(',').map(Number);
const SKILLS = (process.env.PRESSURE_SKILLS ?? '0.7,0.9').split(',').map(Number);
const SECONDS = Number(process.env.PROBE_SECONDS ?? 150);
const MODE = process.env.PRESSURE_MODE ?? 'normal';

if (KNOB !== 'pressure' && KNOB !== 'targetFraction') {
  throw new Error(`PRESSURE_KNOB must be 'pressure' or 'targetFraction', got ${KNOB}`);
}

const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const { port, close } = await serveDist();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

console.log(`knob ${KNOB}, mode ${MODE}, seeds ${SEEDS.join(',')},`
  + ` skills ${SKILLS.join(',')}, budget ${SECONDS}s simulated\n`);
console.log('    value   threshold   hpMult   standing   died   waves   breach/min   survival');

for (const value of VALUES) {
  const runs = [];
  for (const skill of SKILLS) {
    for (const seed of SEEDS) {
      runs.push(await playSeed(browser, port, {
        seed, skill, seconds: SECONDS, mode: MODE, [KNOB]: value,
      }));
    }
  }
  const perMin = (v, r) => (r.survived > 0 ? (v / r.survived) * 60 : 0);
  // Median of each run's own median, so one long run cannot outvote four short
  // ones by contributing five times as many samples.
  const hpMults = runs.map((r) => med(r.rows.map((x) => x.hpMult)) ?? 1);
  const standings = runs.map((r) => med(r.rows.map((x) => x.standing)) ?? 0);
  console.log(
    String(value).padStart(9),
    med(runs.map((r) => r.clampThreshold)).toFixed(2).padStart(12),
    med(hpMults).toFixed(2).padStart(8),
    med(standings).toFixed(2).padStart(11),
    `${runs.filter((r) => r.died).length}/${runs.length}`.padStart(7),
    String(med(runs.map((r) => r.wave))).padStart(7),
    med(runs.map((r) => perMin(r.breachLoss, r))).toFixed(1).padStart(13),
    `${med(runs.map((r) => r.survived))}s`.padStart(11),
  );
  const errs = runs.reduce((n, r) => n + r.errors.length, 0);
  if (errs > 0) console.log(`    ${errs} console error(s)`);
  console.log('          runs: '
    + runs.map((r) => `${r.survived}s${r.died ? '' : '+'}`).join(', '));
}

await browser.close();
close();
console.log('\nA "+" survival hit the budget rather than dying: that number is a FLOOR.');
console.log('Every row is an EARLY-game reading. The probe dies around wave 3-6, so it');
console.log('never reaches the late game the finding came from, and cannot speak to it.');
