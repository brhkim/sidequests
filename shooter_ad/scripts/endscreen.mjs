/**
 * Screenshots the end screen, which no other check ever sees.
 *
 * `verify` runs 24 seconds and stops while the squad is alive, so the screen
 * that carries the score, the decision tally and the match code - the whole
 * shareable artefact - has never once been photographed by an automated check.
 * That is exactly the screen most likely to be wrong, because it is the only
 * one composed of values that do not exist until a run ends.
 *
 * Plays a real run so the decision log is real, then ends it, and shoots the
 * result at two different qualities of play so the grading colours are visible.
 *
 * Not a test - it asserts almost nothing. It produces images to look at.
 *   npm run build && npm run endscreen
 */
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = new URL('../dist/', import.meta.url).pathname;
const OUT_DIR = new URL('../.verify/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

/** Two runs: one picking well, one picking badly, so grading is visible. */
const RUNS = [
  { name: 'end-good', seed: 7, skill: 1.0 },
  { name: 'end-poor', seed: 7, skill: 0.0 },
];
const PLAY_SECONDS = 45;

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (path === '/favicon.ico') { res.writeHead(204).end(); return; }
  const file = join(DIST, path === '/' ? 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let errors = 0;

for (const run of RUNS) {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', (e) => { console.log(`  ERROR ${e.message}`); errors++; });
  page.on('console', (m) => { if (m.type() === 'error') { console.log(`  ERROR ${m.text()}`); errors++; } });
  await page.goto(`http://127.0.0.1:${port}/?seed=${run.seed}`, { waitUntil: 'load' });

  const box = await page.locator('canvas').boundingBox();
  const laneY = box.y + box.height * 0.84;
  await page.mouse.move(box.x + box.width / 2, laneY);
  await page.mouse.down();

  // Play for real, so the decision log holds genuine picks rather than
  // fabricated ones. Steering is committed per offer, as the probe does.
  const chosen = new Map();
  for (let tick = 0; tick < PLAY_SECONDS * 10; tick++) {
    const s = await page.evaluate(() =>
      window.game?.scene?.getScene('Game')?.registry?.get('stats') ?? null);
    if (s?.over) break;
    const reachable = (s?.gates ?? []).filter((g) => g.y < 820);
    if (reachable.length > 0) {
      const pair = reachable.reduce((a, b) => (b.y > a.y ? b : a)).pair;
      const offer = reachable.filter((g) => g.pair === pair);
      if (!chosen.has(pair)) {
        const best = offer.find((g) => g.best) ?? offer[0];
        const worst = offer.reduce((a, b) => (b.delta < a.delta ? b : a));
        chosen.set(pair, (run.skill >= 0.5 ? best : worst).x);
      }
      await page.mouse.move(box.x + (chosen.get(pair) / 540) * box.width, laneY);
    }
    await page.waitForTimeout(100);
  }

  // End the run deliberately. Waiting for a real death would make the shot
  // depend on how long the bot happens to survive, which is not what is being
  // photographed here.
  const summary = await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    g.over = true;
    g.emitGameOver();
    const s = g.registry.get('stats');
    return { decisions: s.decisions, optimal: s.optimal, tally: s.tally, wave: s.wave };
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT_DIR, `${run.name}.png`) });
  console.log(
    `${run.name}: wave ${summary.wave}, ${summary.decisions} decisions,`,
    `${Math.round(summary.optimal * 100)}% of optimal,`,
    `${summary.tally.top}/${summary.tally.mid}/${summary.tally.low}`,
  );
  await page.close();
}

await browser.close();
server.close();

// The one thing worth asserting: a good run must grade above a bad one on the
// same seed. If it does not, the scoring the whole screen rests on is wrong.
console.log(`\nerrors: ${errors}`);
if (errors > 0) process.exit(1);
console.log('screenshots in .verify/ - look at them');
