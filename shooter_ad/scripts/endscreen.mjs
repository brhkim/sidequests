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

// The pause/help screen, at two very different pools. It is the only place the
// additive-versus-multiplicative rule is taught, and its whole teaching block is
// DERIVED from the player's current pools - so a shot at an empty pool and a
// shot deep into a run are two different screens, and only the second one
// exercises the conversion the screen exists to explain.
// Each shot also leaves the screen by a different button, because a pause with
// no way out is worse than no pause at all.
const PAUSE_SHOTS = [
  { name: 'pause-early', play: 2, exit: 'restart' },
  { name: 'pause-mid', play: 40, exit: 'resume' },
];
for (const shot of PAUSE_SHOTS) {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', (e) => { console.log(`  ERROR ${e.message}`); errors++; });
  page.on('console', (m) => { if (m.type() === 'error') { console.log(`  ERROR ${m.text()}`); errors++; } });
  await page.goto(`http://127.0.0.1:${port}/?seed=11`, { waitUntil: 'load' });

  const box = await page.locator('canvas').boundingBox();
  const laneY = box.y + box.height * 0.84;
  await page.mouse.move(box.x + box.width / 2, laneY);
  await page.mouse.down();
  const chosen = new Map();
  for (let tick = 0; tick < shot.play * 10; tick++) {
    const s = await page.evaluate(() =>
      window.game?.scene?.getScene('Game')?.registry?.get('stats') ?? null);
    if (s?.over) break;
    const reachable = (s?.gates ?? []).filter((g) => g.y < 820);
    if (reachable.length > 0) {
      const pair = reachable.reduce((a, b) => (b.y > a.y ? b : a)).pair;
      const offer = reachable.filter((g) => g.pair === pair);
      if (!chosen.has(pair)) chosen.set(pair, (offer.find((g) => g.best) ?? offer[0]).x);
      await page.mouse.move(box.x + (chosen.get(pair) / 540) * box.width, laneY);
    }
    await page.waitForTimeout(100);
  }
  await page.mouse.up();

  // Tap the real control at its real coordinates, so the hit test GameScene
  // owns is what is exercised rather than an event fired past it.
  const scale = box.width / 540;
  await page.mouse.click(box.x + 486 * scale, box.y + 100 * scale);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT_DIR, `${shot.name}.png`) });

  const state = await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    return { paused: g.paused, elapsed: g.elapsed, stats: g.registry.get('stats') };
  });
  console.log(`${shot.name}: paused = ${state.paused}, wave ${state.stats.wave}`);
  if (state.paused !== true) {
    console.log('  ERROR the pause button did not pause the game');
    errors++;
  }

  // Leave by the button, and check the simulation did what the button says. A
  // frozen simulation that never restarts looks identical to a working one in
  // a screenshot.
  await page.mouse.click(
    box.x + 270 * scale, box.y + (shot.exit === 'resume' ? 714 : 794) * scale,
  );
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    return { paused: g.paused, elapsed: g.elapsed, stats: g.registry.get('stats') };
  });
  console.log(
    `${shot.name}: ${shot.exit} -> paused ${after.paused},`,
    `wave ${after.stats.wave}, power ${after.stats.power}, ${after.elapsed.toFixed(1)}s`,
  );
  if (after.paused !== false) { console.log(`  ERROR ${shot.exit} did not unpause`); errors++; }
  if (shot.exit === 'resume' && !(after.elapsed > state.elapsed)) {
    console.log('  ERROR resume did not restart the simulation clock'); errors++;
  }
  if (shot.exit === 'restart' && !(after.stats.wave === 1 && after.stats.kills === 0)) {
    console.log('  ERROR restart did not reset the run'); errors++;
  }
  await page.close();
}

// The start screen is reached only WITHOUT ?seed=, which is the form every
// other script passes - so without this shot it would be a user-facing screen
// no automated check has ever seen. That is exactly how the end screen got to
// where it was.
{
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', (e) => { console.log(`  ERROR ${e.message}`); errors++; });
  page.on('console', (m) => { if (m.type() === 'error') { console.log(`  ERROR ${m.text()}`); errors++; } });
  await page.goto(`http://127.0.0.1:${port}/?m=2TNBBGSH`, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT_DIR, 'start-invited.png') });
  // `waiting` alone is a weak assertion: a frozen game with no start screen at
  // all also reports true, and that is exactly the bug that shipped once - the
  // screen was emitted before UIScene existed to hear it. Check the screen is
  // actually VISIBLE and carrying the match, not merely that play has not begun.
  const state = await page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    const ui = window.game.scene.getScene('UI');
    const texts = ui.children.list
      .filter((o) => o.type === 'Container' && o.visible)
      .flatMap((c) => c.list.filter((o) => o.type === 'Text').map((o) => o.text));
    return { waiting: g.waiting, texts };
  });
  const showsCode = state.texts.some((t) => /^[0-9A-Z]{4}-[0-9A-Z]{3}-[NH]$/.test(t));
  console.log(`start-invited: waiting=${state.waiting} showsMatchCode=${showsCode}`);
  if (state.waiting !== true) { console.log('  ERROR shared link did not hold'); errors++; }
  if (!showsCode) { console.log('  ERROR start screen is not showing the match code'); errors++; }
  await page.close();
}

await browser.close();
server.close();

// The one thing worth asserting: a good run must grade above a bad one on the
// same seed. If it does not, the scoring the whole screen rests on is wrong.
console.log(`\nerrors: ${errors}`);
if (errors > 0) process.exit(1);
console.log('screenshots in .verify/ - look at them');
