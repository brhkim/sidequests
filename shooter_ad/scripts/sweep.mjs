/**
 * The skill sweep: runs every seed at every skill level and prints the table
 * that `CLAUDE.md` and `RESTART.md` quote.
 *
 * It exists because that table was previously produced by hand, by running
 * `npm run balance` five times and copying medians across - which is exactly
 * the kind of one-off command this project has been told to stop relying on.
 * A hand-built table cannot be re-run after a change, so it silently goes stale
 * and someone quotes it a month later as if it were current.
 *
 * What the columns mean, and the trap in each:
 *
 * - `survival` - SIMULATED seconds. Medians across five seeds cannot support a
 *   trend: within-level spreads have run 39s to 155s. Do not read a slope.
 * - `optimal` - the share of achievable damage growth captured. It compounds
 *   over DECISIONS, not seconds, so a short run has little room to fall behind
 *   and a short excellent run is not comparable with a long one.
 * - `standing` - the player's DPS against par's. The mercy clamp governs below
 *   `targetFraction / maxOverPlayer`; above it the curve is par-driven. Knowing
 *   which regime a row is in matters more than its value.
 * - `truncated` - runs that hit the time budget rather than dying. A truncated
 *   run's survival is a floor, and any median built from one is a floor too.
 *
 *   npm run sweep
 *   SWEEP_SKILLS=0.5,1.0 PROBE_SEEDS=1,2,3 SWEEP_MODE=hard npm run sweep
 */
import { chromium } from 'playwright';
import { playSeed, serveDist } from './probe-bot.mjs';

const SEEDS = (process.env.PROBE_SEEDS ?? '1,2,3,4,5').split(',').map(Number);
const SKILLS = (process.env.SWEEP_SKILLS ?? '0.3,0.5,0.7,0.9,1.0').split(',').map(Number);
const SECONDS = Number(process.env.PROBE_SECONDS ?? 150);
const MODE = process.env.SWEEP_MODE ?? 'normal';

const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const { port, close } = await serveDist();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

console.log(`mode ${MODE}, seeds ${SEEDS.join(',')}, budget ${SECONDS}s simulated\n`);
console.log('  skill   survival   optimal   standing   waves   breach/min   travel/min   trunc');

const table = [];
for (const skill of SKILLS) {
  const runs = [];
  for (const seed of SEEDS) {
    runs.push(await playSeed(browser, port, { seed, skill, seconds: SECONDS, mode: MODE }));
  }
  const perMin = (v, r) => (r.survived > 0 ? (v / r.survived) * 60 : 0);
  const row = {
    skill,
    survival: med(runs.map((r) => r.survived)),
    optimal: med(runs.map((r) => r.optimal)),
    standing: med(runs.flatMap((r) => r.rows.map((x) => x.standing))),
    wave: med(runs.map((r) => r.wave)),
    breach: med(runs.map((r) => perMin(r.breachLoss, r))),
    travel: med(runs.map((r) => perMin(r.traveled, r))),
    // A run that ran out of budget did not die. Its survival is a floor.
    truncated: runs.filter((r) => !r.rows.at(-1)?.over).length,
    errors: runs.reduce((n, r) => n + r.errors.length, 0),
    all: runs.map((r) => r.survived),
  };
  table.push(row);
  console.log(
    String(row.skill).padStart(7),
    `${row.survival}s`.padStart(11),
    `${(row.optimal * 100).toFixed(0)}%`.padStart(10),
    row.standing.toFixed(2).padStart(11),
    String(row.wave).padStart(8),
    row.breach.toFixed(1).padStart(13),
    String(Math.round(row.travel)).padStart(13),
    String(row.truncated).padStart(8),
  );
}

await browser.close();
close();

console.log('\nper-seed survival, to show the spread a median hides:');
for (const r of table) {
  console.log(`  skill ${r.skill}: ${r.all.map((s) => s + 's').join(', ')}`);
}
const errors = table.reduce((n, r) => n + r.errors, 0);
console.log(`\nerrors: ${errors}`);
if (table.some((r) => r.truncated > 0)) {
  console.log('NOTE: some runs hit the budget rather than dying — those medians are floors.');
}
process.exit(errors > 0 ? 1 : 0);
