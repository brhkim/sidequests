/**
 * Balance probe. Plays the built game headlessly across several fixed seeds and
 * prints a time series of power, par, standing, DPS and the enemy multipliers.
 *
 * Two properties make the numbers worth acting on:
 *
 * - **Fixed seeds.** Balance work is comparison work, and a single unseeded run
 *   varies ~2x on gate luck alone - enough to make a change look like a
 *   regression when nothing changed. Runs differ only by the code under test.
 * - **A bot that plays.** It steers toward the best gate on offer rather than
 *   sweeping blindly, so the series measures the DESIGN rather than whether a
 *   sine wave happened to pass under a x2.
 *
 * It is still a crude player: no threat avoidance, no positioning for breaches.
 * Read it as a floor on difficulty, not a verdict on how the game feels.
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

// Gates worth steering into, best first. The bot has no model of the game, so
// it uses a fixed preference order rather than scoring.
const PREFERENCE = [
  'mul', 'add', 'multishot', 'damage', 'firerate', 'pierce',
  'frenzy', 'shield', 'slowmo',
];
const rank = (kind) => {
  const i = PREFERENCE.indexOf(kind);
  return i === -1 ? 99 : i;
};

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
  for (let tick = 0; tick < SECONDS * 10; tick++) {
    const s = await page.evaluate(() =>
      window.game?.scene?.getScene('Game')?.registry?.get('stats') ?? null);
    if (s) {
      last = s;
      if (tick % 50 === 0) rows.push({ t: tick / 10, ...s });
      if (s.over) break;

      // Steer for the best gate that has not yet passed the squad.
      const reachable = (s.gates ?? []).filter((g) => g.y < 820);
      if (reachable.length > 0) {
        reachable.sort((a, b) => rank(a.kind) - rank(b.kind));
        await page.mouse.move(toScreen(reachable[0].x), laneY);
      } else {
        const x = 0.5 + 0.42 * Math.sin(tick / 11);
        await page.mouse.move(box.x + box.width * x, laneY);
      }
    }
    await page.waitForTimeout(100);
  }
  await page.close();
  const survived = last?.over ? rows.at(-1).t : SECONDS;
  return { seed, rows, survived, wave: last?.wave ?? 0, errors };
}

const results = [];
for (const seed of SEEDS) results.push(await runSeed(seed));
await browser.close();
server.close();

for (const r of results) {
  console.log(`\n=== seed ${r.seed} — survived ${r.survived}s, reached wave ${r.wave} ===`);
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

const survivals = results.map((r) => r.survived).sort((a, b) => a - b);
const median = survivals[Math.floor(survivals.length / 2)];
console.log(`\nsurvival: ${survivals.join('s, ')}s   median ${median}s`);
console.log(`errors: ${results.reduce((n, r) => n + r.errors.length, 0)}`);
