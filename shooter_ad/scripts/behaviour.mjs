/**
 * Enemy behaviour instrument.
 *
 * `verify` proves the game boots; `balance` proves it is roughly survivable.
 * Neither can tell you whether eight enemy types actually move differently -
 * which is exactly the failure this project already shipped once, with five
 * types falling through to the same `default` case while the roster claimed
 * otherwise. A typecheck could not see it and neither could a screenshot.
 *
 * So: spawn one cohort of each type directly (the bot does not reliably survive
 * to wave 8, so waiting for them is not an option), sample their trajectories
 * for a few seconds, and print a movement signature per type:
 *
 *   lateral   total horizontal path length, px - separates weavers from walkers
 *   back      total UPWARD travel, px - non-zero only for retreating types
 *   turns     lateral direction changes - separates waypoints/dashes from sine
 *   vmax      peak downward speed as a multiple of the type's base speed
 *   net       net downward progress over the window, px
 *
 * Then three property checks that the roster cannot make on its own:
 * retreat stays bounded, the directional shield is actually directional, and
 * the guns produce fire that costs the squad power.
 *
 * Caveats, stated rather than buried: this samples on wall-clock frames of a
 * real browser, so the numbers wobble by a few percent run to run. It measures
 * MOVEMENT, not whether the movement is fun, and it says nothing about how any
 * of this reads to a player.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST = new URL('../dist/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const SEED = Number(process.env.BEHAVIOUR_SEED ?? 7);
const SAMPLE_MS = Number(process.env.BEHAVIOUR_MS ?? 6000);

const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (p === '/favicon.ico') { res.writeHead(204).end(); return; }
  const file = join(DIST, p === '/' ? 'index.html' : p);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
      .end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const EXE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(EXE) ? { executablePath: EXE } : {});
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/?seed=${SEED}`, { waitUntil: 'load' });
await page.waitForTimeout(1200);

/**
 * Puts the scene back into a state where things move. A cohort of bombers will
 * happily breach and end the run, and a dead scene reports every type measured
 * after it as motionless - which looks exactly like the bug being tested for.
 */
await page.evaluate(() => {
  window.__revive = (s) => {
    if (s.over) s.restart();
    s.squad.addPower(120);
    s.enemies.reset();
    s.enemies.items.length = 0;
    s.enemyFire.reset();
  };
});

/**
 * Spawns a cohort of one type, effectively immortal, and starts tracking it.
 * A charger is placed just above its own trigger distance: dropped at the top
 * of the screen it would need twenty seconds to reach the point where its
 * behaviour differs from a straight walker at all, and the window would report
 * "moves in a straight line" - which is the exact bug this script exists for.
 */
const seed = (id) => page.evaluate((typeId) => {
  const s = window.game.scene.getScene('Game');
  window.__revive(s);
  const type = window.enemyTypes.find((t) => t.id === typeId);
  const y0 = type.motion.kind === 'charger' ? 800 - type.motion.trigger - 40 : 130;
  // Absurd hpScale on purpose: the squad is still firing, and a cohort that
  // died mid-window would report the movement of whichever members lived
  // longest rather than of the type. Power is topped up only enough to survive
  // a cohort of bombers breaching - boosting it further just makes the squad
  // lethal enough to cut every window short.
  for (let i = 0; i < 6; i++) s.enemies.spawn(type, 80 + i * 70, y0 + (i % 2) * 40, 1e7);
  window.__track = s.enemies.items.filter((e) => e.active).map((e) => ({
    e, lastX: e.x, lastY: e.y, lateral: 0, back: 0, turns: 0,
    dir: 0, vmax: 0, y0: e.y, top: e.y, minY: e.y, anchorBreach: 0,
  }));
  window.__lastT = performance.now();
}, id);

/** One sampling tick. Returns false once any tracked enemy has left play. */
const sample = () => page.evaluate(() => {
  const now = performance.now();
  const dt = Math.max(1e-3, (now - window.__lastT) / 1000);
  window.__lastT = now;
  for (const t of window.__track) {
    const dx = t.e.x - t.lastX;
    const dy = t.e.y - t.lastY;
    t.lateral += Math.abs(dx);
    if (dy < 0) t.back += -dy;
    if (dy / dt > t.vmax) t.vmax = dy / dt;
    const d = Math.sign(dx);
    if (d !== 0 && t.dir !== 0 && d !== t.dir) t.turns++;
    if (d !== 0) t.dir = d;
    if (t.e.y < t.minY) t.minY = t.e.y;
    t.lastX = t.e.x; t.lastY = t.e.y;
  }
  return window.__track.every((t) => t.e.active);
});

const report = (id) => page.evaluate((typeId) => {
  const type = window.enemyTypes.find((t) => t.id === typeId);
  const n = window.__track.length;
  const mean = (f) => window.__track.reduce((a, t) => a + f(t), 0) / n;
  return {
    id: typeId,
    kind: type.motion.kind,
    lateral: mean((t) => t.lateral),
    back: mean((t) => t.back),
    turns: mean((t) => t.turns),
    vmax: mean((t) => t.vmax) / type.speed,
    net: mean((t) => t.e.y - t.y0),
    minY: Math.min(...window.__track.map((t) => t.minY)),
  };
}, id);

const ids = await page.evaluate(() => window.enemyTypes.map((t) => t.id));
const rows = [];
for (const id of ids) {
  await seed(id);
  const until = Date.now() + SAMPLE_MS;
  // Stop early if anything breached: a removed enemy stops moving, and averaging
  // its frozen position into the signature would understate the whole cohort.
  while (Date.now() < until && await sample()) await page.waitForTimeout(40);
  rows.push(await report(id));
}

// --- property checks --------------------------------------------------------

/** Directional armour: same shot, different approach angles, on one Shielder. */
const shield = await page.evaluate(() => {
  const s = window.game.scene.getScene('Game');
  window.__revive(s);
  const type = window.enemyTypes.find((t) => t.id === 'shielder');
  const probe = (fx, fy) => {
    const n = Math.hypot(fx, fy);
    fx /= n; fy /= n;
    s.enemies.spawn(type, 270, 300, 1e7);
    const e = s.enemies.items[s.enemies.items.length - 1];
    e.fx = fx; e.fy = fy;
    const before = e.hp;
    s.enemies.damage(e, 100, 0, -1);   // a squad bullet always travels up
    e.active = false;
    return before - e.hp;
  };
  return {
    front: probe(0, 1), quarter: probe(0.7, 0.7), flank: probe(1, 0), rear: probe(0, -1),
  };
});

/** Guns: do they fire, and does that fire actually cost the squad power? */
const fire = await page.evaluate(async (ms) => {
  const s = window.game.scene.getScene('Game');
  window.__revive(s);
  const shooters = window.enemyTypes.filter((t) => t.gun);
  let spawned = 0;
  for (const type of shooters) {
    for (let i = 0; i < 3; i++) { s.enemies.spawn(type, 200 + i * 70, 300, 1e7); spawned++; }
  }
  // Net power is useless here: the squad is also killing, streaking and
  // clearing waves through the window, and those swamp the fire damage. Wrap
  // the collision instead, which is the exact number GameScene charges.
  const inner = s.enemyFire.collide.bind(s.enemyFire);
  let hits = 0;
  s.enemyFire.collide = (...a) => { const c = inner(...a); hits += c; return c; };
  let peak = 0;
  const until = performance.now() + ms;
  while (performance.now() < until) {
    peak = Math.max(peak, s.enemyFire.items.filter((b) => b.active).length);
    await new Promise((r) => setTimeout(r, 40));
  }
  s.enemyFire.collide = inner;
  return { shooters: shooters.map((t) => t.id), spawned, peak, hits };
}, 5000);

await browser.close();
server.close();

const pad = (v, w) => String(v).padStart(w);
console.log(`seed ${SEED}, ${SAMPLE_MS}ms per type\n`);
console.log('  id          motion      lateral     back   turns    vmax     net');
for (const r of rows) {
  console.log(
    `  ${r.id.padEnd(10)}  ${r.kind.padEnd(9)}  ${pad(r.lateral.toFixed(0), 7)}  ` +
    `${pad(r.back.toFixed(0), 7)}  ${pad(r.turns.toFixed(1), 6)}  ` +
    `${pad(r.vmax.toFixed(2), 6)}  ${pad(r.net.toFixed(0), 6)}`,
  );
}

console.log('\nshield, 100 damage from below:');
console.log(`  facing you ${shield.front.toFixed(1)}`
  + ` | quartering ${shield.quarter.toFixed(1)}`
  + ` | flanking ${shield.flank.toFixed(1)}`
  + ` | back turned ${shield.rear.toFixed(1)}`);
console.log('\nenemy fire:');
console.log(`  shooters ${fire.shooters.join(', ')} | ${fire.spawned} spawned`
  + ` | peak ${fire.peak} bullets in flight`
  + ` | ${fire.hits.toFixed(0)} damage landed on the squad`);

const fail = [];
const by = (id) => rows.find((r) => r.id === id);
const CEILING = 90;

for (const r of rows) {
  if (r.minY < CEILING - 1) fail.push(`${r.id} rose to y=${r.minY.toFixed(0)}, above the ceiling`);
  if (r.net <= 0) fail.push(`${r.id} made no net downward progress (${r.net.toFixed(0)}px)`);
}
// Distinctness: a straight walker and a weaver must not have the same signature.
if (by('grunt').lateral < 40) fail.push('grunt barely moves laterally');
if (by('runner').lateral < by('grunt').lateral) fail.push('runner weaves less than a grunt');
if (by('shielder').turns < 1) fail.push('shielder never changes lateral direction');
if (by('splitter').vmax < 2) fail.push('splitter never dashes');
if (by('brute').vmax < 1.5) fail.push('brute never charges');
if (by('lancer').back < 20) fail.push('lancer never retreats');
if (by('healer').back < 20) fail.push('healer never retreats');
if (shield.front >= shield.quarter - 1) fail.push('shield does not taper off its centre line');
if (shield.quarter >= shield.flank - 1) fail.push('shield is not directional from the flank');
if (shield.rear < shield.flank - 1) fail.push('the rear is better covered than the flank');
if (fire.peak === 0) fail.push('no enemy bullets were ever in flight');
if (fire.hits <= 0) fail.push('enemy fire never landed on the squad');
if (errors.length) fail.push(`${errors.length} console/page errors: ${errors[0]}`);

console.log('');
for (const f of fail) console.log(`FAIL: ${f}`);
console.log(fail.length ? 'FAIL' : 'PASS');
process.exit(fail.length ? 1 : 0);
