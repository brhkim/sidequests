/**
 * The rail's fit. Five columns share 460px since SHIELD joined SENSE (1.1),
 * and the sub-lines (`>999% PAR`, `BEST PLAY`, `75% MARKED`, `6 READY`) are
 * the widest things on it. This loads the built page, forces the widest
 * state of every column, reads each text's rendered width off the scene,
 * and FAILS if two neighbours on a line come within `MIN_GAP` px - which is
 * what the eye reads as one word. A layout constant changed by hand is
 * checked here rather than by looking at one still at one state.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = process.env.HUD_DIST ?? new URL('../dist/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const MIN_GAP = 8;

const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (p === '/favicon.ico') { res.writeHead(204).end(); return; }
  const file = join(DIST, p === '/' ? 'index.html' : p);
  let body;
  try { body = await readFile(file); } catch { res.writeHead(404).end('nf'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
});
await new Promise((r) => server.listen(0, r));
const EXE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(EXE) ? { executablePath: EXE } : {});
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/?seed=3`, { waitUntil: 'load' });
await page.waitForTimeout(1200);

const rows = await page.evaluate(() => {
  const ui = window.game.scene.getScene('UI');
  const g = window.game.scene.getScene('Game');
  // The widest state: thousands of kills, standing past 999%, SENSE and
  // SHIELD at their caps, every charge ready.
  g.paused = true;
  g.kills = 1234;
  g.squad.progress.upgrades.sense = 3;
  g.squad.progress.upgrades.shield = 3;
  g.squad.progress.upgrades.damageMult = 1e4;
  g.squad.shield.update(1 / 60, 3);
  g.emitHud();
  return ui.children.list
    .filter((o) => o.type === 'Text' && o.y < 72 && o.text !== '')
    .map((t) => ({ text: t.text, line: Math.round(t.y), left: t.x - t.width / 2, right: t.x + t.width / 2 }));
});
await browser.close();
server.close();

const fail = [];
for (const line of [...new Set(rows.map((r) => r.line))]) {
  const texts = rows.filter((r) => r.line === line).sort((a, b) => a.left - b.left);
  const shown = texts.map((t) => `${t.text} [${t.left.toFixed(0)}..${t.right.toFixed(0)}]`).join('   ');
  console.log(`y ${String(line).padStart(2)}:  ${shown}`);
  for (let i = 1; i < texts.length; i++) {
    const gap = texts[i].left - texts[i - 1].right;
    if (gap < MIN_GAP) fail.push(`"${texts[i - 1].text}" and "${texts[i].text}" are ${gap.toFixed(0)}px apart on y ${line}`);
  }
}
if (errors.length) fail.push(`${errors.length} console/page errors: ${errors[0]}`);
for (const f of fail) console.log(`FAIL: ${f}`);
console.log(fail.length ? 'FAIL' : `PASS  (every neighbour on the rail keeps ${MIN_GAP}px)`);
process.exit(fail.length ? 1 : 0);
