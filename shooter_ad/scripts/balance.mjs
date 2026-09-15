/**
 * Balance probe. Plays the built game headlessly across several fixed seeds and
 * prints a time series of power, par, standing, DPS and the enemy multipliers.
 *
 * Two properties make the numbers worth acting on:
 *
 * - **Fixed seeds.** Balance work is comparison work, and a single unseeded run
 *   varies ~2x on gate luck alone - enough to make a change look like a
 *   regression when nothing changed. Runs differ only by the code under test.
 * - **A bot that plays.** It steers toward a gate rather than sweeping blindly,
 *   so the series measures the DESIGN rather than whether a sine wave happened
 *   to pass under an offer.
 *
 * The bot chooses from the game's OWN scoring. Each live gate publishes the
 * fractional DPS change it would produce, priced by the same `scoreOffer` par
 * and the death screen use, so the bot answers exactly the question the game
 * asks a player. Its predecessor ranked gates by AXIS, which cannot express a
 * choice between two magnitudes of the same axis - the entire decision - so
 * every number it produced was soft.
 *
 * PROBE_SKILL (default 0.7) is the probability of taking the best option,
 * otherwise picking uniformly at random among the offer. That closes the loop
 * with design: DIFFICULTY.targetFraction is a claim about what fraction of
 * optimal the game expects, and this is how the claim gets tested. Probing at
 * 0.5 / 0.7 / 0.9 should produce visibly different runs; if it does not, the
 * curve is not responding to skill and something upstream is wrong.
 *
 * The bot's own RNG is seeded per run, so a given seed and skill reproduce.
 *
 * It remains a crude player: no threat avoidance, no positioning for breaches,
 * and it cannot dodge enemy fire at all. Read it as a floor on difficulty, not
 * a verdict on how the game feels.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = new URL('../dist/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const SECONDS = Number(process.env.PROBE_SECONDS ?? 150);
const SEEDS = (process.env.PROBE_SEEDS ?? '1,2,3').split(',').map(Number);
const VERBOSE = process.env.PROBE_VERBOSE === '1';

const SKILL = Number(process.env.PROBE_SKILL ?? 0.7);

/** Seeded so a given (seed, skill) pair reproduces exactly. */
function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (p === '/favicon.ico') { res.writeHead(204).end(); return; }
  const file = join(DIST, p === '/' ? 'index.html' : p);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function runSeed(seed) {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/?seed=${seed}`, { waitUntil: 'load' });

  const box = await page.locator('canvas').boundingBox();
  const laneY = box.y + box.height * 0.84;
  const toScreen = (gx) => box.x + (gx / 540) * box.width;
  await page.mouse.move(box.x + box.width / 2, laneY);
  await page.mouse.down();

  const rows = [];
  let last = null;
  const botRng = mulberry32((seed * 2654435761 + Math.round(SKILL * 1000)) | 0);
  // One commitment per offer. Re-rolling every tick would average the skill
  // knob away and steer the squad into the gap between two gates.
  const chosen = new Map();
  for (let tick = 0; tick < SECONDS * 10; tick++) {
    const s = await page.evaluate(() =>
      window.game?.scene?.getScene('Game')?.registry?.get('stats') ?? null);
    if (s) {
      last = s;
      if (tick % 50 === 0) rows.push({ t: tick / 10, ...s });
      if (s.over) break;

      // Commit to one option of the nearest offer, then drive to it.
      const reachable = (s.gates ?? []).filter((g) => g.y < 820);
      if (reachable.length > 0) {
        const nearest = reachable.reduce((a, b) => (b.y > a.y ? b : a)).pair;
        const offer = reachable.filter((g) => g.pair === nearest);
        if (!chosen.has(nearest)) {
          const best = offer.find((g) => g.best) ?? offer[0];
          const pick = botRng() < SKILL
            ? best
            : offer[Math.min(offer.length - 1, Math.floor(botRng() * offer.length))];
          chosen.set(nearest, pick.x);
        }
        await page.mouse.move(toScreen(chosen.get(nearest)), laneY);
      } else {
        const x = 0.5 + 0.42 * Math.sin(tick / 11);
        await page.mouse.move(box.x + box.width * x, laneY);
      }
    }
    await page.waitForTimeout(100);
  }
  await page.close();
  const survived = last?.over ? rows.at(-1).t : SECONDS;
  return {
    seed, rows, survived, wave: last?.wave ?? 0, errors,
    optimal: last?.optimal ?? 1,
    decisions: last?.decisions ?? 0,
    tally: last?.tally ?? { top: 0, mid: 0, low: 0 },
    breachLoss: last?.breachLoss ?? 0,
    fireLoss: last?.fireLoss ?? 0,
    traveled: last?.traveled ?? 0,
  };
}

const results = [];
for (const seed of SEEDS) results.push(await runSeed(seed));
await browser.close();
server.close();

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

console.log(`\nskill ${SKILL}  (probability of reaching for the best option)`);
console.log(`survival: ${survivals.join('s, ')}s   median ${med(survivals)}s`);
console.log(`optimal:  ${optimals.map((o) => (o * 100).toFixed(0) + '%').join(', ')}`
  + `   median ${(med(optimals) * 100).toFixed(0)}%`);
console.log(`standing: median ${med(stands).toFixed(2)}`
  + `   (mercy clamp governs below ${(0.7 / 1.35).toFixed(2)})`);

// Why runs end, and what steering cost. Survival falls as skill rises, and
// these separate the two explanations: if a high-skill bot travels further and
// bleeds more power to breaches, the drop is the bot chasing distant gates with
// no threat avoidance. If travel and breaches are flat while survival still
// falls, the mercy clamp is genuinely handing better players a harsher run.
const perMin = (xs, r) => (r.survived > 0 ? (xs / r.survived) * 60 : 0);
console.log(
  `breach loss/min: median ${med(results.map((r) => perMin(r.breachLoss, r))).toFixed(1)}`
  + `   fire loss/min: median ${med(results.map((r) => perMin(r.fireLoss, r))).toFixed(1)}`,
);
console.log(
  `travel/min: median ${Math.round(med(results.map((r) => perMin(r.traveled, r))))}px`,
);
console.log(`errors: ${results.reduce((n, r) => n + r.errors.length, 0)}`);
