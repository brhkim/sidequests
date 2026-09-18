/**
 * A runner from an arbitrary start: plays real, seeded runs that BEGIN in a
 * late-game state rather than at one grey unit on wave 1.
 *
 * It exists because nothing else here can reach the regime the late-game work
 * is for. The probe bot dies at wave 5 to 9 with a shot rate in the low
 * hundreds, so it has never crossed the delivery ceiling, the old HP pin or
 * the old 38,912 power cap - every claim about what happens past them rested
 * on `npm run model`'s arithmetic and `npm run hud`'s forced stills. This is
 * the instrument that lets such a claim rest on a played run.
 *
 * Two decisions, both the author's:
 *
 * - **Par starts EQUAL to the injected player** - "as if they've perfectly kept
 *   up, and then we see what happens from there". The question measured is
 *   therefore "can a player at standing 1.0 survive here?", not a chosen
 *   standing ratio. The bot's usual slippage from par begins at the injected
 *   state rather than at wave 1.
 * - **The run starts at a specified wave**, so the enemy pool, the spawn curve
 *   and the gate speed match the squad rather than sending wave-1 fodder at a
 *   late-game build.
 *
 * The state is given either field by field or as a DPS target that is
 * fast-forwarded to by playing par's own picks through the shipped offer
 * roller and scoring, the way `npm run model` grows par - so an injected
 * "1e6 DPS" squad is a build par would actually have, not a hand-mixed one.
 *
 *   npm run from -- --dps=1e6                      # par-shaped build at 1e6 DPS
 *   npm run from -- --dps=1e9 --wave=25 --seeds=1,2,3
 *   npm run from -- --power=50000 --guns=3 --damageMult=4 --wave=12
 *   FROM_SKILL=1.0 npm run from -- --dps=1e7
 *
 * A row here is one played run: read medians, and read a `+` as a run that hit
 * the budget rather than dying, whose survival is a FLOOR. The bot is still the
 * bot - no dodging, no positioning - so this is a floor on difficulty in the
 * late game, not a verdict on how it feels.
 */
import { register } from 'node:module';
import { chromium } from 'playwright';
import { playSeed, serveDist } from './probe-bot.mjs';
register('./ts-resolve.mjs', import.meta.url);

const { squadDps, freshUpgrades, applyGate, shotsPerSecond, bundleFactor } =
  await import('../src/systems/Progression.ts');
const { scoreOffer } = await import('../src/systems/Scoring.ts');
const { rollOffer } = await import('../src/data/gates.ts');
const { tierFor, tierRow } = await import('../src/data/tiers.ts');
const { GATES, SQUAD } = await import('../src/config.ts');

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.slice(2).split('=');
    return [k, v === undefined ? true : v];
  }),
);
const SEEDS = String(args.seeds ?? process.env.PROBE_SEEDS ?? '1,2,3').split(',').map(Number);
const SKILL = Number(args.skill ?? process.env.FROM_SKILL ?? process.env.PROBE_SKILL ?? 0.7);
const SECONDS = Number(args.seconds ?? process.env.PROBE_SECONDS ?? 150);
const MODE = args.mode ?? 'normal';

/**
 * Grows a par-shaped build until it reaches `targetDps`, and reports the wave
 * such a build would be reached at on the same schedule `npm run model` uses:
 * two offers a wave. Seeded, so the same target gives the same build.
 */
function fastForward(targetDps) {
  let s0 = 424242;
  const rng = () => ((s0 = (s0 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const par = { power: SQUAD.startPower, upgrades: freshUpgrades() };
  let offer = 0;
  while (squadDps(par) < targetDps && offer < 400) {
    const wave = 1 + Math.floor(offer / 2);
    const ctx = {
      power: par.power,
      damageBonus: par.upgrades.damageBonus,
      rateBonus: par.upgrades.rateBonus,
    };
    const gates = rollOffer(GATES.perOffer, wave, ctx, rng);
    if (gates.length > 0) applyGate(par, gates[scoreOffer(par, gates, wave).best]);
    offer++;
  }
  return { progress: par, offers: offer, wave: 1 + Math.floor(offer / 2) };
}

let start;
let derivedWave = 1;
if (args.dps !== undefined) {
  const ff = fastForward(Number(args.dps));
  start = { power: ff.progress.power, upgrades: ff.progress.upgrades };
  derivedWave = ff.wave;
  console.log(`fast-forwarded par ${ff.offers} offers to reach ${Number(args.dps).toExponential(1)} DPS`
    + ` (~${(ff.offers * GATES.interval / 60).toFixed(1)} min of play, wave ${ff.wave} on the model's schedule)`);
} else {
  const upgrades = freshUpgrades();
  for (const k of Object.keys(upgrades)) if (args[k] !== undefined) upgrades[k] = Number(args[k]);
  start = { power: Number(args.power ?? SQUAD.startPower), upgrades };
}
start.wave = Number(args.wave ?? derivedWave);

const progress = { power: start.power, upgrades: start.upgrades };
const u = start.upgrades;
const share = start.power / Math.min(Math.max(1, Math.floor(start.power)), SQUAD.ringCap);
console.log('\nstarting state (par identical):');
console.log(`  power ${Math.round(start.power)}  (${tierRow(tierFor(share)).name}, row ${tierFor(share)})`
  + `  wave ${start.wave}`);
console.log(`  dmg +${Math.round(u.damageBonus * 100)}% x${u.damageMult.toFixed(2)}`
  + `  rate +${Math.round(u.rateBonus * 100)}% x${u.rateMult.toFixed(2)}`
  + `  guns ${u.guns}  pierce ${u.pierce}  move x${u.moveMult.toFixed(2)}  time x${(1 / u.gateSpeedMult).toFixed(2)}`);
console.log(`  DPS ${squadDps(progress).toExponential(2)}  shots/s ${Math.round(shotsPerSecond(progress))}`
  + `  bundle x${bundleFactor(progress).toFixed(1)}`);

const { port, close } = await serveDist();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const results = [];
for (const seed of SEEDS) {
  results.push(await playSeed(browser, port, { seed, skill: SKILL, seconds: SECONDS, mode: MODE, start }));
}
await browser.close();
close();

console.log(`\nmode ${MODE}, skill ${SKILL}, budget ${SECONDS}s simulated\n`);
console.log('  seed   survived   waves reached   standing at end   optimal   decisions'
  + '   breach/min   peak power   end DPS      par DPS      died');
const perMin = (v, r) => (r.survived > 0 ? (v / r.survived) * 60 : 0);
for (const r of results) {
  const endStanding = r.rows.length ? r.rows[r.rows.length - 1].standing : 1;
  console.log(
    String(r.seed).padStart(6),
    `${r.survived}s${r.died ? '' : '+'}`.padStart(11),
    `${start.wave} -> ${r.wave}`.padStart(15),
    endStanding.toFixed(2).padStart(17),
    `${(r.optimal * 100).toFixed(0)}%`.padStart(10),
    String(r.decisions).padStart(11),
    perMin(r.breachLoss, r).toFixed(1).padStart(13),
    String(r.peakPower).padStart(13),
    r.dps.toExponential(2).padStart(9),
    r.parDps.toExponential(2).padStart(12),
    (r.died ? (r.cause === 'titan' ? 'TITAN' : 'yes') : 'no').padStart(8),
  );
  for (const e of r.errors) console.log('  ERROR ' + e);
}
const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log(`\nmedian survival ${med(results.map((r) => r.survived))}s,`
  + ` median standing over the run ${med(results.flatMap((r) => r.rows.map((x) => x.standing))).toFixed(2)},`
  + ` died ${results.filter((r) => r.died).length}/${results.length}`
  + ` (${results.filter((r) => r.cause === 'titan').length} to a Titan landing)`);
const errors = results.reduce((n, r) => n + r.errors.length, 0);
console.log(`errors: ${errors}`);
if (results.some((r) => !r.died)) {
  console.log(`NOTE: a '+' run hit the ${SECONDS}s budget rather than dying; its survival is a FLOOR.`);
}
process.exit(errors > 0 ? 1 : 0);
