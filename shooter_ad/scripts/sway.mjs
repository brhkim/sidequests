/**
 * Gate sway (1.6): the instrument. From judgment wave 27 each card drifts
 * left and right inside its own lane, and the grey track behind it shows
 * the limits. `verify` never reaches wave 27 and `from` does not look at
 * the cards, so this injects a late state through `__startOverride` at
 * one wave per sway tier (plus the last still wave), waits for an offer to
 * be on screen, and then reads the cards over a few simulated frames:
 *
 *   - every card's x moves between frames (or does not, before the tier);
 *   - every card stays inside its lane: |x - laneX| + width/2 <= lane/2;
 *   - the track is drawn exactly for the cards that sway;
 *
 * The phase (centre at spawn and at the line) is `npm run model`'s.
 *
 * It photographs each state into `.verify/sway-<wave>.png`. Look at them.
 *   npm run build && node scripts/sway.mjs
 */
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = process.env.HUD_DIST ?? new URL('../dist/', import.meta.url).pathname;
const OUT_DIR = new URL('../.verify/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

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
await mkdir(OUT_DIR, { recursive: true });

// A late build that survives long enough to see two offers, from `hud-late`.
const START = { power: 38400, upgrades: { damageBonus: 18.4, damageMult: 9.65, rateBonus: 7.2, rateMult: 4.4, guns: 4, pierce: 3 } };
// The last still wave, then the first wave of each sway tier, normal mode.
const WAVES = [26, 27, 32, 37];
const errors = [];
const rows = [];

for (const wave of WAVES) {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`wave ${wave}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`wave ${wave}: ${e.message}`));
  await page.addInitScript((start) => { window.__startOverride = start; }, { ...START, wave });
  await page.goto(`http://127.0.0.1:${port}/?seed=11`, { waitUntil: 'load' });
  // Wait for an offer to be fully on the field (its cards revealed).
  await page.waitForFunction(() => {
    const g = window.game?.scene?.getScene('Game');
    return g && g.gates.items.some((x) => x.active && x.y > 300 && x.y < 700);
  }, null, { timeout: 30000 });
  const read = () => page.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    const stats = g.registry.get('stats');
    const lane = 540 / 3;
    const cards = g.gates.items.filter((x) => x.active).map((x) => ({
      x: x.x, y: x.y, laneX: x.laneX, width: x.width, periods: x.swayPeriods, amp: x.swayAmplitude,
      inLane: Math.abs(x.x - x.laneX) + x.width / 2 <= lane / 2 + 1e-6,
    }));
    const tracks = g.field.cards.visuals.filter((v) => v.track.visible).length;
    return { elapsed: stats.elapsed, wave: stats.wave, cards, tracks };
  });
  const a = await read();
  await page.waitForTimeout(250);
  const b = await read();
  await page.screenshot({ path: join(OUT_DIR, `sway-${wave}.png`) });
  const expectSway = wave > 26;
  const moved = a.cards.map((c) => {
    const later = b.cards.find((d) => d.laneX === c.laneX && d.periods === c.periods);
    return later ? Math.abs(later.x - c.x) : 0;
  });
  const anyMoved = moved.some((m) => m > 0.5);
  const allInLane = [...a.cards, ...b.cards].every((c) => c.inLane);
  const periods = [...new Set(a.cards.map((c) => c.periods))];
  const amps = [...new Set(a.cards.map((c) => c.amp))];
  rows.push({ wave, periods, amps, moved: Math.max(...moved).toFixed(1), tracks: b.tracks, cards: b.cards.length, allInLane });
  if (expectSway && !anyMoved) errors.push(`wave ${wave}: no card moved between frames`);
  if (!expectSway && anyMoved) errors.push(`wave ${wave}: a card moved before sway begins`);
  if (!allInLane) errors.push(`wave ${wave}: a card left its lane`);
  if (expectSway && b.tracks !== b.cards.length) errors.push(`wave ${wave}: ${b.tracks} tracks drawn for ${b.cards.length} swaying cards`);
  if (!expectSway && b.tracks !== 0) errors.push(`wave ${wave}: a track drawn on a still card`);
  await page.close();
}

await browser.close();
server.close();

console.log('\nsway: one page per wave, the late build injected, the first offer read over 250ms\n');
console.log('  wave   periods/descent   amplitude px   max moved px   tracks/cards   in lane');
for (const r of rows) {
  console.log(
    String(r.wave).padStart(6), r.periods.join('/').padStart(18), r.amps.map((a) => a.toFixed(1)).join('/').padStart(14),
    String(r.moved).padStart(14), `${r.tracks}/${r.cards}`.padStart(14), (r.allInLane ? 'yes' : 'NO').padStart(10),
  );
}
console.log(`\n  stills: ${WAVES.map((w) => `.verify/sway-${w}.png`).join(', ')}; the phase (centre at spawn and at the line) is asserted by npm run model`);
if (errors.length) {
  console.error('\nFAIL');
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log('\nPASS');
