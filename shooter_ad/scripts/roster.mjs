/**
 * Photographs the roster as a set: one of every enemy type in a row, the Titan
 * and a cage, a volley of every gun, the squad at a tiered power. Four stills:
 *
 *   roster.png       the board at rest, `hud-mid` power (cream/green stream)
 *   roster-hit.png   every second body 40% damaged, one Grunt and one Brute
 *                    killed the frame before, a contact pop
 *   roster-late.png  the same board at `hud-late` power (orange stream)
 *   roster-fx.png    the pops mid-flight: a Titan burst, two kill rings, a
 *                    contact puff, a block ping; SHIELD 3 and ECHO 2 held
 *
 * The playfield is what a player reads at a glance, and until this existed
 * the roster had never been seen together: `verify` photographs wave 2 (two
 * types) and `hud` photographs the squad. The questions to ask of the stills:
 * can every type be named from its SILHOUETTE with colour ignored, and is any
 * enemy bullet mistakable for a Runner?
 *
 * Not a test: it asserts only that nothing errored. The scene is stopped
 * (`paused` set directly so no pause screen is raised), stepped by hand so the
 * squad's stream is real, then the board is laid out and `render()` is called
 * once per still. Everything spawned is immortal (hpScale 1e7) so a stray
 * shot changes nothing but a flash.
 *   npm run build && npm run roster
 *   ROSTER_SCALE=3 npm run roster      # the same frames at 3x, to look closely
 */
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = process.env.ROSTER_DIST ?? new URL('../dist/', import.meta.url).pathname;
const OUT_DIR = new URL('../.verify/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

const MID = { power: 640, u: { damageBonus: 2.1, damageMult: 1.32, rateBonus: 0.85, rateMult: 1.1, guns: 2, pierce: 1 } };
const LATE = { power: 38400, u: { damageBonus: 18.4, damageMult: 9.65, rateBonus: 7.2, rateMult: 4.4, guns: 4, pierce: 3 } };

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
// ROSTER_SCALE=3 renders the same frame at 3x device pixels, to judge a
// silhouette up close without a second instrument.
const SCALE = Number(process.env.ROSTER_SCALE ?? 1);
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: SCALE });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`http://127.0.0.1:${port}/?seed=7`, { waitUntil: 'load' });
await page.waitForTimeout(1500);

/**
 * Stops the scene, forces a power state, and steps by hand for a second and a
 * half with the squad parked at the left edge - out of every column the
 * roster will occupy - so a real, tiered stream is in the air. Then lays out
 * the board and renders it once.
 */
const board = (state) => page.evaluate(({ power, u }) => {
  const s = window.game.scene.getScene('Game');
  s.paused = true;
  if (s.over) s.restart();
  Object.assign(s.squad.progress.upgrades, u);
  s.squad.progress.power = power;
  s.squad.rebuild();
  s.squad.x = 70; s.targetX = 70;
  for (let i = 0; i < 90; i++) s.step(1 / 60);

  s.enemies.reset();
  s.enemies.items.length = 0;
  s.enemyFire.reset();
  const types = window.enemyTypes;
  const small = types.filter((t) => t.id !== 'titan');
  // Ten types since 1.1: 46px apart from x 100, so the last stays on the board.
  small.forEach((t, i) => s.enemies.spawn(t, 100 + i * 46, 260, 1e7));
  const titan = types.find((t) => t.id === 'titan');
  s.enemies.spawn(titan, 270, 140, 1, 1e7);
  // A turned Shielder beside the row, so the plate is seen off-axis once.
  const sh = types.find((t) => t.id === 'shielder');
  s.enemies.spawn(sh, 470, 380, 1e7);
  const turned = s.enemies.items[s.enemies.items.length - 1];
  turned.fx = 0.8; turned.fy = 0.6;
  s.enemies.cages.push({ x: 270, y: 470, hp: 10, maxHp: 10, hitFlash: -1, active: true });

  // Every gun's volley, mid-flight: a Titan fan, a Lancer trident, an aimed shot.
  for (let k = -2; k <= 2; k++) {
    const a = Math.PI / 2 + k * 0.225;
    s.enemyFire.spawn(270 + Math.cos(a) * 60, 330 + Math.sin(a) * 60, Math.cos(a) * 165, Math.sin(a) * 165, 1);
  }
  for (const d of [-0.42, 0, 0.42]) {
    const a = Math.PI / 2 + d;
    s.enemyFire.spawn(466 + Math.cos(a) * 40, 280 + Math.sin(a) * 40, Math.cos(a) * 185, Math.sin(a) * 185, 1);
  }
  const ax = 70 - 418, ay = 800 - 340;
  const an = Math.hypot(ax, ay);
  s.enemyFire.spawn(418 + (ax / an) * 70, 340 + (ay / an) * 70, (ax / an) * 210, (ay / an) * 210, 1);
  // The Mortar's shell, mid-flight, beside the darts it must not be mistaken for.
  s.enemyFire.spawn(120, 400, 20, 105, 2, true);
  s.render();
}, state);

const shoot = async (name) => {
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`) });
  if (SCALE > 1) {
    await page.screenshot({ path: join(OUT_DIR, `${name}-zoom.png`), clip: { x: 60, y: 90, width: 480, height: 330 } });
  }
  console.log(`${name}.png`);
};

await mkdir(OUT_DIR, { recursive: true });

await board(MID);
await shoot('roster');

// Damage every second body - half of those photographed on the hit frame
// (white flash), half with the flash already over (bleached toward white) -
// kill one Grunt and one Brute, mark a contact, flash the cage.
await page.evaluate(() => {
  const s = window.game.scene.getScene('Game');
  const live = s.enemies.items.filter((e) => e.active);
  live.forEach((e, i) => {
    if (i % 2 === 1) s.enemies.damage(e, e.maxHp * 0.4);
    if (i % 4 === 3) e.hitFlash = -1;
  });
  for (const id of ['grunt', 'brute']) {
    const e = live.find((b) => b.type.id === id);
    s.enemies.damage(e, 1e9);
    s.sim.push({ kind: 'kill', x: e.x, y: e.y, radius: e.radius, color: e.type.color, titan: false });
  }
  s.sim.push({ kind: 'contact', x: 100, y: 740, cost: 1, share: 0.01, tier: 'basic', titan: false });
  s.sprites.onEvents(s.sim.drain());
  // Shards read the simulated clock; advance it a tenth so they are mid-flight.
  s.elapsed += 0.1;
  s.enemies.cages[0].hitFlash = s.elapsed;
  s.render();
});
await shoot('roster-hit');

await board(LATE);
await shoot('roster-late');

// The pops, mid-flight: the Titan killed (its burst), a Brute and a Runner
// killed, a contact puff and a block ping at the ring, with SHIELD 3 held
// (the segmented ring, one charge spent) and ECHO 2 (both half ghosts).
await board({ power: MID.power, u: { ...MID.u, shield: 3, echo: 2 } });
await page.evaluate(() => {
  const s = window.game.scene.getScene('Game');
  const live = s.enemies.items.filter((e) => e.active);
  for (const id of ['titan', 'brute', 'runner']) {
    const e = live.find((b) => b.type.id === id);
    s.enemies.damage(e, 1e12);
    s.sim.push({ kind: 'kill', x: e.x, y: e.y, radius: e.radius, color: e.type.color, titan: id === 'titan' });
  }
  const lead = s.squad.units[0];
  s.sim.push({ kind: 'contact', x: lead.x + 30, y: lead.y - 40, cost: 1, share: 0.01, tier: 'basic', titan: false });
  s.sim.push({ kind: 'block', x: lead.x - 20, y: lead.y - 50, shell: false, body: false, left: 5 });
  s.squad.shield.charges -= 1;
  s.sprites.onEvents(s.sim.drain());
  s.elapsed += 0.08;
  s.render();
});
await shoot('roster-fx');

console.log(`errors: ${errors.length}`);
for (const e of errors) console.log(`  ${e}`);
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
