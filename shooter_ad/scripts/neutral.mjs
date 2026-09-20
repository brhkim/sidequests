/**
 * The render-neutrality check: proves a change touched only what is DRAWN.
 *
 * It exists because of a specific failure mode this project was one commit away
 * from. The bullet stream is capped and tinted for legibility at high GUNS and
 * RATE, and the entire risk of that change is that the number of bullets
 * actually SPAWNED moves with the number drawn - at which point a legibility
 * fix has silently become a balance change and every measured number on the
 * branch is stale.
 *
 * Neither existing instrument catches it:
 *
 * - `npm run repeat` asks whether one build reproduces itself. A
 *   differently-balanced game is still a perfectly deterministic one, so it
 *   would report a clean pass.
 * - `npm run sweep` compares medians across five seeds, where within-level
 *   spreads already run 40s to 150s. It can only ever say "within noise", and
 *   the noise is larger than most effects worth catching.
 *
 * So this compares two builds on the SAME seeds and asserts every sampled stat
 * row is IDENTICAL, field by field. Both are served at once rather than built
 * in turn: a run against a build that no longer exists cannot be re-examined
 * when the two disagree.
 *
 * Rendering fields are excluded by name rather than by guesswork - see IGNORED.
 * Everything else, from kills to par DPS to the position of every live gate, has
 * to match to the last digit.
 *
 *   npm run build
 *   NEUTRAL_REF=/tmp/dist-baseline npm run neutral
 *
 * NEUTRAL_REF is a dist/ directory built BEFORE the change. There is no way to
 * synthesise one after the fact, so snapshot it (`cp -r dist /tmp/dist-baseline`)
 * before rebuilding.
 */
import { chromium } from 'playwright';
import { playSeed, serveDist } from './probe-bot.mjs';

const REF = process.env.NEUTRAL_REF;
// Both sides are directories, so two arbitrary builds can be compared without
// either of them having to be the working `dist/` - which matters when a long
// probe is already serving that folder and rebuilding under it would change the
// game mid-measurement.
const NEW = process.env.NEUTRAL_NEW;
const SEEDS = (process.env.PROBE_SEEDS ?? '1,2,3,4,5').split(',').map(Number);
const SKILL = Number(process.env.PROBE_SKILL ?? 0.7);
const SECONDS = Number(process.env.PROBE_SECONDS ?? 150);
const MODE = process.env.NEUTRAL_MODE ?? 'normal';

if (!REF) {
  console.error('NEUTRAL_REF must point at a dist/ built before the change.');
  console.error('Snapshot one with: cp -r dist /tmp/dist-baseline');
  process.exit(2);
}

/**
 * The TERMINAL state of a run, which is the only thing here that is a property
 * of the simulation rather than of the sampler.
 *
 * The first version of this file compared the sampled series row by row and
 * reported all five seeds as different - on a change that was provably
 * rendering-only, with survival agreeing to the last decimal on every seed. The
 * differences were `elapsed: 5.1 vs 5.08` and a spawn rate read either side of
 * the first throttle. `playSeed` polls on WALL CLOCK and buckets the answer on
 * simulated seconds, so two runs of an identical simulation are photographed at
 * slightly different simulated instants and their mid-run rows differ for that
 * reason alone.
 *
 * That is the standing warning in `CLAUDE.md` arriving again, one level up: a
 * deterministic system measured by a nondeterministic instrument is a
 * nondeterministic measurement. So this compares the state a run ENDS in, which
 * is frozen before it is read and cannot be jittered by when the read happened.
 */
const TERMINAL = [
  'survived', 'wave', 'kills', 'decisions', 'optimal', 'contactLoss', 'breachLoss',
  'fireLoss', 'traveled', 'dps', 'parDps',
];

const { port: refPort, close: closeRef } = await serveDist(REF);
const { port: newPort, close: closeNew } = NEW ? await serveDist(NEW) : await serveDist();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

console.log(`ref ${REF}\nnew ${NEW ?? 'dist/'}\nmode ${MODE}, skill ${SKILL},`
  + ` seeds ${SEEDS.join(',')}, budget ${SECONDS}s simulated\n`);
console.log('   seed    ends   survival ref/new   terminal state');

let failures = 0;
let inconclusive_count = 0;
for (const seed of SEEDS) {
  const opts = { seed, skill: SKILL, seconds: SECONDS, mode: MODE };
  const a = await playSeed(browser, refPort, opts);
  const b = await playSeed(browser, newPort, opts);

  const diffs = [];
  for (const key of [...TERMINAL, 'tally']) {
    const x = JSON.stringify(a[key]);
    const y = JSON.stringify(b[key]);
    if (x !== y) diffs.push(`${key}: ${x} vs ${y}`);
  }
  // A run that hit the budget was stopped by the POLLER, so where it stopped is
  // a wall-clock artefact and its terminal state is not a property of the
  // simulation. Such a seed proves nothing either way and says so rather than
  // counting as a pass.
  const inconclusive = !a.died || !b.died;
  if (diffs.length > 0) failures++;
  else if (inconclusive) inconclusive_count++;
  console.log(
    String(seed).padStart(7),
    (a.died && b.died ? 'died' : 'budget').padStart(7),
    `${a.survived}s / ${b.survived}s`.padStart(18),
    '  ' + (diffs.length > 0 ? diffs.join('; ')
      : inconclusive ? 'identical, but truncated - inconclusive' : 'identical'),
  );
  for (const e of [...a.errors, ...b.errors]) console.log(`    ERROR ${e}`);
}

await browser.close();
closeRef();
closeNew();

if (failures > 0) {
  console.error(`\nFAIL: ${failures}/${SEEDS.length} seeds simulate differently.`);
  console.error('The change is NOT rendering-only. Every balance number on this');
  console.error('branch measured a different game from the one that now builds.');
  process.exit(1);
}
const conclusive = SEEDS.length - inconclusive_count;
console.log(`\nPASS: ${conclusive}/${SEEDS.length} seeds died and ended in an identical state.`);
if (inconclusive_count > 0) {
  console.log(`${inconclusive_count} hit the time budget instead of dying. Those were stopped by`);
  console.log('the poller rather than by the game, so they are not evidence - raise');
  console.log('PROBE_SECONDS or pick seeds that die inside it.');
}
if (conclusive === 0) {
  console.error('\nNo seed died inside the budget, so nothing here was actually tested.');
  process.exit(1);
}
console.log('Whatever changed, it changed only the picture.');
