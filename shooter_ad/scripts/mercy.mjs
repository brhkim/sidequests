/**
 * The mercy-clamp instrument.
 *
 * `DIFFICULTY.maxOverPlayer` caps enemy pressure at a multiple of what the
 * player can actually destroy. `notes.md` wants it softened substantially -
 * "losing control should be legible, not prevented" - and `CLAUDE.md` calls it
 * the constant most likely to make the game miserable if overcorrected.
 *
 * This file used to say that removing it reproduces a death spiral around wave
 * 7. **That is withdrawn.** It did not reproduce when this instrument was
 * finally run: at no clamp the median was 99.8s and runs reached comparable
 * waves. The original reading predates both the fixed timestep and the
 * root-table correction, so it is not comparable rather than contradicted - if
 * the spiral is real it needs re-demonstrating on the current clock.
 *
 * So the question is not "is the clamp good" but "where does it stop rescuing
 * and start deciding", and that is a question about a REGIME rather than about
 * a survival time. The clamp governs exactly below
 * `standing = targetFraction / maxOverPlayer`; above that the curve is
 * par-driven and skill-responsive. Note the sign: a LARGER `maxOverPlayer` is
 * LESS mercy, and softening the clamp therefore moves that threshold DOWN and
 * hands more of the run back to par. So this sweeps the constant and reports,
 * per value:
 *
 * - **threshold** - the standing below which the clamp is in charge.
 * - **below/runs** - how many runs actually spent their median under it. A
 *   value nobody's play reaches is not a difficulty change, it is dead config.
 * - **died** - a softer clamp should make weak play LOSE, visibly. If nothing
 *   dies, the clamp is not the thing holding the run up; if everything dies at
 *   once, it has been overcorrected into the spiral.
 * - **survival** - reported last and on purpose. Five seeds cannot support a
 *   trend in it, and a run that hit the budget is a floor, marked '+'.
 *
 * Swept at LOW skill by default, because that is the regime the clamp exists
 * for. Competent play sits above the threshold and never touches it, so a sweep
 * at skill 0.9 would measure a constant that was not in force.
 *
 *   npm run mercy
 *   MERCY_VALUES=1.35,2,4 PROBE_SKILL=0.5 npm run mercy
 */
import { chromium } from 'playwright';
import { playSeed, serveDist } from './probe-bot.mjs';

// 2.5 is the shipped value, so it is the control; 1.35 is what it was softened
// from, kept so the two are always read side by side. 99 stands in for "no
// clamp" - it measured identically to 2.5 per-run, which is why 2.5 survives as
// a guarantee rather than as an observed effect.
const VALUES = (process.env.MERCY_VALUES ?? '1.35,1.8,2.5,99').split(',').map(Number);
const SEEDS = (process.env.PROBE_SEEDS ?? '1,2,3,4,5').split(',').map(Number);
const SKILLS = (process.env.MERCY_SKILLS ?? '0.3,0.5').split(',').map(Number);
const SECONDS = Number(process.env.PROBE_SECONDS ?? 150);
const MODE = process.env.MERCY_MODE ?? 'normal';

const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const { port, close } = await serveDist();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

console.log(`mode ${MODE}, seeds ${SEEDS.join(',')}, skills ${SKILLS.join(',')},`
  + ` budget ${SECONDS}s simulated\n`);
console.log('  clamp   threshold   standing   below   died   optimal   breach/min   survival');

for (const clamp of VALUES) {
  const runs = [];
  for (const skill of SKILLS) {
    for (const seed of SEEDS) {
      runs.push(await playSeed(browser, port, {
        seed, skill, seconds: SECONDS, mode: MODE, mercy: clamp,
      }));
    }
  }
  const standings = runs.map((r) => med(r.rows.map((x) => x.standing)) ?? 0);
  // Read off the running build, which knows the clamp it was injected with.
  // A hardcoded copy of `targetFraction` used to live here, and it went stale:
  // the column reported 0.52 for a game whose threshold was 0.28.
  const threshold = med(runs.map((r) => r.clampThreshold));
  const perMin = (v, r) => (r.survived > 0 ? (v / r.survived) * 60 : 0);
  console.log(
    String(clamp === 99 ? 'none' : clamp).padStart(7),
    threshold.toFixed(2).padStart(12),
    med(standings).toFixed(2).padStart(11),
    `${standings.filter((s) => s < threshold).length}/${runs.length}`.padStart(8),
    `${runs.filter((r) => r.died).length}/${runs.length}`.padStart(7),
    `${(med(runs.map((r) => r.optimal)) * 100).toFixed(0)}%`.padStart(10),
    med(runs.map((r) => perMin(r.breachLoss, r))).toFixed(1).padStart(13),
    `${med(runs.map((r) => r.survived))}s`.padStart(11),
  );
  const errs = runs.reduce((n, r) => n + r.errors.length, 0);
  if (errs > 0) console.log(`    ${errs} console error(s)`);
  console.log(
    '          runs: '
    + runs.map((r) => `${r.survived}s${r.died ? '' : '+'}`).join(', '),
  );
}

await browser.close();
close();
console.log('\nA "+" survival hit the budget rather than dying: that number is a FLOOR.');
console.log('The clamp governs BELOW its threshold. A row where no run spent its median');
console.log('there measured a constant that was never in force.');
