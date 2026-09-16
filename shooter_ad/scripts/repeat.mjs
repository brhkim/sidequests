/**
 * The reproducibility instrument: plays ONE seed several times and fails if the
 * runs differ.
 *
 * Determinism is a product feature here - match codes are meant to be shared,
 * and "same offers, different outcome" is a broken feature rather than test
 * noise. It is also the precondition for every balance question: while a repeat
 * of one seed moved on its own, no sweep could separate a real effect from the
 * clock, and this project has now published a confident, entirely false balance
 * conclusion for exactly that reason.
 *
 * Before the fixed timestep, three repeats of seed 1 gave 40.2s / 41.1s / 40.2s
 * of simulated time - identical content, ~2% timing jitter out of collision
 * resolution against a varying frame delta. Fixing the simulation clock alone
 * was NOT enough: the bot still steered by wall-clock mouse moves, so its input
 * landed at different simulated moments and the same three repeats diverged
 * further, to 4 / 6 / 4 decisions and a 30% spread. Both clocks had to move.
 *
 * What it asserts: every repeat agrees exactly on simulated survival, wave,
 * decisions taken, and share of optimal. Any nonzero spread is a regression -
 * the usual cause is a new `Math.random()`, or gameplay reading a real frame
 * delta rather than `SIM.step`.
 *
 *   npm run repeat
 *   REPEAT_SEED=7 REPEAT_RUNS=5 PROBE_SKILL=0.9 npm run repeat
 */
import { chromium } from 'playwright';
import { playSeed, serveDist } from './probe-bot.mjs';

const SEED = Number(process.env.REPEAT_SEED ?? 1);
const RUNS = Number(process.env.REPEAT_RUNS ?? 3);
const SKILL = Number(process.env.PROBE_SKILL ?? 0.7);
const SECONDS = Number(process.env.PROBE_SECONDS ?? 150);

const { port, close } = await serveDist();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

const runs = [];
for (let i = 0; i < RUNS; i++) {
  const t0 = Date.now();
  const r = await playSeed(browser, port, { seed: SEED, skill: SKILL, seconds: SECONDS });
  runs.push({ ...r, wall: (Date.now() - t0) / 1000 });
}
await browser.close();
close();

console.log(`seed ${SEED}, skill ${SKILL}, ${RUNS} repeats\n`);
console.log('  run   survived   wave  decisions  optimal   kills   wall');
for (let i = 0; i < runs.length; i++) {
  const r = runs[i];
  console.log(
    String(i + 1).padStart(5),
    `${r.survived}s`.padStart(11),
    String(r.wave).padStart(6),
    String(r.decisions).padStart(10),
    `${(r.optimal * 100).toFixed(0)}%`.padStart(9),
    String(r.kills).padStart(7),
    `${r.wall.toFixed(1)}s`.padStart(7),
  );
}

/**
 * Spread as a fraction of the mean. Reported for survival even though the
 * assertion is exact equality, because the number this replaced was ~2% and a
 * future regression is easier to read as "2% again" than as "not equal".
 */
function spread(xs) {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (mean === 0) return 0;
  return (Math.max(...xs) - Math.min(...xs)) / mean;
}

const survivals = runs.map((r) => r.survived);
const wall = runs.map((r) => r.wall);
console.log(`\nsurvival spread (simulated): ${(spread(survivals) * 100).toFixed(2)}%`);
// Printed to make the point that this one is EXPECTED to move: the machine's
// load is not the game's business. If simulated spread is 0 while this is not,
// the fixed timestep is doing exactly its job.
console.log(`wall-clock spread:           ${(spread(wall) * 100).toFixed(2)}%`);

const fields = ['survived', 'wave', 'decisions', 'optimal', 'kills'];
const failures = [];
for (const f of fields) {
  const values = runs.map((r) => r[f]);
  if (new Set(values).size > 1) failures.push(`${f}: ${values.join(', ')}`);
}
const errors = runs.reduce((n, r) => n + r.errors.length, 0);
for (const r of runs) for (const e of r.errors) console.log('  ERROR ' + e);

if (failures.length > 0 || errors > 0) {
  console.log('\nFAIL — repeats of one seed disagree:');
  for (const f of failures) console.log('  ' + f);
  if (errors > 0) console.log(`  ${errors} console error(s)`);
  process.exit(1);
}
console.log('\nPASS — every repeat identical');
