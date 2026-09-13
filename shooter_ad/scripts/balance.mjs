// Balance probe: play the built game headlessly and sample the difficulty
// model over time, so tuning is done against data rather than feel.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = new URL('../dist/', import.meta.url).pathname;
const TYPES = { '.html':'text/html', '.js':'text/javascript' };
const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (p === '/favicon.ico') { res.writeHead(204).end(); return; }
  const file = join(DIST, p === '/' ? 'index.html' : p);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise(r => server.listen(0, r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });

const box = await page.locator('canvas').boundingBox();
const laneY = box.y + box.height * 0.84;
await page.mouse.move(box.x + box.width / 2, laneY);
await page.mouse.down();

const SECONDS = Number(process.env.PROBE_SECONDS ?? 120);
const rows = [];
for (let t = 0; t < SECONDS * 10; t++) {
  // Sweep the lane so the bot actually engages and takes gates.
  const x = box.x + box.width * (0.5 + 0.42 * Math.sin((t / 10) * 0.9));
  await page.mouse.move(x, laneY);
  await page.waitForTimeout(100);
  if (t % 50 === 0) {
    const s = await page.evaluate(() =>
      window.game?.scene?.getScene('Game')?.registry?.get('stats') ?? null);
    if (s) rows.push({ t: t / 10, ...s });
    if (s?.over) break;
  }
}
await browser.close(); server.close();

console.log('  t   wave  power    par  stand   dps   hpMult   rate  kills');
for (const r of rows) {
  console.log(
    String(r.t).padStart(4), String(r.wave).padStart(5),
    String(r.power).padStart(7), String(r.parPower).padStart(6),
    String(r.standing).padStart(6), String(r.dps).padStart(6),
    String(r.hpMult).padStart(7), String(r.rate).padStart(6),
    String(r.kills).padStart(6),
    r.over ? ' OVER' : '');
}
console.log('errors:', errors.length);
for (const e of errors) console.log('  ' + e);
