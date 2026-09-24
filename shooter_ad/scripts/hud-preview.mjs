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

// HUD_DIST lets this photograph a build that is not the working `dist/`, so a
// long probe can keep serving that folder undisturbed.
const DIST = process.env.HUD_DIST ?? new URL('../dist/', import.meta.url).pathname;
const OUT_DIR = new URL('../.verify/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

/**
 * Progress states worth looking at, not a sample of play.
 *
 * `hud-stream` exists for the bullet stream rather than for the HUD. The
 * playfield went solid cream at high GUNS and RATE, and the two states that
 * bracket that - `hud-mid` barely collapses, `hud-late` collapses by two orders
 * of magnitude - left the interesting middle unphotographed. It sits where one
 * drawn bullet first stands for a handful of real ones, which is where the
 * tiering has to read as deliberate rather than as a bug.
 */
const STATES = [
  { name: 'hud-early', power: 24, u: { damageBonus: 0.35, damageMult: 1, rateBonus: 0.1, rateMult: 1.2, guns: 1, pierce: 0 } },
  { name: 'hud-mid', power: 640, u: { damageBonus: 2.1, damageMult: 1.32, rateBonus: 0.85, rateMult: 1.1, guns: 2, pierce: 1 } },
  // ECHO 3 (1.5): a full ghost ring on the left at full size and a half
  // one on the right at half size, `ECHO.offset` from the leader, and the
  // three columns they fire, at the state `hud-mid` is.
  { name: 'hud-echo', power: 640, u: { damageBonus: 2.1, damageMult: 1.32, rateBonus: 0.85, rateMult: 1.1, guns: 2, pierce: 1, echo: 3 } },
  { name: 'hud-stream', power: 4200, u: { damageBonus: 6.4, damageMult: 3.1, rateBonus: 2.4, rateMult: 1.9, guns: 3, pierce: 2 } },
  { name: 'hud-late', power: 38400, u: { damageBonus: 18.4, damageMult: 9.65, rateBonus: 7.2, rateMult: 4.4, guns: 4, pierce: 3 } },
  // The palette loop. `hud-cap` is the last rung of the first cycle - every
  // unit Prismatic, at exactly the old 38,912 ceiling - and `hud-loop`
  // is the first rung of the second, where the ring wears Grey again. What has
  // to read is the contrast between those two adjacent rungs, not which cycle
  // either is in; the cycle is deliberately unmarked.
  { name: 'hud-cap', power: 19 * 2048, u: { damageBonus: 18.4, damageMult: 9.65, rateBonus: 7.2, rateMult: 4.4, guns: 4, pierce: 3 } },
  { name: 'hud-loop', power: 19 * 4096, u: { damageBonus: 18.4, damageMult: 9.65, rateBonus: 7.2, rateMult: 4.4, guns: 4, pierce: 3 } },
  // Deep into the second cycle: Gold again, at a power the old ladder could not
  // represent at all.
  { name: 'hud-loop-gold', power: 19 * 2 ** 20, u: { damageBonus: 40, damageMult: 30, rateBonus: 12, rateMult: 8, guns: 5, pierce: 4 } },
  // The duel from the other side. Every state above is far AHEAD of par,
  // because par starts from nothing; these two put par in front - just
  // behind (yellow, over the target tick) and well behind (red, under it) -
  // so the one question the rail exists to answer is seen both ways. Par is
  // the mid build at whatever army puts the standing at `standing`.
  { name: 'hud-close', power: 640, standing: 0.85, u: { damageBonus: 2.1, damageMult: 1.32, rateBonus: 0.85, rateMult: 1.1, guns: 2, pierce: 1 } },
  { name: 'hud-behind', power: 640, standing: 0.35, u: { damageBonus: 2.1, damageMult: 1.32, rateBonus: 0.85, rateMult: 1.1, guns: 2, pierce: 1 } },
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
  await page.evaluate(({ power, u, standing }) => {
    const scene = window.game.scene.getScene('Game');
    Object.assign(scene.squad.progress.upgrades, u);
    scene.squad.progress.power = power;
    scene.squad.rebuild();
    if (standing) {
      // Bisect par's army until dps / parDps is the standing asked for.
      const d = scene.difficulty;
      const want = scene.squad.dps / standing;
      let lo = 1, hi = power * 1e4;
      d.ideal = { power, upgrades: { ...scene.squad.progress.upgrades } };
      for (let i = 0; i < 60; i++) {
        d.ideal.power = Math.round((lo + hi) / 2);
        if (d.parDps < want) lo = d.ideal.power; else hi = d.ideal.power;
      }
    }
  }, state);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT_DIR, `${state.name}.png`) });
  // The stream numbers, because "it looks better" is not a measurement. `true`
  // is what the simulation fires and collides with; `drawn` is what the
  // renderer puts on screen. If `true` ever moves when only rendering changed,
  // the collapse has leaked into the simulation.
  // Sampled over an interval of SIMULATED time, so what this machine was doing
  // meanwhile cannot change the figure.
  const sample = () => page.evaluate(() => {
    const scene = window.game.scene.getScene('Game');
    const items = scene.bullets.items.filter((b) => b.active);
    return {
      elapsed: scene.registry.get('stats').elapsed,
      spawned: scene.bullets.spawned,
      shots: scene.bullets.shotsSpawned,
      refused: scene.bullets.refused,
      want: scene.squad.shotsPerSecond(),
      dps: scene.squad.dps,
      perShot: scene.squad.damagePerShot(scene.squad.units[0].share),
      live: items.length,
      drawn: items.filter((b) => b.drawn).length,
      density: items.length ? Math.max(...items.map((b) => b.density)) : 1,
    };
  });
  const a = await sample();
  await page.waitForTimeout(1200);
  const b = await sample();
  const dt = Math.max(1e-6, b.elapsed - a.elapsed);
  const fired = (b.spawned - a.spawned) / dt;
  const carried = (b.shots - a.shots) / dt;
  const lost = (b.refused - a.refused) / dt;
  // `fired` is bullets the simulation spawned; `carried` is the real shots
  // they stand for, which is what collides. Past `WEAPON.maxSimShotsPerSecond`
  // the first is flat and the second keeps tracking `want` - that gap is the
  // simulation's bundle. `refused` must be zero everywhere now: the pool is
  // sized from the cap, so a refusal is a pool sized wrong.
  console.log(
    `${state.name}.png  want ${Math.round(b.want)}/s  fired ${Math.round(fired)}/s`
    + ` carrying ${Math.round(carried)}/s  refused ${Math.round(lost)}/s`
    + `  live ${b.live}  drawn ${b.drawn}  density x${b.density.toFixed(1)}`,
  );
  // Delivery, as a pure RATE ratio. Damage is linear in shot count, so shots
  // carried over shots wanted IS the fraction of the build's analytic DPS that
  // reaches an enemy - no damage model restated here, nothing to drift. An
  // earlier version multiplied by the leader's per-shot damage and reported
  // 1.45 where the answer had to be 1.00.
  console.log(
    `              delivers ${(carried / Math.max(1, b.want) * 100).toFixed(0)}%`
    + ` of what the build implies   dps on the HUD ${b.dps.toExponential(2)}`,
  );
  if (lost > 0) errors.push(`${state.name}: the bullet pool refused ${Math.round(lost)} spawns/s`);
}
console.log(`errors: ${errors.length}`);
for (const e of errors) console.log(`  ${e}`);
await browser.close();
server.close();
