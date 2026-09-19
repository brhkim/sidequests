/**
 * The boss check, measured on its own terms.
 *
 * The Titan's HP is a deadline: `bossKillPar` of par's single-target DPS, over
 * `bossKillDistance` of its descent, with every shot landing. Nothing else here
 * can tell whether that sentence is true of the shipped game - `npm run from`
 * plays the boss with a bot that is off chasing gates, and `npm run model`
 * checks the arithmetic against itself. This parks a squad UNDER the boss and
 * does nothing else, and reports where on its descent the Titan died.
 *
 * At single-target standing S with every shot landing, the boss dies at
 * `bossKillPar x bossKillDistance / S` of its descent. The column below prints
 * that expectation next to the measurement, and their ratio is the DELIVERY:
 * how much of the damage the budget assumed actually arrived. Below 1 is shots
 * the boss's escorts ate, time the squad spent catching up with its drift, and
 * power lost to breaches while parked. It is a ceiling on what a player can do
 * against the boss and a floor on how honest the budget is; whether the
 * remaining descent is enough slack for a human who also has to dodge and take
 * gates is the author's question, and `npm run from` is the nearer instrument.
 *
 * Par starts EQUAL to the injected state (see `npm run from`), at the wave
 * before a boss wave so the Titan arrives after one wave of ordinary play. The
 * squad takes no gates, so par pulls ahead over that wave; the standing the
 * boss was actually sized against is read at its spawn and printed.
 *
 *   npm run titan                              # three DPS targets, seeds 1-3
 *   npm run titan -- --dps=1e5 --seeds=1,2,3,4,5
 *   npm run titan -- --power=100 --guns=2 --damageMult=2
 */
import { register } from 'node:module';
import { chromium } from 'playwright';
import { playSeed, serveDist } from './probe-bot.mjs';
register('./ts-resolve.mjs', import.meta.url);

const { squadDps, freshUpgrades, applyGate, singleTargetDps } =
  await import('../src/systems/Progression.ts');
const { scoreOffer } = await import('../src/systems/Scoring.ts');
const { rollOffer } = await import('../src/data/gates.ts');
const { ENEMY_BY_ID } = await import('../src/data/enemies.ts');
const { GATES, SQUAD, WAVE, DIFFICULTY, ARENA } = await import('../src/config.ts');

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.slice(2).split('=');
    return [k, v === undefined ? true : v];
  }),
);
const SEEDS = String(args.seeds ?? process.env.PROBE_SEEDS ?? '1,2,3').split(',').map(Number);
const MODE = args.mode ?? 'normal';
// The wave before a boss wave, by default: one wave of play, then the check.
const WAVE_AT = Number(args.wave ?? WAVE.bossEvery - 1);

const titan = ENEMY_BY_ID.get('titan');
const spawnY = ARENA.spawnY - 40;
const travelSeconds = (ARENA.breachY - spawnY) / titan.speed;
// Budget: one wave, the descent, and a margin. Simulated seconds.
const SECONDS = Number(args.seconds ?? Math.ceil(WAVE.baseDuration + travelSeconds + 20));

/** Same fast-forward as `npm run from`: a build par would actually have. */
function fastForward(targetDps) {
  let s0 = 424242;
  const rng = () => ((s0 = (s0 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const par = { power: SQUAD.startPower, upgrades: freshUpgrades() };
  let offer = 0;
  while (squadDps(par) < targetDps && offer < 400) {
    const wave = 1 + Math.floor(offer / 2);
    const ctx = { power: par.power, damageBonus: par.upgrades.damageBonus, rateBonus: par.upgrades.rateBonus };
    const gates = rollOffer(GATES.perOffer, wave, ctx, rng);
    if (gates.length > 0) applyGate(par, gates[scoreOffer(par, gates, wave).best]);
    offer++;
  }
  return par;
}

const starts = [];
if (args.dps !== undefined) {
  for (const d of String(args.dps).split(',')) {
    const p = fastForward(Number(d));
    starts.push({ label: `dps ${Number(d).toExponential(0)}`, power: p.power, upgrades: p.upgrades, wave: WAVE_AT });
  }
} else if (args.power !== undefined) {
  const upgrades = freshUpgrades();
  for (const k of Object.keys(upgrades)) if (args[k] !== undefined) upgrades[k] = Number(args[k]);
  starts.push({ label: 'hand state', power: Number(args.power), upgrades, wave: WAVE_AT });
} else {
  for (const d of [30, 1e5, 1e8]) {
    const p = fastForward(d);
    starts.push({ label: `dps ${d.toExponential(0)}`, power: p.power, upgrades: p.upgrades, wave: WAVE_AT });
  }
}

/**
 * The parking bot: under the Titan when there is one, at the centre of the
 * lane otherwise, and never at a gate. Installed AFTER the standard bot so it
 * replaces it; both are called from inside the page on the simulation clock.
 */
async function parkUnderTitan(page) {
  await page.addInitScript(() => {
    window.__autopilot = ({ titan }) => (titan ? titan.x : 270);
  });
}

const { port, close } = await serveDist();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const want = DIFFICULTY.bossKillPar * DIFFICULTY.bossKillDistance;

console.log(`Titan: ${2 * titan.radius}px wide, armor ${titan.armor}, ${travelSeconds.toFixed(1)}s from spawn to the breach line`);
console.log(`budget: ${DIFFICULTY.bossKillPar} of par single-target DPS over ${DIFFICULTY.bossKillDistance} of the descent`
  + ` -> at standing 1.0 with every shot landing it dies at ${(want * 100).toFixed(0)}%`);
console.log(`mode ${MODE}, start wave ${WAVE_AT}, budget ${SECONDS}s simulated, squad PARKED under the boss and taking no gates\n`);

let failures = 0;
let errors = 0;
const deliveries = [];
for (const start of starts) {
  const p = { power: start.power, upgrades: start.upgrades };
  console.log(`${start.label}: power ${Math.round(p.power)}, guns ${p.upgrades.guns}, pierce ${p.upgrades.pierce},`
    + ` single-target ${singleTargetDps(p).toExponential(2)}/s`);
  console.log('  seed   standing at spawn   expected kill at   measured kill at   delivery   outcome');
  for (const seed of SEEDS) {
    const r = await playSeedParked(browser, port, { seed, seconds: SECONDS, mode: MODE, start });
    errors += r.errors.length;
    for (const e of r.errors) console.log('  ERROR ' + e);
    const check = r.titanChecks[0];
    if (!check) {
      console.log(`  ${String(seed).padStart(4)}   no Titan spawned in ${r.survived}s (wave ${r.wave})`);
      failures++;
      continue;
    }
    const expected = want / check.standing;
    const measured = check.killedAt;
    const delivery = measured === null ? null : expected / measured;
    if (delivery !== null) deliveries.push(delivery);
    const outcome = measured !== null
      ? 'killed'
      : r.cause === 'titan'
        ? `LANDED with ${((r.titan?.hpFrac ?? r.lastTitanHp ?? 0) * 100).toFixed(0)}% HP left`
        : r.died ? 'squad died first' : `budget hit, Titan at ${((r.titan?.progress ?? 0) * 100).toFixed(0)}% with ${((r.titan?.hpFrac ?? 0) * 100).toFixed(0)}% HP`;
    console.log(
      String(seed).padStart(6),
      check.standing.toFixed(2).padStart(19),
      `${(expected * 100).toFixed(0)}%`.padStart(18),
      (measured === null ? '-' : `${(measured * 100).toFixed(0)}%`).padStart(18),
      (delivery === null ? '-' : delivery.toFixed(2)).padStart(10),
      '  ' + outcome,
    );
  }
  console.log('');
}
await browser.close();
close();

const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
if (deliveries.length) {
  console.log(`median delivery ${med(deliveries).toFixed(2)} over ${deliveries.length} kills`
    + ` (1.0 = the budget's assumption exactly; below it is escorts, drift and breaches)`);
}
console.log(`errors: ${errors}`);
process.exit(errors > 0 || failures > 0 ? 1 : 0);

/** `playSeed` with the parking bot layered over the standard one, and the
 * Titan fields carried out of the final poll. */
async function playSeedParked(browser, port, opts) {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await parkUnderTitan(page);
  await page.addInitScript((v) => { window.__startOverride = v; }, opts.start);
  const query = `?seed=${opts.seed}` + (opts.mode === 'normal' ? '' : `&mode=${opts.mode}`);
  await page.goto(`http://127.0.0.1:${port}/${query}`, { waitUntil: 'load' });
  let last = null;
  let lastTitanHp = null;
  const hardStop = Date.now() + opts.seconds * 4000;
  while ((last?.elapsed ?? 0) < opts.seconds && Date.now() < hardStop) {
    const s = await page.evaluate(() =>
      window.game?.scene?.getScene('Game')?.registry?.get('stats') ?? null);
    if (s) {
      last = s;
      if (s.titan) lastTitanHp = s.titan.hpFrac;
      if (s.over) break;
    }
    await page.waitForTimeout(100);
  }
  await page.close();
  return {
    errors: errs,
    died: last?.over === true,
    cause: last?.over === true ? (last.cause ?? 'overrun') : null,
    survived: Number((last?.elapsed ?? 0).toFixed(1)),
    wave: last?.wave ?? 0,
    titanChecks: last?.titanChecks ?? [],
    titan: last?.titan ?? null,
    lastTitanHp,
  };
}
