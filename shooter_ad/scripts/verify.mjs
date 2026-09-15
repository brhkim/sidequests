/**
 * Headless smoke test: build output must load, run for a few seconds, and
 * produce no console or page errors.
 *
 * This proves the game boots and renders. It does NOT prove the game is
 * playable or balanced - do not report it as more than it is.
 */
import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = new URL('../dist/', import.meta.url).pathname;
const OUT_DIR = new URL('../.verify/', import.meta.url).pathname;
const OUT = join(OUT_DIR, 'screenshot.png');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (path === '/favicon.ico') { res.writeHead(204).end(); return; }
  const file = join(DIST, path === '/' ? 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;

// The image ships a Chromium build that may not match the pinned Playwright
// version's expected revision, so point at it explicitly rather than
// downloading one (`playwright install` is unavailable in this environment).
const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch(
  existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {},
);
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });

/**
 * Play the game rather than just watch it boot. The squad only kills what it is
 * lined up with, so a static pointer scores nothing and would make a broken
 * collision step look identical to a working one.
 */
const box = await page.locator('canvas').boundingBox();
const toScreen = (gx, gy) => ({
  x: box.x + (gx / 540) * box.width,
  y: box.y + (gy / 960) * box.height,
});

/**
 * Press START MATCH for real, on the canvas, rather than skipping the screen.
 *
 * This is the only check that loads the game the way a player does - with no
 * `?seed=` - so it is the only one that meets the start screen at all. Clicking
 * the actual button means a dead button fails the build here rather than in
 * somebody's browser.
 */
const start = toScreen(270, 580);
await page.mouse.click(start.x, start.y);
await page.waitForTimeout(250);
if (await page.evaluate(() => window.game.scene.getScene('Game').waiting)) {
  console.error('FAIL: START MATCH did not begin the run');
  process.exit(1);
}

const laneY = box.y + box.height * 0.84;
await page.mouse.move(box.x + box.width / 2, laneY);
await page.mouse.down();

const SECONDS = Number(process.env.VERIFY_SECONDS ?? 24);
for (let t = 0; t < SECONDS * 10; t++) {
  // Sweep across the lane so the squad meets enemies and drives through gates.
  const phase = (t / 10) * 0.9;
  const x = box.x + box.width * (0.5 + 0.42 * Math.sin(phase));
  await page.mouse.move(x, laneY);
  await page.waitForTimeout(100);
}
await page.mouse.up();

const stats = await page.evaluate(
  () => window.game?.scene?.getScene('Game')?.registry?.get('stats') ?? null,
);

const canvas = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return c ? { width: c.width, height: c.height } : null;
});

await mkdir(OUT_DIR, { recursive: true });
await page.screenshot({ path: OUT });
const { size } = await stat(OUT);

await browser.close();
server.close();

const blankish = size < 12_000;
console.log(`canvas:     ${canvas ? `${canvas.width}x${canvas.height}` : 'MISSING'}`);
console.log(`screenshot: ${OUT} (${size} bytes)${blankish ? '  <-- suspiciously small' : ''}`);
console.log(`stats:      ${stats ? JSON.stringify(stats) : 'UNAVAILABLE'}`);
console.log(`errors:     ${errors.length}`);
for (const e of errors) console.log(`  ${e}`);

if (!canvas || canvas.width === 0) { console.error('FAIL: no canvas rendered'); process.exit(1); }
if (errors.length > 0) { console.error('FAIL: console/page errors'); process.exit(1); }
if (blankish) { console.error('FAIL: frame looks blank'); process.exit(1); }
if (!stats) { console.error('FAIL: no gameplay stats exposed'); process.exit(1); }
if (stats.kills === 0) { console.error('FAIL: no enemies killed in ' + SECONDS + 's'); process.exit(1); }
if (stats.wave < 2) { console.error('FAIL: wave never advanced'); process.exit(1); }
if (stats.units > 19) { console.error('FAIL: ring cap exceeded'); process.exit(1); }
console.log('PASS');
