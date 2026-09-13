/**
 * Screenshots the HUD in states the 24-second verify run never reaches.
 *
 * `verify` plays from scratch, so it only ever photographs an empty build: no
 * multipliers, no guns, no pierce, a tiny damage pool. The strip beneath the
 * red line exists FOR the late-game state, so judging its legibility off a
 * fresh run is judging the wrong picture. This forces the squad's upgrades to
 * fixed states and shoots each one.
 *
 * Not a test - it asserts nothing. It produces images to look at.
 *   npm run build && node scripts/hud-preview.mjs
 */
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = new URL('../dist/', import.meta.url).pathname;
const OUT_DIR = new URL('../.verify/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

/** Progress states worth looking at, not a sample of play. */
const STATES = [
  { name: 'hud-early', power: 24, u: { damageBonus: 0.35, damageMult: 1, rateBonus: 0.1, rateMult: 1.2, guns: 1, pierce: 0 } },
  { name: 'hud-mid', power: 640, u: { damageBonus: 2.1, damageMult: 1.32, rateBonus: 0.85, rateMult: 1.1, guns: 2, pierce: 1 } },
  { name: 'hud-late', power: 38400, u: { damageBonus: 18.4, damageMult: 9.65, rateBonus: 7.2, rateMult: 4.4, guns: 4, pierce: 3 } },
];

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

const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {});
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`http://127.0.0.1:${port}/?seed=7`, { waitUntil: 'load' });
await page.waitForTimeout(6000);

await mkdir(OUT_DIR, { recursive: true });
for (const state of STATES) {
  await page.evaluate(({ power, u }) => {
    const scene = window.game.scene.getScene('Game');
    Object.assign(scene.squad.progress.upgrades, u);
    scene.squad.progress.power = power;
    scene.squad.rebuild();
  }, state);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT_DIR, `${state.name}.png`) });
  console.log(`${state.name}.png`);
}
console.log(`errors: ${errors.length}`);
for (const e of errors) console.log(`  ${e}`);
await browser.close();
server.close();
